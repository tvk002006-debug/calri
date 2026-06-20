from pydantic import BaseModel, Field, computed_field
from typing import Optional, List

ACTIVITY_MULTIPLIERS = {
    "sedentary":    1.2,
    "light":        1.375,
    "moderate":     1.55,
    "active":       1.725,
    "very_active":  1.9,
}

# ─────────────────────────────
# Meal type based on time
# ─────────────────────────────
MEAL_SLOTS = {
    "breakfast":      (6,  9),
    "morning_snack":  (9,  11),
    "lunch":          (11, 14),
    "evening_snack":  (14, 18),
    "dinner":         (18, 6),
}

def get_meal_type_from_hour(hour: int) -> str:
    for meal, (start, end) in MEAL_SLOTS.items():
        if start < end:
            if start <= hour < end:
                return meal
        else:  # overnight wrap
            if hour >= start or hour < end:
                return meal
    return "snack"


class UserGoals(BaseModel):
    name: str = "User"
    goal_type: str = "lose_weight"
    target_calories: int = 1800
    target_weight_kg: Optional[float] = None
    current_weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    activity_level: str = "light"
    health_conditions: List[str] = Field(default_factory=list)

    @computed_field
    @property
    def tdee(self) -> Optional[int]:
        if not self.current_weight_kg or not self.height_cm or not self.age:
            return None
        if self.gender == "female":
            bmr = (10 * self.current_weight_kg) + (6.25 * self.height_cm) - (5 * self.age) - 161
        else:
            bmr = (10 * self.current_weight_kg) + (6.25 * self.height_cm) - (5 * self.age) + 5
        multiplier = ACTIVITY_MULTIPLIERS.get(self.activity_level, 1.375)
        return round(bmr * multiplier)

    @computed_field
    @property
    def weekly_weight_change_kg(self) -> Optional[float]:
        if not self.tdee:
            return None
        daily_delta = self.target_calories - self.tdee
        return round((daily_delta * 7) / 7700, 2)

    @computed_field
    @property
    def estimated_weeks_to_goal(self) -> Optional[float]:
        if (
            not self.target_weight_kg
            or not self.current_weight_kg
            or not self.weekly_weight_change_kg
            or self.weekly_weight_change_kg == 0
        ):
            return None
        diff = self.target_weight_kg - self.current_weight_kg
        weeks = diff / self.weekly_weight_change_kg
        return round(weeks, 1) if weeks > 0 else None

    @computed_field
    @property
    def goal_summary(self) -> str:
        change = self.weekly_weight_change_kg
        weeks = self.estimated_weeks_to_goal
        if change is None:
            return "Complete your profile to see goal estimate."
        direction = "lose" if change < 0 else "gain"
        abs_change = abs(change)
        if weeks:
            return (
                f"You'll {direction} ~{abs_change} kg/week "
                f"and reach your goal in ~{weeks} weeks "
                f"({round(weeks / 4.3, 1)} months)."
            )
        return f"You'll {direction} ~{abs_change} kg/week."


class FoodEntry(BaseModel):
    food: str
    calories: int
    protein: int = 0
    carbs: int = 0
    fat: int = 0
    fibre: int = 0
    time: str
    meal_type: str = "snack"


class DayLog(BaseModel):
    date: str
    entries: List[FoodEntry] = Field(default_factory=list)
    total_calories: int = 0

    # ── Per meal slot totals (derived) ──
    @property
    def meal_breakdown(self) -> dict:
        breakdown: dict = {
            "breakfast": {"calories": 0, "items": []},
            "morning_snack": {"calories": 0, "items": []},
            "lunch": {"calories": 0, "items": []},
            "evening_snack": {"calories": 0, "items": []},
            "dinner": {"calories": 0, "items": []},
        }
        for e in self.entries:
            if e.meal_type in breakdown:
                breakdown[e.meal_type]["calories"] += e.calories
                breakdown[e.meal_type]["items"].append(e)
        return breakdown

    # ── Macro totals (derived) ──
    @property
    def macro_totals(self) -> dict:
        totals = {"protein": 0, "carbs": 0, "fat": 0, "fibre": 0}
        for e in self.entries:
            totals["protein"] += e.protein
            totals["carbs"] += e.carbs
            totals["fat"] += e.fat
            totals["fibre"] += e.fibre
        return totals


class UserProfile(BaseModel):
    phone: str
    name: str = "User"
    goals: UserGoals = UserGoals()
    weekly_logs: List[DayLog] = Field(default_factory=list)
    onboarding_complete: bool = False
