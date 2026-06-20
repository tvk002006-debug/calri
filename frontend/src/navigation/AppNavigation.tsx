import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from '../screens/auth/LoginScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import OnboardingScreen from '../screens/auth/OnboardingScreen';
import DashboardScreen from '../screens/dashboard/Dashboard';

import { getSession } from '../utils/session';

const Stack = createNativeStackNavigator();

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
    checkSession();
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
