import os, json, base64
from datetime import datetime
from typing import List
from zoneinfo import ZoneInfo
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types

from models import FoodEntry, get_meal_type_from_hour
from routes.user import (
    get_user,
    save_user,
    get_today_log,
    add_food_to_today,
    build_context_for_gemini,
)

load_dotenv()

router = APIRouter(tags=["photos"])
client = genai.Client(api_key=os.getenv("GEMINI_KEY"))
VISION_MODEL = "gemini-2.5-flash"


# ─────────────────────────────────────────────
# REQUEST/RESPONSE MODELS
# ─────────────────────────────────────────────

class PhotoAnalysisResponse(BaseModel):
    success: bool
    meal_type: str
    items: List[dict]
    total: int
    message: str


# ─────────────────────────────────────────────
# PHOTO ANALYSIS WITH GEMINI
# ─────────────────────────────────────────────

def build_vision_prompt(phone: str) -> str:
    """Build context-aware prompt for photo analysis."""
    profile = get_user(phone)
    context = build_context_for_gemini(profile)

    return f"""
You are a personal Tamil AI health coach analyzing food photos.

{context}

ANALYZE THIS FOOD PHOTO and identify all visible food items.

Return a JSON object with:
- items: array of food items found, each with food name, calories, protein, carbs, fat, fibre
- total: total calories
- meal_type: auto-detect based on current time (breakfast/morning_snack/lunch/evening_snack/dinner)

RULES:
1. Identify ALL visible food items in the image
2. Estimate portions based on typical serving sizes
3. Include macros: protein, carbs, fat, fibre in grams
4. Food names must be in ENGLISH ONLY (e.g., "2 idli with sambar", "1 plate biryani", "small bowl rice")
5. Do NOT use Tamil script - use English transliterations (idli, dosa, sambar, vada, pongal, etc.)
6. If multiple items, list each separately with individual calorie counts
7. Detect meal type from current time if not obvious from context
8. If unclear, make reasonable estimates

MEAL TIMING:
- 6 AM to 9 AM: breakfast
- 9 AM to 11 AM: morning_snack
- 11 AM to 2 PM: lunch
- 2 PM to 6 PM: evening_snack
- 6 PM to 6 AM: dinner

Respond ONLY with raw JSON (no markdown):
{{
  "items": [
    {{"food": "2 idli", "calories": 150, "protein": 5, "carbs": 28, "fat": 1, "fibre": 2}},
    {{"food": "small bowl sambar", "calories": 80, "protein": 3, "carbs": 15, "fat": 2, "fibre": 4}}
  ],
  "total": 230,
  "meal_type": "breakfast",
  "message": "Idli and sambar detected!"
}}
"""


def _normalize_macro_value(value):
    try:
        if value is None:
            return 0
        if isinstance(value, (int, float)):
            return int(value)
        return int(float(str(value).strip()))
    except Exception:
        return 0


async def analyze_photo_with_gemini(image_bytes: bytes, phone: str) -> PhotoAnalysisResponse:
    """Send photo to Gemini and extract food information."""
    try:
        # Get current hour for meal type detection
        now = datetime.now(ZoneInfo("Asia/Kolkata"))
        current_hour = now.hour
        default_meal_type = get_meal_type_from_hour(current_hour)

        # Build prompt with user context
        prompt = build_vision_prompt(phone)

        # Create content with image
        image_part = types.Part(
            inline_data=types.Blob(
                data=image_bytes,
                mime_type="image/jpeg"
            )
        )

        # Generate content
        response = client.models.generate_content(
            model=VISION_MODEL,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(text=prompt),
                        image_part
                    ]
                )
            ]
        )

        # Parse response
        raw_text = response.text.strip()
        # Remove markdown code blocks if present
        raw_text = raw_text.replace("```json", "").replace("```", "").strip()

        data = json.loads(raw_text)

        # Normalize items
        items = []
        for item in data.get("items", []):
            items.append({
                "food": item.get("food", "Unknown food"),
                "calories": _normalize_macro_value(item.get("calories")),
                "protein": _normalize_macro_value(item.get("protein")),
                "carbs": _normalize_macro_value(item.get("carbs")),
                "fat": _normalize_macro_value(item.get("fat")),
                "fibre": _normalize_macro_value(item.get("fibre")),
            })

        # Check if no food detected
        if not items or len(items) == 0 or all(item["calories"] == 0 for item in items):
            return PhotoAnalysisResponse(
                success=False,
                meal_type=default_meal_type,
                items=[],
                total=0,
                message="No food detected in this image. Please try again with a clearer photo of your meal."
            )

        # Determine meal type
        meal_type = data.get("meal_type") or default_meal_type
        valid_meals = ["breakfast", "morning_snack", "lunch", "evening_snack", "dinner"]
        if meal_type not in valid_meals:
            meal_type = default_meal_type

        # Calculate total if not provided
        total = data.get("total", 0)
        if not total and items:
            total = sum(item["calories"] for item in items)

        return PhotoAnalysisResponse(
            success=True,
            meal_type=meal_type,
            items=items,
            total=total,
            message=data.get("message", f"Found {len(items)} item(s) in your photo!")
        )

    except json.JSONDecodeError as e:
        print(f"[PHOTO ANALYSIS] JSON parse error: {e}")
        return PhotoAnalysisResponse(
            success=False,
            meal_type=default_meal_type,
            items=[],
            total=0,
            message="Could not analyze photo. Please try again."
        )
    except Exception as e:
        print(f"[PHOTO ANALYSIS ERROR] {e}")
        return PhotoAnalysisResponse(
            success=False,
            meal_type=default_meal_type,
            items=[],
            total=0,
            message="Something went wrong analyzing your photo."
        )


# ─────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────

@router.post("/analyze-photo")
async def analyze_photo(
    phone: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Receive a photo and analyze it with Gemini to detect food items.
    Returns detected items for confirmation (does NOT log to DB yet).
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read image bytes
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    # Analyze with Gemini
    result = await analyze_photo_with_gemini(image_bytes, phone)

    return {
        "type": "photo_analysis",
        "success": result.success,
        "meal_type": result.meal_type,
        "items": result.items,
        "total": result.total,
        "message": result.message,
    }


class ConfirmPhotoLogRequest(BaseModel):
    phone: str
    items: List[dict]
    total: int
    meal_type: str


@router.post("/confirm-photo-log")
async def confirm_photo_log(payload: ConfirmPhotoLogRequest):
    """
    Confirm and log the food items detected from photo.
    Called after user confirms on the confirmation screen.
    """
    try:
        profile = get_user(payload.phone)
        updated_log = add_food_to_today(
            profile,
            payload.items,
            payload.total,
            meal_type=payload.meal_type,
        )

        # Get macro totals
        macro_totals = updated_log.macro_totals

        return {
            "success": True,
            "type": "calories",
            "meal_type": payload.meal_type,
            "items": payload.items,
            "total_calories": payload.total,
            "day_total": updated_log.total_calories,
            "macros_consumed": macro_totals,
            "message": f"Logged {payload.total} calories to {payload.meal_type}"
        }

    except Exception as e:
        print(f"[CONFIRM PHOTO LOG ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to log food entry")


@router.get("/debug/analyze-photo")
async def debug_analyze_photo():
    """Health check endpoint for photo routes."""
    return {"status": "photo routes active", "model": VISION_MODEL}
