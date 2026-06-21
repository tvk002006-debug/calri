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


@app.get("/")
def root():
    return {
        "message": "Calorie AI Backend Running"
    }