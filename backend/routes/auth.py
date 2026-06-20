from fastapi import APIRouter
import random
import json

from database import users_collection, redis_client
from routes.user import get_user

router = APIRouter()

OTP_EXPIRY = 120


@router.post("/send-otp")
async def send_otp(data: dict):

    phone = data.get("phone")

    if not phone:
        return {"error": "Phone required"}

    otp = str(123456)

    redis_key = f"otp:{phone}"

    redis_client.setex(
        redis_key,
        OTP_EXPIRY,
        json.dumps({
            "otp": otp,
            "phone": phone
        })
    )

    print(f"OTP for {phone}: {otp}")

    return {
        "message": "OTP sent"
    }


@router.post("/verify-otp")
async def verify_otp(data: dict):

    phone = data.get("phone")
    otp = data.get("otp")

    if not phone or not otp:
        return {
            "error": "Phone and OTP required"
        }

    redis_key = f"otp:{phone}"

    stored_data = redis_client.get(redis_key)

    if not stored_data:
        return {
            "error": "OTP expired or invalid"
        }

    stored_data = json.loads(stored_data)

    if stored_data["otp"] != otp:
        return {
            "error": "Invalid OTP"
        }

    redis_client.delete(redis_key)

    profile = get_user(phone)

    if profile.onboarding_complete:
        return {
            "status": "existing_user",
            "next": "dashboard",
            "phone": phone
        }

    return {
        "status": "new_user",
        "next": "onboarding",
        "phone": phone
    }
