import os, asyncio, base64, json
from typing import Any
import google.generativeai as genai_text
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime
from zoneinfo import ZoneInfo


from models import UserProfile, FoodEntry, DayLog, get_meal_type_from_hour
from routes.user import (
    get_user,
    save_user,
    get_today_log,
    add_food_to_today,
    build_context_for_gemini,
)

load_dotenv()

router   = APIRouter()
client   = genai.Client(api_key=os.getenv("GEMINI_KEY"))
genai_text.configure(api_key=os.getenv("GEMINI_KEY"))
MODEL_ID = "gemini-3.1-flash-live-preview"

# ─────────────────────────────────────────────
# PENDING FOOD CACHE
# ─────────────────────────────────────────────

pending_food_context: dict = {}
conversation_cache: dict[str, list[dict[str, str]]] = {}
active_sessions: dict[str, Any] = {}


def set_pending_food(phone: str, food_text: str):
    pending_food_context[phone] = {"text": food_text}
    print(f"[PENDING SET] {phone} -> '{food_text}'")


def get_pending_food(phone: str) -> str | None:
    entry = pending_food_context.get(phone)
    if not entry:
        return None
    print(f"[PENDING HIT] {phone} -> '{entry['text']}'")
    return entry["text"]


def clear_pending_food(phone: str):
    if phone in pending_food_context:
        pending_food_context.pop(phone, None)
        print(f"[PENDING CLEAR] {phone}")


def append_conversation(phone: str, role: str, text: str):
    text = (text or "").strip()
    if not text:
        return
    history = conversation_cache.setdefault(phone, [])
    history.append({"role": role, "text": text})
    conversation_cache[phone] = history[-20:]
    print(f"[CONV CACHE] {phone} {role}: {text[:120]}")


def get_conversation_context(phone: str) -> str:
    history = conversation_cache.get(phone, [])
    if not history:
        return "No previous turns in this connection."
    return "\n".join(
        f"{item['role'].title()}: {item['text']}"
        for item in history[-10:]
    )


def clear_session_cache(phone: str):
    clear_pending_food(phone)
    active_sessions.pop(phone, None)


# ─────────────────────────────────────────────
# QUANTITY / FOOD DETECTION HELPERS
# ─────────────────────────────────────────────

VAGUE_QUANTITY_WORDS = [
    "konjam", "koncham", "கொஞ்சம்", "கொஞ்ச",
    "kuraiva", "kurai", "குறைவா", "குறைவு", "குறைஞ்ச",
    "jaasthi", "jasthi", "jaasti", "ஜாஸ்தி", "அதிகம்", "adhigam",
    "thodi", "thoda", "தோட", "தொட்ட",
    "pothum", "போதும்",
    "full", "ஃபுல்",
    "ketta", "கெட்ட",
    "saapitaen", "saapitten",
    "some", "a bit", "a little", "a lot", "few", "many",
]

SPECIFIC_QUANTITY_WORDS = [
    "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "half", "quarter",
    "rendu", "moonu", "naalu", "aanju", "oru",
    "ஒரு", "ரெண்டு", "மூன்று", "நாலு", "ஐந்து",
    "ek", "do", "teen", "char", "paanch",
    "एक", "दो", "तीन", "चार", "पाँच",
    "small", "medium", "large", "big",
    "சின்ன", "பெரிய", "மீடியம்",
    "छोटा", "बड़ा", "मध्यम",
    "bowl", "plate", "cup", "glass", "piece", "pieces",
    "slice", "slices", "spoon", "spoons", "ladle",
    "பவுல்", "கப்", "தட்டு", "கிளாஸ்", "துண்டு",
    "ml", "gram", "grams", "kg", "g",
    "மில்லி", "கிராம்",
]

AUTO_SERVE_FOODS = [
    "sambar", "rasam", "dal", "kuruma", "korma", "gravy",
    "curry", "soup", "chutney", "pickle", "raita", "salna",
    "சாம்பார்", "ரசம்", "குருமா", "சட்னி", "சால்னா",
]

AMBIGUOUS_FOODS = [
    "biryani", "rice", "juice", "coffee",
    "tea", "noodles", "pasta", "shake", "snack",
    "parotta", "roti", "dosa", "idli", "upma",
    "pongal", "fried rice", "chapati", "poori", "halwa",
    "payasam", "lassi", "buttermilk", "bread",
    "egg", "eggs", "omelette", "sandwich", "burger",
    "pizza", "chicken", "fish", "mutton", "paneer",
    "milk", "curd", "yogurt", "banana", "apple",
    "badam", "almond", "almonds", "cashew", "cashews",
    "pista", "pistachio", "walnut", "walnuts",
    "peanut", "peanuts", "groundnut", "groundnuts",
    "biscuit", "biscuits", "cookie", "cookies",
    "chocolate", "chocolates", "cake", "pastry",
    "fruits", "fruit", "grapes", "orange", "mango",
    "பிரியாணி", "சாதம்", "காபி",
    "தேநீர்", "ஜூஸ்", "நூடுல்ஸ்", "பரோட்டா",
    "இட்லி", "தோசை", "உப்மா", "பொங்கல்",
    "சப்பாத்தி", "பூரி",
    "பாயசம்", "லஸ்ஸி", "மோர்", "சோறு",
    "கோழி", "மீன்", "முட்டை", "பால்",
    "பாதாம்", "முந்திரி", "பிஸ்தா", "கொட்டை",
    "பிஸ்கட்", "குக்கீ", "சாக்லேட்", "கேக்",
    "பழம்", "பழங்கள்", "திராட்சை", "ஆரஞ்சு", "மாம்பழம்",
]

NON_FOOD_PHRASES = [
    "hello", "hi", "hey", "வணக்கம்", "ஹலோ",
    "how are you", "what", "why", "when", "where",
    "progress", "weight", "goal", "target", "summary", "report",
    "எப்படி", "என்ன", "எப்போ", "எங்க",
    "நலமா", "சரி", "okay", "ok", "thanks",
    "thank you", "நன்றி", "bye", "goodbye",
]

# ─────────────────────────────────────────────
# CAMERA / GALLERY INTENT DETECTION
# ─────────────────────────────────────────────

CAMERA_INTENT_PHRASES = [
    # English phrases
    "open camera", "take a photo", "take a picture", "open the camera",
    "click a photo", "capture photo", "use camera", "camera mode",
    "photo mode", "take photo", "log with photo", "log with camera",
    "can i take a picture", "can i take a photo", "want to take photo",
    "want to take a picture", "open gallery", "choose from gallery",
    "select from gallery", "pick from gallery", "gallery mode",
    # Tamil phrases
    "கேமரா", "புகைப்படம்", "புகைப்படம் எடு", "கேமரா திற",
    "போட்டோ", "போட்டோ எடு", "கேலரி", "கேலரியிலிருந்து",
    "படம் எடு", "புகைப்படம் எடுக்க", "கேமரா திறக்க",
]

MEAL_TYPE_KEYWORDS = {
    "breakfast": [
        "breakfast", "காலை", "morning", "காலை சாப்பாடு",
        "காலையில", "morning food", "breakfast la",
    ],
    "morning_snack": [
        "morning snack", "காலை snack", "mid morning",
        "11 மணி", "10 மணி",
    ],
    "lunch": [
        "lunch", "மதியம்", "மதிய", "மதிய சாப்பாடு",
        "noon", "midday", "lunch la", "பகல்",
    ],
    "evening_snack": [
        "evening", "மாலை", "evening snack", "tea time",
        "evening tiffin", "மாலை சாப்பாடு", "snack",
    ],
    "dinner": [
        "dinner", "இரவு", "night", "இரவு சாப்பாடு",
        "night food", "dinner la", "supper",
    ],
}


def detect_meal_type_from_text(transcript: str) -> str | None:
    t = transcript.lower()
    for meal_type, keywords in MEAL_TYPE_KEYWORDS.items():
        if any(kw in t for kw in keywords):
            return meal_type
    return None


def is_food_message(transcript: str) -> bool:
    t = transcript.lower().strip()
    if any(p in t for p in NON_FOOD_PHRASES) and len(t.split()) <= 4:
        return False
    return any(f in t for f in AMBIGUOUS_FOODS) or any(f in t for f in AUTO_SERVE_FOODS)


def has_specific_quantity(transcript: str) -> bool:
    t = transcript.lower().strip()
    if any(food in t for food in AUTO_SERVE_FOODS):
        print(f"[QTY CHECK] Auto-serve food detected: '{t}'")
        return True
    if any(v in t for v in VAGUE_QUANTITY_WORDS):
        print(f"[QTY CHECK] Rejected — vague: '{t}'")
        return False
    import re
    if re.search(r'\d+', t):
        return True
    if any(q in t for q in SPECIFIC_QUANTITY_WORDS):
        return True
    print(f"[QTY CHECK] No specific quantity: '{t}'")
    return False


def is_quantity_only_reply(transcript: str) -> bool:
    t            = transcript.lower().strip()
    has_food     = any(f in t for f in AMBIGUOUS_FOODS) or any(f in t for f in AUTO_SERVE_FOODS)
    has_specific = has_specific_quantity(t)
    word_count   = len(t.split())
    return has_specific and not has_food and word_count <= 6


def is_camera_intent(transcript: str) -> str | None:
    """Check if user wants to open camera or gallery. Returns 'camera' or 'gallery' or None."""
    t = transcript.lower().strip()
    print(f"[CAMERA CHECK] Checking: '{t}'")

    # Context words that indicate user wants to OPEN/USE camera (not just mention it)
    action_context = [
        'open', 'take', 'click', 'capture', 'use', 'access', 'show', 'give',
        'eduthu', 'eduka', 'edukanum', 'edunga', 'edutharala', 'edukanum',
        'edukalam', 'edukiren', 'eduthukalaam',
        'திற', 'திறக்க', 'திறக்கலாம்', 'காட்டு', 'எடு', 'எடுக்க',
        'panriya', 'pannu', 'pannunga', 'panniten', 'pannalaam',
        'kudu', 'kudunga', 'kudukalaam',
    ]

    # Camera-related words
    camera_words = ['camera', 'photo', 'picture', 'pic', 'புகைப்படம்', 'போட்டோ', 'கேமரா', 'படம்']
    gallery_words = ['gallery', 'album', 'கேலரி']

    # Check if user has BOTH action context AND camera words
    has_action = any(word in t for word in action_context)
    has_camera = any(word in t for word in camera_words)
    has_gallery = any(word in t for word in gallery_words)

    print(f"[CAMERA CHECK] has_action={has_action}, has_camera={has_camera}, has_gallery={has_gallery}")

    # Must have action context + camera word to trigger
    if has_action and has_camera:
        print(f"[CAMERA CHECK] MATCHED camera via action + camera words")
        return 'camera'
    if has_action and has_gallery:
        print(f"[CAMERA CHECK] MATCHED gallery via action + gallery words")
        return 'gallery'

    print(f"[CAMERA CHECK] No match - missing action context or camera words")
    return None


# ─────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────

def build_system_prompt(phone: str) -> str:
    profile              = get_user(phone)
    context              = build_context_for_gemini(profile)
    pending              = get_pending_food(phone)
    conversation_context = get_conversation_context(phone)

    pending_context = ""
    if pending:
        pending_context = f"""
CRITICAL — PENDING FOOD LOG:
User was asked about quantity for: "{pending}"
Their next message IS the quantity answer.

Accept ONLY specific quantities:
  [ok] small bowl / medium plate / 2 pieces / 1 cup / 200ml
  [no] konjam / thoda / jaasthi / kuraiva / some / a bit

If VAGUE: ask again — "sariyaana alavu sollunga — small bowl ah, medium bowl ah?"
If SPECIFIC: call detect_food() immediately combining food="{pending}" + quantity.
If the pending text has multiple foods, detect ALL of them.
"""

    return f"""
You are a personal Tamil AI health coach.

{context}

{pending_context}

SPECIAL SERVING RULES:
- For sambar, kuruma, rasam, dal, soup, curry, chutney, pickle, raita, salna:
  NEVER ask for quantity. Call detect_food() with a default small serving immediately.
- Only ask quantity for main dishes (idli, dosa, rice, biryani, parotta etc.)

CAMERA PHOTO FEATURE:
- User can take photo of their food for calorie tracking.
- If user mentions camera, photo, or says they want to take a picture:
- Say ONLY: "Camera open panniten. Photo eduthu upload pannunga."
- Do NOT say you cannot detect food from images - camera is a SEPARATE app feature.

FOOD HISTORY CHECK:
- When user asks what they ate ("what did I eat", "what have I eaten", "enna saapten", "na etha sapten", "ennikku etha saapten", "what did I log", "show my logs"):
- You MUST check their food logs before responding
- Tell them exactly what they logged and at what time (breakfast, lunch, dinner, etc)
- If nothing logged yet: say "Innikku epdi sapten nu log pannala pa. Onnu add pannalam"
- Do NOT say "how would I know" or make jokes - you HAVE access to their food history
- Be helpful and summarize their meals clearly

CONFIRMATION FLOW:
- You NEVER log food directly into the database.
- You call detect_food() which sends items to the user's screen for confirmation.
- The user can edit items and tap Confirm or Cancel on screen.
- After calling detect_food(), say: "Screen la check pannitu confirm pannunga"
- Do NOT announce calorie totals — those play automatically after confirmation.

CACHED SESSION RESPONSES:
{conversation_context}

RULES:

1. Always reply in Tamil or Tanglish. No emojis — use plain text only.
2. Be casual, friendly, modern, motivating.
3. MEAL TIMING:
   - 6 AM  to  9 AM  : Breakfast
   - 9 AM  to 11 AM  : Morning Snack
   - 11 AM to  2 PM  : Lunch
   - 2 PM  to  6 PM  : Evening Snack
   - 6 PM  to  6 AM  : Dinner
4. When user mentions food:
   - Use stated meal name if clear; else auto-detect from time
   - If ambiguous at wrong time: ask "Ithu breakfast la saapiteenga ah, illa lunch ah?"
5. Quantity rules:
   - SPECIFIC → call detect_food() immediately
   - VAGUE or MISSING → ask ONE clarification
   - Auto-serve foods (sambar, chutney etc.) → detect_food() immediately
6. NEVER detect for vague: konjam / thoda / jaasthi / kuraiva / some / a bit / a lot
7. ONLY detect for: number / size / vessel / measure / auto-serve food
8. Ambiguous foods needing size: biryani, rice, juice, coffee, tea, noodles, pasta, parotta
9. After detect_food(): say "Screen la check pannitu confirm pannunga" — no calorie counts
10. Remind unlogged meals once per session
11. Over budget: warn politely, suggest lighter alternatives
12. Use user name often. Keep responses SHORT — 1 to 3 sentences max. No emojis.

Examples:
User: "2 dosa sapten"           -> detect_food(); "Screen la confirm pannunga"
User: "idli with sambar sapten" -> ask "Evvalavu idli?"; then detect both
User: "Biryani sapten"          -> "Evvalavu? Small bowl ah medium plate ah?"
User: "sambar sapten"           -> detect_food() immediately, default small serving
User: "Coffee kudichen"         -> "Small cup ah large cup ah?"
"""


# ─────────────────────────────────────────────
# FALLBACK CALORIE EXTRACTION (text model)
# ─────────────────────────────────────────────

TEXT_MODEL = "gemini-2.5-flash"


class NutritionEstimateRequest(BaseModel):
    food_text: str


def _normalize_macro_value(value):
    try:
        if value is None:
            return 0
        if isinstance(value, (int, float)):
            return int(value)
        return int(float(str(value).strip()))
    except Exception:
        return 0


async def estimate_nutrition_from_text(food_text: str):
    loop = asyncio.get_event_loop()

    def _call():
        text_client = genai_text.GenerativeModel(TEXT_MODEL)
        prompt = f"""
You are a nutrition assistant.

Food to estimate: "{food_text}"

Return a single JSON object with calories, protein, carbs, fat, and fibre.
Assume a standard serving when quantity is unclear.
If the text does not describe food, return all zeros.

Respond ONLY with raw JSON (no markdown):

{{
  "food": "{food_text}",
  "calories": 0,
  "protein": 0,
  "carbs": 0,
  "fat": 0,
  "fibre": 0
}}
"""
        response = text_client.generate_content(prompt)
        raw = response.text.strip().replace("```json", "").replace("```", "").strip()
        return json.loads(raw)

    try:
        result = await loop.run_in_executor(None, _call)
        item = result
        if isinstance(result, dict) and "items" in result:
            item = result["items"][0] if result["items"] else {}
        return {
            "food": item.get("food", food_text),
            "calories": _normalize_macro_value(item.get("calories")),
            "protein": _normalize_macro_value(item.get("protein")),
            "carbs": _normalize_macro_value(item.get("carbs")),
            "fat": _normalize_macro_value(item.get("fat")),
            "fibre": _normalize_macro_value(item.get("fibre")),
        }
    except Exception as e:
        print(f"[NUTRITION ESTIMATE ERROR] {e}")
        return {
            "food": food_text,
            "calories": 0,
            "protein": 0,
            "carbs": 0,
            "fat": 0,
            "fibre": 0,
        }


@router.post("/estimate-nutrition")
async def estimate_nutrition(payload: NutritionEstimateRequest):
    return await estimate_nutrition_from_text(payload.food_text)


async def extract_calories_via_text(
    transcript: str,
    websocket,
    phone: str,
    meal_type: str = None,
):
    try:
        print(f"[FALLBACK] Extracting from: '{transcript}'")
        loop = asyncio.get_event_loop()

        def _call():
            text_client = genai_text.GenerativeModel(TEXT_MODEL)
            prompt = f"""
You are a food calorie extraction assistant.

User said: "{transcript}"

Extract each separate food item and estimate calories.
If the message includes multiple foods or accompaniments, return separate objects for each item.
Preserve quantity and serving-size words in the food field exactly as spoken (for example "2 dosa", "1 plate biryani", "small bowl sambar").
Return total 0 if this is not a food report.

AUTO-SERVE FOODS — always estimate with a default small serving, never return 0:
  sambar, rasam, dal, chutney, kuruma, korma, curry, soup, pickle, raita, salna

STRICT QUANTITY: only extract if quantity is specific (number / size / vessel / measure).
Do NOT extract for vague quantities (konjam / thoda / jaasthi / kuraiva / some / a bit).
Exception: auto-serve foods above always extract.

For each item estimate: protein, carbs, fat, fibre in grams (0 if unknown).

Detect meal type if present: breakfast / morning_snack / lunch / evening_snack / dinner

Respond ONLY with raw JSON (no markdown):

{{
  "items": [{{"food": "2 idli", "calories": 150, "protein": 5, "carbs": 28, "fat": 1, "fibre": 2}}],
  "total": 150,
  "meal_type": "breakfast"
}}

If nothing to log: {{"items": [], "total": 0, "meal_type": null}}
"""
            return text_client.generate_content(prompt)

        response = await loop.run_in_executor(None, _call)
        raw = response.text.strip().replace("```json", "").replace("```", "").strip()
        cal_data = json.loads(raw)
        print(f"[FALLBACK] Result: {cal_data}")

        if cal_data["total"] > 0:
            resolved_meal = (
                meal_type
                or cal_data.get("meal_type")
                or get_meal_type_from_hour(datetime.now(ZoneInfo("Asia/Kolkata")).hour)
            )
            valid_meals = ["breakfast", "morning_snack", "lunch", "evening_snack", "dinner"]
            if resolved_meal not in valid_meals:
                resolved_meal = get_meal_type_from_hour(datetime.now(ZoneInfo("Asia/Kolkata")).hour)

            await websocket.send_json({
                "type":      "food_detected",
                "meal_type": resolved_meal,
                "items":     cal_data["items"],
                "total":     cal_data["total"],
            })
            print(f"[FALLBACK] food_detected sent for confirmation")

    except Exception as e:
        print(f"[FALLBACK ERROR] {e}")


# ─────────────────────────────────────────────
# CONNECTION-LEVEL SPEAK DRAINER
# Runs for the full lifetime of the WebSocket connection (not just one mic session).
# This ensures post-confirm TTS fires even after the Gemini session has closed.
# ─────────────────────────────────────────────

async def connection_speak_drainer(speak_queue: asyncio.Queue, websocket, phone: str):
    """Picks up speak messages and injects them into whichever Gemini session is active."""
    try:
        while True:
            text    = await speak_queue.get()
            session = active_sessions.get(phone)
            if session:
                try:
                    print(f"[SPEAK DRAIN] -> Gemini: '{text[:80]}'")
                    await websocket.send_json({"type": "ui", "state": "thinking"})
                    await session.send_message(text)
                except Exception as e:
                    print(f"[SPEAK DRAIN ERROR] {e}")
            else:
                print(f"[SPEAK DRAIN] No active session for {phone}, dropping: '{text[:60]}'")
    except asyncio.CancelledError:
        pass


# ─────────────────────────────────────────────
# WEBSOCKET ENDPOINT
# ─────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    phone = "unknown"

    try:
        init_msg  = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        init_data = json.loads(init_msg)
        if init_data.get("type") == "init":
            phone = init_data.get("phone", "unknown")
            print(f"[WS] Connected: {phone}")
    except Exception:
        print("[WS] No init message")

    mic_active    = False
    current_task  = None
    current_queue = None
    audio_chunks  = 0

    # ── speak_queue lives at connection level, not session level ──
    speak_queue: asyncio.Queue = asyncio.Queue()
    speak_drain_task = asyncio.create_task(
        connection_speak_drainer(speak_queue, websocket, phone)
    )

    try:
        while True:
            msg  = await websocket.receive_text()
            data = json.loads(msg)

            if data["type"] == "control":
                if data["action"] == "mic_start":
                    mic_active = True
                    audio_chunks = 0
                    print(f"[WS] mic_start from {phone}")
                    if current_task and not current_task.done():
                        current_task.cancel()
                        try:
                            await current_task
                        except (asyncio.CancelledError, Exception):
                            pass
                    current_queue = asyncio.Queue()
                    current_task  = asyncio.create_task(
                        run_gemini_session(websocket, current_queue, speak_queue, phone)
                    )

                    def _log_session_task(task: asyncio.Task):
                        try:
                            task.result()
                        except asyncio.CancelledError:
                            pass
                        except Exception as e:
                            print(f"[SESSION TASK ERROR] {e}")

                    current_task.add_done_callback(_log_session_task)
                    await current_queue.put({"type": "start"})

                elif data["action"] == "mic_stop":
                    mic_active = False
                    print(f"[WS] mic_stop from {phone}, chunks={audio_chunks}")
                    if current_queue:
                        await current_queue.put({"type": "end"})

            elif data["type"] == "audio":
                if not mic_active or not current_queue:
                    continue
                audio_chunks += 1
                if audio_chunks == 1 or audio_chunks % 25 == 0:
                    print(f"[WS] audio chunk #{audio_chunks} from {phone}")
                await current_queue.put({"type": "audio", "data": data["data"]})

            # ── THE ONLY PLACE food is written to DB ──
            elif data["type"] == "confirm_log":
                profile     = get_user(phone)
                updated_log = add_food_to_today(
                    profile,
                    data["items"],
                    data["total"],
                    meal_type=data["meal_type"],
                )
                # Get macro totals from the updated log
                macro_totals = updated_log.macro_totals
                await websocket.send_json({
                    "type":           "calories",
                    "state":          "logged",
                    "meal_type":      data["meal_type"],
                    "items":          data["items"],
                    "total_calories": data["total"],
                    "day_total":      updated_log.total_calories,
                    "macros_consumed": macro_totals,
                })
                print(f"[CONFIRMED] {phone} logged {data['total']} kcal to {data['meal_type']}, macros: {macro_totals}")

            # ── Frontend sends speech text for TTS ──
            elif data["type"] == "speak":
                text = (data.get("text") or "").strip()
                if text:
                    await speak_queue.put(text)
                    print(f"[SPEAK QUEUED] {phone}: '{text[:80]}'")

    except WebSocketDisconnect:
        print(f"[WS] Disconnected: {phone}")

    finally:
        # Cancel the connection-level drainer
        speak_drain_task.cancel()
        try:
            await speak_drain_task
        except (asyncio.CancelledError, Exception):
            pass

        clear_session_cache(phone)

        if current_task and not current_task.done():
            current_task.cancel()
            try:
                await current_task
            except (asyncio.CancelledError, Exception):
                pass

        try:
            await websocket.close()
        except Exception:
            pass


# ─────────────────────────────────────────────
# GEMINI LIVE SESSION
# ─────────────────────────────────────────────

async def run_gemini_session(websocket, queue, speak_queue: asyncio.Queue, phone: str):

    system_prompt = build_system_prompt(phone)

    tools = [
        types.Tool(
            function_declarations=[
                types.FunctionDeclaration(
                    name="detect_food",
                    description="""
Detect food from user speech and send it to the frontend confirmation screen.
NEVER logs to DB — user must Confirm or Cancel on screen first.

Call ONLY when food quantity is SPECIFIC and MEASURABLE.
If the transcript contains multiple dishes or sides, return separate item objects for each food.
Preserve quantity and serving-size words in every item's food field (for example "2 dosa", "1 plate biryani").
AUTO-SERVE FOODS — call immediately, no quantity needed:
  sambar, rasam, dal, chutney, kuruma, korma, curry, soup, pickle, raita, salna

NEVER call for vague: konjam / thoda / jaasthi / kuraiva / some / a bit / a lot
ONLY call for: number / size / vessel / measure / auto-serve food

When estimating calories, ALSO estimate protein, carbs, fat, and fibre in grams.
These help the user track their nutrition, so provide reasonable estimates.

meal_type: breakfast / morning_snack / lunch / evening_snack / dinner
""",
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={
                            "items": types.Schema(
                                type="ARRAY",
                                items=types.Schema(
                                    type="OBJECT",
                                    properties={
                                        "food":     types.Schema(type="STRING"),
                                        "calories": types.Schema(type="INTEGER"),
                                        "protein":  types.Schema(type="INTEGER", description="Protein grams"),
                                        "carbs":    types.Schema(type="INTEGER", description="Carbohydrate grams"),
                                        "fat":      types.Schema(type="INTEGER", description="Fat grams"),
                                        "fibre":    types.Schema(type="INTEGER", description="Fiber grams"),
                                    },
                                    required=["food", "calories"],
                                ),
                            ),
                            "total": types.Schema(type="INTEGER"),
                            "meal_type": types.Schema(
                                type="STRING",
                                description="One of: breakfast, morning_snack, lunch, evening_snack, dinner",
                            ),
                        },
                        required=["items", "total"],
                    ),
                )
            ]
        )
    ]

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Aoede")
            )
        ),
        tools=tools,
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(disabled=True)
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        system_instruction=system_prompt,
    )

    try:
        async with client.aio.live.connect(model=MODEL_ID, config=config) as session:
            print(f"[SESSION] Started: {phone}")
            active_sessions[phone] = session
            executed_tool_calls    = set()

            async def sender():
                try:
                    while True:
                        item = await queue.get()

                        if item["type"] == "start":
                            await session.send_realtime_input(
                                activity_start=types.ActivityStart()
                            )

                        elif item["type"] == "end":
                            await websocket.send_json({"type": "ui", "state": "thinking"})
                            await session.send_realtime_input(
                                activity_end=types.ActivityEnd()
                            )
                            return

                        elif item["type"] == "audio":
                            try:
                                audio_bytes = base64.b64decode(item["data"])
                            except Exception:
                                continue
                            if len(audio_bytes) < 256:
                                continue
                            await session.send_realtime_input(
                                audio=types.Blob(
                                    data=audio_bytes,
                                    mime_type="audio/pcm;rate=16000",
                                )
                            )
                except asyncio.CancelledError:
                    pass

            async def _handle_detect_food(fc, session):
                if fc.id in executed_tool_calls:
                    return True
                executed_tool_calls.add(fc.id)

                clear_pending_food(phone)
                args      = fc.args
                meal_type = args.get("meal_type") or get_meal_type_from_hour(datetime.now(ZoneInfo("Asia/Kolkata")).hour)

                valid_meals = ["breakfast", "morning_snack", "lunch", "evening_snack", "dinner"]
                if meal_type not in valid_meals:
                    meal_type = get_meal_type_from_hour(datetime.now(ZoneInfo("Asia/Kolkata")).hour)

                await websocket.send_json({
                    "type":      "food_detected",
                    "meal_type": meal_type,
                    "items":     list(args.get("items", [])),
                    "total":     int(args.get("total", 0)),
                })
                print(f"[DETECT] food_detected sent: {args.get('items')}")

                await session.send_tool_response(
                    function_responses=[
                        types.FunctionResponse(
                            name="detect_food",
                            id=fc.id,
                            response={"result": "sent_for_confirmation"},
                        )
                    ]
                )
                return True

            async def receiver():
                user_transcript         = ""
                assistant_transcript    = ""
                tool_was_called         = False
                asked_quantity_question = False
                asked_meal_question     = False

                async def push_transcript(text: str, interim: bool = False):
                    nonlocal user_transcript
                    if not text:
                        return
                    if interim:
                        display = text
                    else:
                        user_transcript += text
                        display = user_transcript
                    print(f"[TRANSCRIPT{' INTERIM' if interim else ''}] {text}")
                    try:
                        await websocket.send_json({
                            "type": "transcript",
                            "text": display,
                            "interim": interim,
                        })
                    except Exception as e:
                        print(f"[WS TRANSCRIPT ERROR] {e}")

                try:
                    async for response in session.receive():

                        if response.tool_call:
                            for fc in response.tool_call.function_calls:
                                print(f"[TOOL] {fc.name} -> {fc.args}")
                                if fc.name == "detect_food":
                                    tool_was_called = await _handle_detect_food(fc, session)

                        sc = response.server_content
                        if not sc:
                            continue

                        if sc.model_turn:
                            for part in sc.model_turn.parts:

                                if hasattr(part, "text") and part.text:
                                    assistant_transcript += part.text
                                    text_lower = part.text.lower()

                                    if any(x in text_lower for x in [
                                        "small bowl", "medium bowl", "large bowl",
                                        "small cup", "large cup",
                                        "plate ah", "glass ah", "bowl ah", "cup ah",
                                        "evvalavu", "எவ்வளவு", "எத்தனை", "how many",
                                        "sariyana alavu", "சரியான அளவு",
                                    ]):
                                        asked_quantity_question = True
                                        print("[DETECT] Gemini asked quantity question")

                                    if any(x in text_lower for x in [
                                        "breakfast la", "lunch ah", "dinner ah",
                                        "breakfast ah", "lunch la", "dinner la",
                                        "காலை சாப்பாடா", "மதிய சாப்பாடா",
                                        "இரவு சாப்பாடா", "which meal",
                                        "morning ah", "evening ah",
                                    ]):
                                        asked_meal_question = True
                                        print("[DETECT] Gemini asked meal type question")

                                if part.inline_data:
                                    await websocket.send_json({"type": "ui", "state": "speaking"})
                                    b64 = base64.b64encode(part.inline_data.data).decode()
                                    await websocket.send_json({"type": "audio", "data": b64})

                                if hasattr(part, "function_call") and part.function_call:
                                    fc = part.function_call
                                    print(f"[TOOL in part] {fc.name}")
                                    if fc.name == "detect_food":
                                        tool_was_called = await _handle_detect_food(fc, session)

                        if sc.interim_input_transcription:
                            await push_transcript(
                                sc.interim_input_transcription.text or "",
                                interim=True,
                            )

                        if sc.input_transcription:
                            await push_transcript(
                                sc.input_transcription.text or "",
                                interim=False,
                            )

                        if sc.turn_complete:
                            t = user_transcript.strip()
                            append_conversation(phone, "user", t)
                            append_conversation(phone, "assistant", assistant_transcript.strip())
                            print(
                                f"[TURN COMPLETE] transcript='{t}' | "
                                f"tool={tool_was_called} | "
                                f"asked_qty={asked_quantity_question} | "
                                f"asked_meal={asked_meal_question}"
                            )

                            if not t:
                                await websocket.send_json({"type": "ui", "state": "ready"})
                                await websocket.send_json({"type": "control", "action": "gemini_done"})
                                return

                            # ── Camera/Gallery Intent Detection ──
                            camera_intent = is_camera_intent(t)
                            if camera_intent:
                                print(f"[CAMERA INTENT] Detected: {camera_intent}")
                                # Send speak message for TTS
                                await websocket.send_json({
                                    "type": "speak",
                                    "text": "Camera open panniten. Photo eduthu upload pannunga."
                                })
                                # Open camera
                                await websocket.send_json({
                                    "type": "control",
                                    "action": "open_camera"
                                })
                                return

                            if (
                                not tool_was_called
                                and asked_quantity_question
                                and is_food_message(t)
                                and not any(f in t.lower() for f in AUTO_SERVE_FOODS)
                            ):
                                set_pending_food(phone, t)
                                print(f"[PENDING SET] quantity requested for: '{t}'")

                            if (
                                not tool_was_called
                                and is_food_message(t)
                                and not has_specific_quantity(t)
                                and not any(f in t.lower() for f in AUTO_SERVE_FOODS)
                            ):
                                set_pending_food(phone, t)
                                print(f"[PENDING SET] vague/no quantity: '{t}'")

                            if (
                                not tool_was_called
                                and not asked_quantity_question
                                and not asked_meal_question
                            ):
                                pending       = get_pending_food(phone)
                                detected_meal = detect_meal_type_from_text(t)

                                if is_quantity_only_reply(t) and pending:
                                    combined = f"{pending} — {t}"
                                    clear_pending_food(phone)
                                    print(f"[FALLBACK] Combined: '{combined}'")
                                    asyncio.create_task(
                                        extract_calories_via_text(
                                            combined, websocket, phone,
                                            meal_type=detected_meal,
                                        )
                                    )

                                elif is_food_message(t):
                                    if pending and not has_specific_quantity(t):
                                        print("[FALLBACK] Still vague, keeping pending")
                                    else:
                                        combined = (
                                            f"{pending} — {t}"
                                            if pending and is_quantity_only_reply(t)
                                            else t
                                        )
                                        if pending:
                                            clear_pending_food(phone)
                                        print(f"[FALLBACK] Food message: '{combined}'")
                                        asyncio.create_task(
                                            extract_calories_via_text(
                                                combined, websocket, phone,
                                                meal_type=detected_meal,
                                            )
                                        )

                                else:
                                    print(f"[SKIP] Not food: '{t}'")

                            await websocket.send_json({"type": "ui", "state": "ready"})
                            await websocket.send_json({"type": "control", "action": "gemini_done"})
                            return

                except asyncio.CancelledError:
                    pass

            # NOTE: speak_drainer removed from here — it now runs at connection level
            await asyncio.gather(sender(), receiver())

    except asyncio.CancelledError:
        print(f"[SESSION] Cancelled: {phone}")
    except Exception as e:
        print(f"[SESSION ERROR] {e}")
        try:
            await websocket.send_json({"type": "error", "message": f"Voice session failed: {e}"})
            await websocket.send_json({"type": "ui", "state": "ready"})
        except Exception:
            pass
    finally:
        active_sessions.pop(phone, None)