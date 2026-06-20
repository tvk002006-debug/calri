from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from routes.user import (
    get_user,
    get_today_log,
)

router = APIRouter()

MEAL_SLOTS = [
    "breakfast", "morning_snack", "lunch",
    "evening_snack", "dinner",
]


def build_macro_targets(goals) -> dict:
    if not goals.current_weight_kg or not goals.target_calories:
        return {"protein": 0, "carbs": 0, "fat": 0, "fibre": 0}

    protein_ratio = {
        "lose_weight": 1.8,
        "maintain": 1.4,
        "gain_weight": 1.6,
    }.get(goals.goal_type, 1.4)

    protein = round(goals.current_weight_kg * protein_ratio)
    fat = round(goals.target_calories * 0.25 / 9)
    carb_calories = goals.target_calories - (protein * 4 + fat * 9)
    carbs = max(round(carb_calories / 4), 0)

    if goals.gender == "female":
        fibre = 28
    else:
        fibre = 30
    if goals.age and goals.age >= 60:
        fibre += 2

    return {
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
        "fibre": fibre,
    }


# ─────────────────────────────────────────────
# DAILY DASHBOARD
# Always fresh. Redis cache is used only by AI suggestions.
# ─────────────────────────────────────────────

@router.get("/daily/{phone}")
async def get_daily_dashboard(phone: str):

    profile = get_user(phone)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    goals     = profile.goals
    today_log = get_today_log(profile)

    # Build meal breakdown using model's computed property
    meal_breakdown = {
        slot: {"calories": 0, "items": []}
        for slot in MEAL_SLOTS
    }
    meals = []

    for entry in today_log.entries:
        item = {
            "food":      entry.food,
            "calories":  entry.calories,
            "protein":   entry.protein,
            "carbs":     entry.carbs,
            "fat":       entry.fat,
            "fibre":     entry.fibre,
            "time":      entry.time,
            "meal_type": entry.meal_type,
        }
        meals.append(item)
        if entry.meal_type in meal_breakdown:
            meal_breakdown[entry.meal_type]["calories"] += entry.calories
            meal_breakdown[entry.meal_type]["items"].append(item)

    consumed = today_log.total_calories
    macros_consumed = {
        "protein": 0,
        "carbs": 0,
        "fat": 0,
        "fibre": 0,
    }

    for item in meals:
        macros_consumed["protein"] += item.get("protein", 0)
        macros_consumed["carbs"] += item.get("carbs", 0)
        macros_consumed["fat"] += item.get("fat", 0)
        macros_consumed["fibre"] += item.get("fibre", 0)

    return {
        "user": {
            "name":           profile.name,
            "goal":           goals.goal_type,
            "target_weight":  goals.target_weight_kg,
            "current_weight": goals.current_weight_kg,
        },
        "today": {
            "calories_consumed": consumed,
            "calories_goal":     goals.target_calories,
            "remaining":         goals.target_calories - consumed,
            "meals":             meals,
            "meal_breakdown":    meal_breakdown,
            "macros_consumed":   macros_consumed,
            "macro_targets":     build_macro_targets(goals),
        },
    }

# ─────────────────────────────────────────────
# WEEKLY DASHBOARD
# Not cached — always fresh (used for charts)
# ─────────────────────────────────────────────

def build_monthly_weight_prediction(goals, calorie_data: list[int]) -> dict:
    current_weight = goals.current_weight_kg
    target_weight = goals.target_weight_kg
    tdee = goals.tdee
    target_calories = goals.target_calories

    if not current_weight or not tdee or not target_calories:
        return {
            "available": False,
            "method": "Complete weight, height, age, gender, and calorie goal to see prediction.",
            "points": [],
        }

    logged_values = [cal for cal in calorie_data if cal > 0]
    days_logged = len(logged_values)
    actual_avg = round(sum(logged_values) / days_logged) if days_logged else target_calories
    remaining_days = max(7 - days_logged, 0)
    blended_week_avg = round(
        (sum(logged_values) + remaining_days * target_calories) / 7
    )

    current_week_change = ((blended_week_avg - tdee) * 7) / 7700
    target_week_change = ((target_calories - tdee) * 7) / 7700

    points = [{"label": "Now", "weight": round(current_weight, 1), "type": "actual"}]
    predicted = current_weight
    for week_index in range(1, 5):
        predicted += current_week_change if week_index == 1 else target_week_change
        point = {
            "label": f"W{week_index}",
            "weight": round(predicted, 1),
            "type": "projected",
        }
        if target_weight is not None:
            point["target"] = target_weight
        points.append(point)

    return {
        "available": True,
        "method": (
            "Dynamic estimate from logged calories, remaining days at target "
            "calories, and profile TDEE."
        ),
        "current_weight": current_weight,
        "target_weight": target_weight,
        "tdee": tdee,
        "actual_avg_calories": actual_avg,
        "blended_week_avg_calories": blended_week_avg,
        "current_week_change_kg": round(current_week_change, 2),
        "target_week_change_kg": round(target_week_change, 2),
        "points": points,
    }


def build_dinner_suggestions(goals, today_log) -> list[dict]:
    remaining = goals.target_calories - today_log.total_calories
    budget = max(min(remaining, 700), 250)

    if remaining <= 250:
        return [
            {
                "meal": "Dinner",
                "food": "Vegetable soup with paneer or boiled egg",
                "reason": "Keeps dinner light while adding protein.",
                "calories": 250,
            },
            {
                "meal": "Dinner",
                "food": "Curd bowl with cucumber and roasted chana",
                "reason": "Fits a tight calorie budget and is easy to digest.",
                "calories": 220,
            },
        ]

    if goals.goal_type == "gain_weight":
        return [
            {
                "meal": "Dinner",
                "food": "Rice, dal, vegetables, and curd",
                "reason": "Balanced carbs and protein for a higher calorie goal.",
                "calories": min(700, budget),
            },
            {
                "meal": "Dinner",
                "food": "Chapati with paneer curry and salad",
                "reason": "Adds protein without making dinner too heavy.",
                "calories": min(650, budget),
            },
        ]

    return [
        {
            "meal": "Dinner",
            "food": "2 chapati with dal and vegetable poriyal",
            "reason": "Good protein and fiber within the remaining budget.",
            "calories": min(520, budget),
        },
        {
            "meal": "Dinner",
            "food": "Idli with sambar and a small curd bowl",
            "reason": "Light dinner option with steady fullness.",
            "calories": min(450, budget),
        },
    ]


@router.get("/weekly/{phone}")
async def get_weekly_dashboard(phone: str):
    profile = get_user(phone)
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")

    goals   = profile.goals
    today = datetime.now(ZoneInfo("Asia/Kolkata"))
    log_map = {log.date: log for log in profile.weekly_logs}

    calorie_data = []
    labels       = []

    for i in range(6, -1, -1):
        d        = today - timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        labels.append(d.strftime("%a")[0])
        log = log_map.get(date_str)
        calorie_data.append(log.total_calories if log else 0)

    avg_calories = (
        sum(calorie_data) // len(calorie_data)
        if calorie_data else 0
    )
    weekly_goal = goals.target_calories * 7
    total_calories = sum(calorie_data)
    calories_available = max(weekly_goal - total_calories, 0)
    monthly_prediction = build_monthly_weight_prediction(goals, calorie_data)
    current_week_change = monthly_prediction.get("current_week_change_kg", 0)
    projected_weight_loss = abs(current_week_change) if current_week_change < 0 else 0
    today_log = get_today_log(profile)

    return {
        "week": {
            "calories":               calorie_data,
            "days":                   labels,
            "avg_calories":           avg_calories,
            "calorie_goal":           goals.target_calories,
            "weekly_goal":            weekly_goal,
            "total_calories":         total_calories,
            "calories_available":     calories_available,
            "projected_weight_loss":  projected_weight_loss,
            "projected_weight_change": current_week_change,
            "monthly_weight_prediction": monthly_prediction,
            "dinner_suggestions":     build_dinner_suggestions(goals, today_log),
        }
    }
