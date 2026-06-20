from datetime import date, datetime, timedelta
from fastapi import APIRouter
from models import UserProfile, UserGoals, DayLog, FoodEntry, get_meal_type_from_hour
from database import users_collection, redis_client
import json
from zoneinfo import ZoneInfo


router = APIRouter(tags=["user"])

# ─────────────────────────────────────────────
# SHARED DB HELPERS
# imported by voice.py, dashboard.py, ai.py
# ─────────────────────────────────────────────

def get_user(phone: str) -> UserProfile:
    existing = users_collection.find_one({"phone": phone})
    if existing:
        existing.pop("_id", None)
        return UserProfile(**existing)
    new_user = UserProfile(phone=phone)
    users_collection.insert_one(new_user.model_dump())
    return new_user


def save_user(profile: UserProfile) -> bool:
    try:
        result = users_collection.update_one(
            {"phone": profile.phone},
            {"$set": profile.model_dump()},
            upsert=True,
        )
        print(
            f"[DB SAVE] {profile.phone}: matched={result.matched_count} "
            f"modified={result.modified_count} upserted_id={result.upserted_id}"
        )
        return True
    except Exception as exc:
        print(f"[DB SAVE ERROR] {profile.phone}: {exc}")
        return False


def get_today_log(profile: UserProfile) -> DayLog:
    today = str(date.today())
    for log in profile.weekly_logs:
        if log.date == today:
            return log
    new_log = DayLog(date=today)
    profile.weekly_logs.append(new_log)
    profile.weekly_logs = sorted(
        profile.weekly_logs,
        key=lambda x: x.date,
    )[-28:]
    save_user(profile)
    return new_log


def add_food_to_today(
    profile: UserProfile,
    entries: list,
    total: int,
    meal_type: str = None,
):
    today_log = get_today_log(profile)
    now = datetime.now(ZoneInfo("Asia/Kolkata"))
    time_str = now.strftime("%H:%M")
    resolved_meal_type = meal_type or get_meal_type_from_hour(now.hour)

    for item in entries:
        today_log.entries.append(
            FoodEntry(
                food=item["food"],
                calories=item["calories"],
                protein=item.get("protein", 0),
                carbs=item.get("carbs", 0),
                fat=item.get("fat", 0),
                fibre=item.get("fibre", 0),
                time=time_str,
                meal_type=resolved_meal_type,
            )
        )

    today_log.total_calories += total
    saved = save_user(profile)
    if saved:
        print(
            f"[FOOD LOGGED] {profile.phone}: {len(entries)} items, total={total}, "
            f"meal_type={resolved_meal_type}, day_total={today_log.total_calories}"
        )
    else:
        print(
            f"[FOOD LOG FAILED] {profile.phone}: {len(entries)} items, "
            f"total={total}, meal_type={resolved_meal_type}"
        )
    _bust_user_cache(profile.phone)

    return today_log


# ─────────────────────────────────────────────
# CACHE HELPERS
# Keys:
#   ai_suggestions:{phone}    → 30min, busted on new log
# ─────────────────────────────────────────────

AI_CACHE_TTL    = 60 * 30        # 30 minutes


def _bust_user_cache(phone: str):
    try:
        redis_client.delete(f"ai_suggestions:{phone}")
        print(f"[CACHE BUST] {phone}")
    except Exception as e:
        print(f"[CACHE BUST ERROR] {e}")


def get_cached_ai(phone: str) -> dict | None:
    try:
        raw = redis_client.get(f"ai_suggestions:{phone}")
        if raw:
            print(f"[CACHE HIT] ai_suggestions:{phone}")
            return json.loads(raw)
    except Exception as e:
        print(f"[CACHE READ ERROR] {e}")
    return None


def set_cached_ai(phone: str, data: dict):
    try:
        redis_client.setex(
            f"ai_suggestions:{phone}",
            AI_CACHE_TTL,
            json.dumps(data),
        )
        print(f"[CACHE SET] ai_suggestions:{phone}")
    except Exception as e:
        print(f"[CACHE WRITE ERROR] {e}")


# ─────────────────────────────────────────────
# GEMINI CONTEXT (used by voice.py and ai.py)
# ─────────────────────────────────────────────

def build_context_for_gemini(profile: UserProfile) -> str:
    goals     = profile.goals
    today     = get_today_log(profile)
    remaining = goals.target_calories - today.total_calories

    meal_breakdown = today.meal_breakdown
    meal_lines = []
    for slot, data in meal_breakdown.items():
        calories = data.get("calories", 0) if isinstance(data, dict) else data
        if calories > 0:
            meal_lines.append(
                f"  - {slot.replace('_', ' ').title()}: {calories} kcal"
            )
    meal_str = (
        "\n".join(meal_lines)
        if meal_lines
        else "  - No meals logged yet"
    )

    # Detailed food log for "what did I eat" queries
    food_entries_lines = []
    for entry in today.entries:
        time_str = entry.time if entry.time else "Unknown time"
        meal_label = entry.meal_type.replace('_', ' ').title() if entry.meal_type else ""
        food_entries_lines.append(
            f"  - {time_str} ({meal_label}): {entry.food} ({entry.calories} kcal)"
        )
    food_log_str = (
        "\n".join(food_entries_lines)
        if food_entries_lines
        else "  - No food entries logged today"
    )

    weekly_summary = []
    for log in profile.weekly_logs[-7:]:
        pct = (
            round((log.total_calories / goals.target_calories) * 100)
            if goals.target_calories
            else 0
        )
        weekly_summary.append(
            f"  {log.date}: {log.total_calories} kcal ({pct}% of goal)"
        )
    weekly_str = (
        "\n".join(weekly_summary)
        if weekly_summary
        else "  No data yet"
    )

    goal_advice = {
        "lose_weight": "User wants to LOSE WEIGHT. Warn kindly when over budget.",
        "maintain":    "User wants to MAINTAIN weight.",
        "gain_weight": "User wants to GAIN WEIGHT. Encourage protein rich foods.",
    }.get(goals.goal_type, "")

    if goals.health_conditions:
        conditions = ", ".join(goals.health_conditions)
        goal_advice += f"\nHealth conditions: {conditions}. Adjust diet recommendations accordingly."

    goal_eta = ""
    if goals.weekly_weight_change_kg is not None:
        direction  = "lose" if goals.weekly_weight_change_kg < 0 else "gain"
        abs_change = abs(goals.weekly_weight_change_kg)
        goal_eta   = f"\nWeekly Weight Change: {direction} ~{abs_change} kg/week"
        if goals.estimated_weeks_to_goal is not None:
            months    = round(goals.estimated_weeks_to_goal / 4.3, 1)
            goal_eta += (
                f"\nEstimated Goal ETA: ~{goals.estimated_weeks_to_goal} weeks"
                f" (~{months} months)"
                f"\nGoal Summary: {goals.goal_summary}"
            )

    current_hour = datetime.now(ZoneInfo("Asia/Kolkata")).hour
    current_slot = get_meal_type_from_hour(current_hour)
    slot_data = meal_breakdown.get(current_slot, {})
    slot_logged = (slot_data.get("calories", 0) if isinstance(slot_data, dict) else slot_data) > 0

    return f"""
=== USER PROFILE ===
Name           : {profile.name}
Goal           : {goals.goal_type}
Current Weight : {goals.current_weight_kg} kg
Target Weight  : {goals.target_weight_kg} kg
Height         : {goals.height_cm} cm
Age            : {goals.age}
Gender         : {goals.gender}
Activity Level : {goals.activity_level}
Daily Cal Goal : {goals.target_calories} kcal
TDEE           : {goals.tdee} kcal
Today Consumed : {today.total_calories} kcal
Remaining      : {remaining} kcal
Current Time   : {datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%H:%M")}
Current Slot   : {current_slot.replace("_", " ").title()} (logged: {slot_logged})

Today Meal Breakdown:
{meal_str}

Today's Food Log (use this to answer "what did I eat"):
{food_log_str}

Weekly Summary:
{weekly_str}
{goal_advice}
{goal_eta}
=== END PROFILE ===
"""


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@router.get("/{phone}")
def get_profile(phone: str):
    return get_user(phone)


@router.post("/{phone}/goals")
def set_goals(phone: str, goals: UserGoals):
    """Initial onboarding — sets goals and marks onboarding complete."""
    profile                     = get_user(phone)
    profile.name                = goals.name
    profile.goals               = goals
    profile.onboarding_complete = True
    save_user(profile)
    _bust_user_cache(phone)
    return {"ok": True, "profile": profile}


@router.put("/{phone}/goals")
def update_goals(phone: str, goals: UserGoals):
    """Profile edit — updates goals without changing onboarding_complete.
    Weekly logs are preserved. Cache is busted so dashboard reflects new targets.
    """
    profile       = get_user(phone)
    profile.name  = goals.name
    profile.goals = goals
    save_user(profile)
    _bust_user_cache(phone)
    return {"ok": True, "profile": profile}


@router.get("/{phone}/dashboard")
def get_dashboard(phone: str):
    profile = get_user(phone)
    goals   = profile.goals
    today   = get_today_log(profile)

    diff   = goals.target_calories - today.total_calories
    status = (
        "ahead"    if today.total_calories < goals.target_calories - 200
        else "behind"   if today.total_calories > goals.target_calories
        else "on_track"
    )

    streak = 0
    for log in reversed(profile.weekly_logs[-7:]):
        if 0 < log.total_calories <= goals.target_calories:
            streak += 1
        else:
            break

    return {
        "today_calories":  today.total_calories,
        "target_calories": goals.target_calories,
        "remaining":       diff,
        "status":          status,
        "streak":          streak,
        "tdee":            goals.tdee,
        "activity_level":  goals.activity_level,
    }


@router.get("/{phone}/goal-estimate")
def get_goal_estimate(phone: str):
    profile = get_user(phone)
    goals   = profile.goals
    return {
        "current_weight_kg":        goals.current_weight_kg,
        "target_weight_kg":         goals.target_weight_kg,
        "activity_level":           goals.activity_level,
        "tdee":                     goals.tdee,
        "weekly_weight_change_kg":  goals.weekly_weight_change_kg,
        "estimated_weeks_to_goal":  goals.estimated_weeks_to_goal,
        "estimated_months_to_goal": (
            round(goals.estimated_weeks_to_goal / 4.3, 1)
            if goals.estimated_weeks_to_goal else None
        ),
        "goal_summary": goals.goal_summary,
    }


@router.get("/{phone}/weekly")
def get_weekly(phone: str):
    profile = get_user(phone)
    goals   = profile.goals
    logs    = sorted(profile.weekly_logs, key=lambda x: x.date)[-7:]

    result = []
    for log in logs:
        calorie_pct = (
            round((log.total_calories / goals.target_calories) * 100)
            if goals.target_calories > 0 else 0
        )
        result.append({
            "date":            log.date,
            "calories":        log.total_calories,
            "target_calories": goals.target_calories,
            "calorie_percent": calorie_pct,
            "entries_count":   len(log.entries),
            "meals":           [e.model_dump() for e in log.entries],
        })

    return {
        "logs": result,
        "goals": {
            "goal_type":       goals.goal_type,
            "target_calories": goals.target_calories,
            "activity_level":  goals.activity_level,
            "tdee":            goals.tdee,
        },
    }


@router.get("/{phone}/monthly")
def get_monthly(phone: str):
    from datetime import date as date_cls
    profile = get_user(phone)
    goals   = profile.goals
    today   = date_cls.today()
    log_map = {log.date: log for log in profile.weekly_logs}

    weeks = []
    for week_num in range(3, -1, -1):
        week_days   = []
        week_total  = 0
        days_logged = 0

        for day_offset in range(6, -1, -1):
            d        = today - timedelta(days=week_num * 7 + day_offset)
            date_str = str(d)
            log      = log_map.get(date_str)
            cal      = log.total_calories if log else 0

            week_days.append({
                "date":     date_str,
                "day":      d.strftime("%a")[0],
                "calories": cal,
                "target":   goals.target_calories,
                "logged":   cal > 0,
            })

            week_total  += cal
            if cal > 0:
                days_logged += 1

        avg        = round(week_total / 7)
        is_current = week_num == 0
        weeks.append({
            "week_label":      "Now" if is_current else f"W{4 - week_num}",
            "week_num":        4 - week_num,
            "week_start":      str(today - timedelta(days=week_num * 7 + 6)),
            "week_end":        str(today - timedelta(days=week_num * 7)),
            "is_current_week": is_current,
            "days":            week_days,
            "total":           week_total,
            "avg":             avg,
            "days_logged":     days_logged,
            "on_target":       avg <= goals.target_calories,
        })

    return {
        "weeks":             weeks,
        "weekly_avg_actual": [w["avg"] for w in weeks],
        "weekly_avg_target": [goals.target_calories] * 4,
        "target_calories":   goals.target_calories,
        "goal_type":         goals.goal_type,
        "activity_level":    goals.activity_level,
        "tdee":              goals.tdee,
    }
