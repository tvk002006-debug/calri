# Calorie Gemini React Native Frontend

A bare React Native app for calorie tracking with voice input, built with TypeScript.

## Features

- Phone OTP authentication
- Voice-powered calorie logging
- Daily/weekly/monthly dashboard views
- AI-powered health suggestions
- Real-time voice processing via WebSocket
- Native Android/iOS support

## Setup

1. Install dependencies:

```bash
npm install
```

2. For iOS (macOS only):

```bash
cd ios && pod install
```

## Running the App

1. Start Metro bundler:

```bash
npm start
```

2. Run on Android:

```bash
npm run android
```

3. Run on iOS:

```bash
npm run ios
```

## Configuration

Update `src/config/api.ts` with your backend URL:

```typescript
export const BASE_URL = 'http://your-backend-ip:8000';
export const BACKEND_WS = 'ws://your-backend-ip:8000/ws';
```

## Project Structure

```
frontend/
├── android/          # Android native code
├── ios/             # iOS native code
├── src/
│   ├── config/      # API configuration
│   ├── navigation/  # App navigation
│   ├── screens/     # Screen components
│   │   ├── auth/    # Login, OTP, Onboarding
│   │   └── dashboard/ # Main app screens
│   └── styles/      # Global styles
├── package.json
├── App.tsx          # App entry point
└── metro.config.js
```

## Dependencies

- React Native 0.85.3
- React Navigation for routing
- React Native Reanimated for animations
- React Native Live Audio Stream for voice input
- AsyncStorage for local storage

## Notes

- Backend must be running on port 8000
- Requires microphone permissions for voice input
- Tested on Android API 30+ and iOS 14+
