# pyrefly: ignore [missing-import]
from pymongo import MongoClient
import redis
import os
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://127.0.0.1:27017")
DB_NAME = os.getenv("DB_NAME", "calorie_ai")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

import certifi
mongo_client = MongoClient(MONGO_URL, tlsCAFile=certifi.where())

db = mongo_client[DB_NAME]

# collections
users_collection = db["users"]


redis_client = redis.from_url(
    REDIS_URL,
    decode_responses=True
)