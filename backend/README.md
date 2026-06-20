# Calorie Gemini Backend

A FastAPI backend for the Calorie Tracker app, handling authentication, user management, dashboard data, AI suggestions, and voice processing via WebSocket.

## Features

- User authentication with phone OTP
- Profile and goals management
- Daily/weekly/monthly dashboard data
- AI-powered suggestions using Google Gemini
- Real-time voice processing over WebSocket
- MongoDB for data storage
- Redis for caching and OTP storage

## Setup

1. Create a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. Set up environment variables. Copy `.env.example` to `.env` and add:

```env
GEMINI_KEY=your_gemini_api_key
MONGO_URL=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379
TWILIO_SID=your_twilio_sid
TWILIO_TOKEN=your_twilio_token
```

3. Run the backend:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Auth

- `POST /auth/send-otp` - Send OTP to phone
- `POST /auth/verify-otp` - Verify OTP and login

### User

- `GET /user/{phone}` - Get user profile
- `POST /user/{phone}/goals` - Set user goals
- `GET /user/{phone}/dashboard` - Get dashboard summary
- `GET /user/{phone}/weekly` - Get weekly logs
- `GET /user/{phone}/monthly` - Get monthly logs
- `GET /user/{phone}/goal-estimate` - Get goal estimates

### Dashboard

- `GET /dashboard/daily/{phone}` - Get daily dashboard
- `GET /dashboard/weekly/{phone}` - Get weekly dashboard
### AI Suggestions

- `GET /user/{phone}/ai-suggestions` - Get AI-powered insights

### Voice

- `WebSocket /ws` - Real-time voice processing

## Database Schema

- Users collection with profiles, goals, and logs
- Redis for temporary OTP and cache storage

## Notes

- Requires MongoDB and Redis running
- Gemini API key needed for AI features
- WebSocket handles audio streaming and AI responses
