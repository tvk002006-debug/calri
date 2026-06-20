import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_KEY = 'NUVA_USER_SESSION';

export async function saveSession(data: any) {
  try {
    await AsyncStorage.setItem(
      USER_KEY,
      JSON.stringify(data)
    );
  } catch (e) {
    console.log('Save session error', e);
  }
}

export async function getSession() {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);

    if (!data) return null;

    return JSON.parse(data);
  } catch (e) {
    console.log('Get session error', e);
    return null;
  }
}

export async function clearSession() {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch (e) {
    console.log('Clear session error', e);
  }
}
