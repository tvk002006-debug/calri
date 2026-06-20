# CalorieTracker

A voice-first calorie tracking app built with React Native (bare), FastAPI, MongoDB, Redis, and Gemini AI.

---

## Tech Stack

| Layer      | Technology                                      |
| ---------- | ----------------------------------------------- |
| Mobile     | React Native 0.85.3 (bare, TypeScript)          |
| Navigation | React Navigation 7 (native-stack + bottom-tabs) |
| Animations | React Native Reanimated 4 + Worklets            |
| Gestures   | React Native Gesture Handler 2.31               |
| State      | Zustand                                         |
| Storage    | AsyncStorage                                    |
| Icons      | React Native Vector Icons (Ionicons)            |
| Audio      | React Native Live Audio Stream                  |
| HTTP       | Axios                                           |
| Backend    | FastAPI + Uvicorn                               |
| Database   | MongoDB (Motor async driver)                    |
| Cache      | Redis (OTP storage, session cache)              |
| Auth       | Phone OTP → JWT (python-jose)                   |
| SMS        | Twilio                                          |
| AI         | Google Gemini API                               |

---

## Theme

| Token           | Value     | Usage                       |
| --------------- | --------- | --------------------------- |
| `primary`       | `#F97316` | Buttons, active tabs, rings |
| `bgDark`        | `#1C1C1E` | App background              |
| `card`          | `#2C2C2E` | Cards, bottom sheet         |
| `cardAlt`       | `#3A3A3C` | Input fields                |
| `textPrimary`   | `#FFFFFF` | Headings                    |
| `textSecondary` | `#8E8E93` | Labels, hints               |
| `success`       | `#30D158` | Goal met                    |
| `danger`        | `#FF453A` | Over limit                  |

---

## Project Structure

```
CalorieTracker/
├── android/
├── ios/
├── src/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── routes/
├── frontend/
│   ├── package.json
│   ├── App.tsx
│   └── src/
├── docker-compose.yml
├── README.md
└── .gitignore
```

## Setup

### Prerequisites

- Node.js 18+
- Python 3.9+
- MongoDB
- Redis
- Android Studio (for Android)
- Xcode (for iOS)

### Backend Setup

1. Navigate to `backend/` folder
2. Create virtual environment: `python -m venv .venv`
3. Activate: `.venv\Scripts\activate` (Windows) or `source .venv/bin/activate` (Mac/Linux)
4. Install dependencies: `pip install -r requirements.txt`
5. Copy `.env.example` to `.env` and add your API keys
6. Run: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`

### Frontend Setup

1. Navigate to `frontend/` folder
2. Install dependencies: `npm install`
3. Start Metro: `npm start`
4. Run Android: `npm run android` or iOS: `npm run ios`

### Database

Use Docker Compose: `docker-compose up -d`

## Usage

- Start the backend and database
- Run the mobile app
- Register/login with phone OTP
- Use voice input to log calories
- View dashboard with daily/weekly/monthly stats

## Contributing

1. Fork the repo
2. Create feature branch
3. Commit changes
4. Push and create PR
   │ ├── api/
   │ │ ├── auth.ts # login, verify-otp, refresh
   │ │ ├── food.ts # search, log, delete
   │ │ └── gemini.ts # voice parse, suggestions
   │ ├── components/
   │ │ ├── CalorieRing.tsx # animated SVG progress ring
   │ │ ├── MacroCard.tsx # protein / carbs / fat card
   │ │ ├── FoodItem.tsx # swipeable food row
   │ │ └── BottomTabBar.tsx # custom tab bar with centre mic
   │ ├── navigation/
   │ │ ├── AppNavigator.tsx # root: Auth vs Main
   │ │ ├── AuthNavigator.tsx # Login → OTP → Onboarding
   │ │ └── TabNavigator.tsx # 5-tab bottom nav
   │ ├── screens/
   │ │ ├── auth/
   │ │ │ ├── LoginScreen.tsx
   │ │ │ ├── OtpScreen.tsx
   │ │ │ └── OnboardingScreen.tsx
   │ │ ├── home/
   │ │ │ └── HomeScreen.tsx
   │ │ ├── search/
   │ │ │ └── SearchScreen.tsx
   │ │ ├── meals/
   │ │ │ └── MealsScreen.tsx
   │ │ ├── voice/
   │ │ │ └── VoiceScreen.tsx
   │ │ └── profile/
   │ │ └── ProfileScreen.tsx
   │ ├── context/
   │ │ └── AuthContext.tsx
   │ ├── hooks/
   │ │ ├── useCalories.ts
   │ │ └── useVoice.ts
   │ ├── store/
   │ │ ├── authStore.ts
   │ │ └── foodStore.ts
   │ ├── theme.ts
   │ └── types.ts
   ├── backend/
   │ ├── routes/
   │ │ ├── auth.py # /send-otp, /verify-otp, /refresh
   │ │ ├── food.py # /food/search, /log, /logs
   │ │ └── gemini.py # /parse-voice, /suggestion
   │ ├── models/
   │ │ ├── user.py
   │ │ └── food_log.py
   │ ├── database.py # motor + redis setup
   │ ├── main.py
   │ └── .env
   └── App.tsx

```

---

## Screens & Flow

```

App launch
└── AuthNavigator (if not logged in)
├── LoginScreen → enter phone number
├── OtpScreen → 6-digit code (hardcoded: 123456 in dev)
└── OnboardingScreen → set goal / weight / age
└── TabNavigator (after login)
├── Home → calorie ring + macro cards + meals today
├── Search → text food search + barcode
├── [Centre] → mic button (Voice) / home button (other tabs)
├── Meals → breakfast / lunch / dinner / snacks
└── Profile → stats + goals + Gemini report

```

---

## Bottom Nav Behaviour

The centre button is context-aware:
- **On Home tab** → shows mic icon, opens voice sheet
- **On any other tab** → shows home icon, navigates back to Home

---

## Auth Flow

```

User enters phone number
→ POST /auth/send-otp
→ Backend generates 6-digit OTP
→ Stores in Redis with 5-min TTL
→ Sends via Twilio SMS

User enters OTP
→ POST /auth/verify-otp
→ Backend checks Redis
→ Returns JWT access token + refresh token
→ Stored in AsyncStorage

All API calls include Bearer token in headers

```

**Dev shortcut:** OTP is hardcoded as `123456` — no Twilio needed during development.

---

## Voice Flow

```

User holds mic button (VoiceScreen)
→ LiveAudioStream captures 16kHz PCM
→ Streamed to FastAPI WebSocket /ws/voice
→ Forwarded to Gemini Live API
→ Gemini responds with parsed food JSON
{ name, calories, protein, carbs, fat, quantity }
→ Confirm modal shown
→ On confirm → POST /food/log

````

---

## Setup

### Frontend

```bash
# Create project
npx @react-native-community/cli init CalorieTracker --version 0.85.3
cd CalorieTracker

# Navigation
npm i @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm i react-native-screens react-native-safe-area-context

# Animations + gestures
npm i react-native-reanimated react-native-worklets react-native-gesture-handler

# State + storage
npm i zustand @react-native-async-storage/async-storage

# Icons
npm i react-native-vector-icons
# Android: add to android/app/build.gradle:
#   apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"

# Audio
npm i react-native-live-audio-stream

# HTTP
npm i axios

# iOS only
cd ios && pod install && cd ..
````

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install fastapi uvicorn motor redis python-jose[cryptography] \
            twilio google-generativeai python-dotenv passlib bcrypt
```

### Environment variables

Create `backend/.env`:

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB=calorietracker

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=your_super_secret_key_here
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE=+1xxxxxxxxxx

GEMINI_KEY=your_gemini_api_key

# Set to true to skip Twilio and use hardcoded OTP 123456
DEV_MODE=true
```

### Run

```bash
# Backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (Android)
npx react-native run-android

# Frontend (iOS)
npx react-native run-ios
```

---

## API Endpoints

| Method | Path                         | Description                    |
| ------ | ---------------------------- | ------------------------------ |
| POST   | `/auth/send-otp`             | Send OTP to phone              |
| POST   | `/auth/verify-otp`           | Verify OTP, return JWT         |
| GET    | `/food/search?q=banana`      | Search food DB                 |
| POST   | `/food/log`                  | Log a food item                |
| GET    | `/food/logs?date=2026-05-06` | Get logs for date              |
| DELETE | `/food/log/{id}`             | Delete a log                   |
| POST   | `/gemini/parse-voice`        | Parse voice transcript to food |
| GET    | `/gemini/suggestion`         | Daily AI suggestion            |
| WS     | `/ws/voice`                  | Live audio → Gemini            |

---

## Build screens order

1. ✅ `LoginScreen` + `OtpScreen` (hardcoded OTP)
2. `OnboardingScreen`
3. `HomeScreen` (ring + macro cards)
4. `BottomTabBar` (custom with centre mic logic)
5. `SearchScreen`
6. `MealsScreen`
7. `VoiceScreen` (Gemini live)
8. `ProfileScreen`

---

## Notes

- Reanimated 4 requires New Architecture (enabled by default on RN 0.85)
- Add `react-native-worklets` as a separate install — it's now a peer dep of Reanimated 4
- Vector icons require the fonts.gradle line on Android and pod install on iOS
- MongoDB must be running before starting the backend
- Redis must be running for OTP storage (`redis-server`)
