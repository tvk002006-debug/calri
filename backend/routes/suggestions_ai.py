from fastapi import APIRouter
from routes.user import (
    get_user,
    get_today_log,
    get_cached_ai,
    set_cached_ai,
)
from models import UserProfile
import google.generativeai as genai
import os
import json

router = APIRouter( )

genai.configure(api_key=os.getenv("GEMINI_KEY"))
model = genai.GenerativeModel("gemini-2.5-flash-lite")


def build_ai_prompt(profile: UserProfile) -> str:
    goals  = profile.goals
    today  = get_today_log(profile)

    weekly_logs  = profile.weekly_logs[-7:]
    avg_calories = (
        round(sum(log.total_calories for log in weekly_logs) / len(weekly_logs))
        if weekly_logs else 0
    )

    meal_breakdown = today.meal_breakdown
    logged_slots   = [
        slot.replace("_", " ").title()
        for slot, data in meal_breakdown.items()
        if (data.get("calories", 0) if isinstance(data, dict) else data) > 0
    ]
    unlogged_slots = [
        slot.replace("_", " ").title()
        for slot, data in meal_breakdown.items()
        if (data.get("calories", 0) if isinstance(data, dict) else data) == 0
    ]

    # Approximate meal calorie ranges (adjustable based on daily goal)
    daily = goals.target_calories
    meal_ranges = {
        "breakfast": (max(200, daily * 0.15), min(600, daily * 0.35)),
        "morning_snack": (50, max(300, daily * 0.15)),
        "lunch": (max(300, daily * 0.2), min(800, daily * 0.4)),
        "evening_snack": (50, max(300, daily * 0.15)),
        "dinner": (max(300, daily * 0.2), min(800, daily * 0.35)),
    }

    meal_status = []
    for slot, data in meal_breakdown.items():
        cal = data.get("calories", 0) if isinstance(data, dict) else data
        if cal > 0:
            min_c, max_c = meal_ranges.get(slot, (0, 1000))
            if cal < min_c:
                status = f"{slot.replace('_', ' ').title()}: {cal} kcal (low, suggest more)"
            elif cal > max_c:
                status = f"{slot.replace('_', ' ').title()}: {cal} kcal (high, warn over)"
            else:
                status = f"{slot.replace('_', ' ').title()}: {cal} kcal (adequate)"
            meal_status.append(status)

    return f"""
You are a smart fitness and nutrition coach.

User Profile:
- Goal          : {goals.goal_type}
- Current Weight: {goals.current_weight_kg} kg
- Target Weight : {goals.target_weight_kg} kg
- TDEE          : {goals.tdee} kcal
- Daily Cal Goal: {goals.target_calories} kcal

Today's Stats:
- Consumed  : {today.total_calories} kcal
- Remaining : {goals.target_calories - today.total_calories} kcal
- Logged meals  : {", ".join(logged_slots) if logged_slots else "None"}
- Missing meals : {", ".join(unlogged_slots) if unlogged_slots else "None"}
- Meal details  : {"; ".join(meal_status) if meal_status else "No meals logged"}

Weekly Stats:
- Average Calories: {avg_calories} kcal/day

Instructions:
- Give personalised food suggestions based on remaining calories, fitness goal, today's intake, and protein/fiber balance.
- Suggest realistic Indian/Tamil foods.
- Use only these meal names: Breakfast, Morning Snack, Lunch, Evening Snack, Dinner.
- No emojis. Keep suggestions practical and short.
- For EACH meal slot (logged or not):
  - If not logged: Suggest appropriate foods for that slot.
  - If logged but calories are LOW (below min range): Suggest additional foods to reach adequate level.
  - If logged but calories are HIGH (above max range): Add a warning insight about overeating that meal.
  - If logged and adequate: Optionally suggest complementary foods if remaining daily calories allow.
- Always provide suggestions even if meals are logged, adjusting based on current intake.
- Return ONLY valid JSON — no markdown, no backticks.

Format:
{{
  "insights": [
    {{ "type": "good/warn/info", "text": "message" }}
  ],
  "food_suggestions": [
    {{
      "meal": "Breakfast/Morning Snack/Lunch/Evening Snack/Dinner",
      "food": "food name",
      "reason": "why this fits the user"
    }}
  ],
  "healthy_tips": [
    {{ "title": "tip title", "body": "short explanation" }}
  ]
}}
"""


@router.get("/{phone}/ai-suggestions")
def get_ai_suggestions(phone: str):
    try:
        profile = get_user(phone)
        goals   = profile.goals
        today   = get_today_log(profile)
    except Exception as e:
        print(f"[AI PRECHECK ERROR] {e}")
        return {
            "profile":          None,
            "insights":         [],
            "food_suggestions": [],
            "healthy_tips":     [],
            "error":            "Could not load suggestions: database is unavailable.",
        }

    # ── Live stats (always fresh regardless of cache) ──
    # Convert FoodEntry objects to dicts for JSON serialization
    serializable_breakdown = {}
    for slot, data in today.meal_breakdown.items():
        serializable_breakdown[slot] = {
            "calories": data["calories"],
            "items": [item.model_dump() for item in data["items"]]
        }

    live_stats = {
        "goal_type":         goals.goal_type,
        "target_calories":   goals.target_calories,
        "today_calories":    today.total_calories,
        "remaining_calories": goals.target_calories - today.total_calories,
        "meal_breakdown":    serializable_breakdown,
    }

    # ── Try cache ──
    cached = get_cached_ai(phone)
    if cached:
        # Always overwrite live stats even on cache hit
        cached["profile"] = live_stats
        return cached

    # ── Cache miss — generate ──
    prompt = build_ai_prompt(profile)

    try:
        print(f"[AI] Generating suggestions for {phone}")
        response = model.generate_content(prompt)
        text     = (
            response.text
            .strip()
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )
        parsed = json.loads(text)

        result = {
            "profile":          live_stats,
            "insights":         parsed.get("insights", []),
            "food_suggestions": parsed.get("food_suggestions", []),
            "healthy_tips":     parsed.get("healthy_tips", []),
        }

        set_cached_ai(phone, result)
        return result

    except Exception as e:
        print(f"[AI ERROR] {e}")
        return {
            "profile":          live_stats,
            "insights":         [],
            "food_suggestions": [],
            "healthy_tips":     [],
            "error":            str(e),
        }
