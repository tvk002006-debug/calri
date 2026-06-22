from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()
from routes.auth import router as auth_router
from routes.user import router as user_router
from routes.voice import router as voice_router
from routes.dashboard import router as dashboard_router
from routes.suggestions_ai import router as suggestions_router
from routes.photos import router as photos_router
app = FastAPI()

app.include_router(
    auth_router,
    prefix="/auth",
    tags=["auth"]
)

app.include_router(
    user_router,
    prefix="/user",
    tags=["user"]
)

app.include_router(
    voice_router,
    tags=["voice"]
)

app.include_router(
    dashboard_router,
    prefix="/dashboard",
    tags=["dashboard"]
)

app.include_router(
    suggestions_router,
    prefix="/user",
    tags=["suggestions"]
)

app.include_router(
    photos_router,
    prefix="/photos",
    tags=["photos"]
)

@app.on_event("startup")
def startup_event():
    from database import mongo_client, redis_client
    try:
        mongo_client.admin.command('ping')
        print("[STARTUP] MongoDB connection established")
    except Exception as e:
        print(f"[STARTUP] MongoDB connection failed: {e}")
        
    try:
        redis_client.ping()
        print("[STARTUP] Redis connection established")
    except Exception as e:
        print(f"[STARTUP] Redis connection failed: {e}")

@app.get("/")
def root():
    return {
        "message": "Calorie AI Backend Running"
    }