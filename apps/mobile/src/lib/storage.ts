import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Storage: web → localStorage, native → expo-secure-store.
 * Matches Expo's official auth pattern: https://docs.expo.dev/router/advanced/authentication
 * SecureStore is included in Expo Go and persists across app restarts on iOS/Android.
 */

async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const storage = { getItemAsync, setItemAsync, deleteItemAsync };
