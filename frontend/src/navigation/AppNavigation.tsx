import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import DashboardScreen from '../screens/dashboard/Dashboard';

import { getSession } from '../utils/session';
import { BASE_URL } from '../config/api';

const Stack = createNativeStackNavigator();

// Ping backend immediately on startup to wake up Render free tier
const warmUpServer = () => {
  fetch(`${BASE_URL}/`)
    .then(() => console.log('[SERVER] Warmed up'))
    .catch(() => console.log('[SERVER] Wake-up ping failed (will retry on first request)'));
};

export default function AppNavigator() {

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  const checkSession = useCallback(async () => {
    try {
      const saved = await getSession();
      setSession(saved?.loggedIn ? saved : null);
    } catch (e) {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    warmUpServer(); // wake up Render server immediately on app open
    checkSession();

    const logoutSub = DeviceEventEmitter.addListener('logout', () => {
      setSession(null);
    });

    return () => {
      logoutSub.remove();
    };
  }, []);

  if (loading) return null;

  return (
    <NavigationContainer key={session?.loggedIn ? 'auth' : 'guest'}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>

        {session?.loggedIn ? (
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            initialParams={{ phone: session.phone }}
          />
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
          </>
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
}
