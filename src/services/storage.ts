import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'paytrack_jwt_token';

let memoryToken: string | null = null;

export const secureStorage = {
  async saveToken(token: string): Promise<void> {
    memoryToken = token;
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch {
      // Fallback to memory
    }
  },

  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS !== 'web') {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) return token;
      }
    } catch {
      // Fallback to memory
    }
    return memoryToken;
  },

  async removeToken(): Promise<void> {
    memoryToken = null;
    try {
      if (Platform.OS !== 'web') {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch {
      // Fallback
    }
  },
};
