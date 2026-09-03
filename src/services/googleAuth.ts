import * as SecureStore from 'expo-secure-store';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// SecureStore Keys
export const SECURE_KEYS = {
  ACCESS_TOKEN: 'paytrack_gdrive_access_token',
  USER_EMAIL: 'paytrack_gdrive_user_email',
  BACKUP_PASSWORD: 'paytrack_backup_password',
  DRIVE_FILE_ID: 'paytrack_gdrive_file_id',
} as const;

// Drive Scope - strictly drive.appdata only
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

// Standard Google Sign-In status codes for graceful error handling
export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};

// Memory fallback for headless unit tests / environments without native keystore
const memoryStore: Record<string, string> = {};

export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    memoryStore[key] = value;
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    const val = await SecureStore.getItemAsync(key);
    if (val !== null && val !== undefined) return val;
    return memoryStore[key] ?? null;
  } catch {
    return memoryStore[key] ?? null;
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    delete memoryStore[key];
  }
}

/**
 * Returns configured Web Client ID from environment.
 * Used exclusively as serverClientId / webClientId in GoogleSignin.configure.
 */
export function getWebClientId(): string {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
}

let isConfigured = false;
let cachedGoogleSignin: any = null;
let moduleChecked = false;

/**
 * Checks if running inside Expo Go store client.
 * Expo Go does not contain custom native binaries like RNGoogleSignin.
 */
export function isRunningInExpoGo(): boolean {
  return Constants?.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/**
 * Safely resolves the GoogleSignin native module.
 * In Expo Go, this returns null to avoid crashing on TurboModuleRegistry.getEnforcing.
 * In standalone / dev clients or unit tests, it dynamically loads the module via ESM import.
 */
export async function getGoogleSignin(): Promise<any | null> {
  if (moduleChecked) {
    return cachedGoogleSignin;
  }

  // Under Expo Go, never attempt to load native GoogleSignin
  if (isRunningInExpoGo()) {
    moduleChecked = true;
    cachedGoogleSignin = null;
    return null;
  }

  try {
    const mod = await import('@react-native-google-signin/google-signin');
    cachedGoogleSignin = mod.GoogleSignin || (mod as any).default?.GoogleSignin;
    if (mod.statusCodes) {
      Object.assign(statusCodes, mod.statusCodes);
    }
  } catch (err) {
    cachedGoogleSignin = null;
  }

  moduleChecked = true;
  return cachedGoogleSignin;
}

/**
 * Indicates whether native Google Sign-In is supported in the current runtime environment.
 */
export async function isGoogleSigninAvailable(): Promise<boolean> {
  if (isRunningInExpoGo()) {
    return false;
  }
  return Boolean(await getGoogleSignin());
}

/**
 * Initializes Google Sign-In with Drive AppData scope and Web Client ID.
 */
export async function configureGoogleSignin(): Promise<void> {
  const GoogleSignin = await getGoogleSignin();
  if (!GoogleSignin) {
    return;
  }

  const webClientId = getWebClientId();
  try {
    GoogleSignin.configure({
      scopes: [GOOGLE_DRIVE_SCOPE],
      webClientId: webClientId || undefined,
      offlineAccess: true,
    });
    isConfigured = true;
  } catch (err) {
    console.warn('[GoogleAuth] Failed to configure GoogleSignin:', err);
  }
}

export interface AuthTokens {
  accessToken: string;
  userEmail?: string;
}

/**
 * Saves access token and user email to SecureStore.
 */
export async function saveAuthTokens(tokens: AuthTokens): Promise<void> {
  await setSecureItem(SECURE_KEYS.ACCESS_TOKEN, tokens.accessToken);
  if (tokens.userEmail) {
    await setSecureItem(SECURE_KEYS.USER_EMAIL, tokens.userEmail);
  }
}

/**
 * Clears all tokens and stored credentials (Logout).
 */
export async function clearAuthSession(): Promise<void> {
  const GoogleSignin = await getGoogleSignin();
  if (GoogleSignin) {
    try {
      await GoogleSignin.revokeAccess();
    } catch {
      // Ignore if not signed in or network unavailable
    }

    try {
      await GoogleSignin.signOut();
    } catch {
      // Ignore
    }
  }

  await deleteSecureItem(SECURE_KEYS.ACCESS_TOKEN);
  await deleteSecureItem(SECURE_KEYS.USER_EMAIL);
  await deleteSecureItem(SECURE_KEYS.BACKUP_PASSWORD);
  await deleteSecureItem(SECURE_KEYS.DRIVE_FILE_ID);
}

/**
 * Retrieves valid access token for Google Drive REST API.
 * Google Play Services manages token refresh silently in the background.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const GoogleSignin = await getGoogleSignin();
  if (GoogleSignin) {
    if (!isConfigured) {
      await configureGoogleSignin();
    }

    try {
      // GoogleSignin.getTokens() automatically uses refresh token via Play Services if expired
      const tokens = await GoogleSignin.getTokens();
      if (tokens && tokens.accessToken) {
        await setSecureItem(SECURE_KEYS.ACCESS_TOKEN, tokens.accessToken);
        return tokens.accessToken;
      }
    } catch {
      // Fall back to cached token in SecureStore (e.g. offline mode or test environment)
    }
  }

  return await getSecureItem(SECURE_KEYS.ACCESS_TOKEN);
}

/**
 * Initiates native Google Sign-In using Google Play Services.
 * Returns valid OAuth access token authorized for drive.appdata scope.
 */
export async function loginWithGoogle(): Promise<AuthTokens> {
  if (isRunningInExpoGo()) {
    throw new Error(
      'Google Sign-In is not supported inside Expo Go because it requires native Google Play Services binaries. Please create an Expo Development Build (npx expo run:android or EAS Build) to use native Google Drive backup.'
    );
  }

  const GoogleSignin = await getGoogleSignin();
  if (!GoogleSignin) {
    throw new Error('Google Sign-In native module is not available on this device.');
  }

  const webClientId = getWebClientId();
  if (!webClientId) {
    throw new Error(
      'Google Web Client ID is not configured. Please set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in your environment.'
    );
  }

  await configureGoogleSignin();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    let userEmail: string | undefined;
    if (response && 'data' in response && response.data?.user) {
      userEmail = response.data.user.email;
    } else if (response && 'user' in (response as any)) {
      userEmail = (response as any).user?.email;
    }

    // Retrieve OAuth access token for Google Drive REST API calls
    const tokens = await GoogleSignin.getTokens();
    if (!tokens || !tokens.accessToken) {
      throw new Error('Failed to retrieve OAuth access token from Google Play Services');
    }

    const authTokens: AuthTokens = {
      accessToken: tokens.accessToken,
      userEmail,
    };

    await saveAuthTokens(authTokens);
    return authTokens;
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Google Sign-In was cancelled by user');
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Google Sign-In is already in progress');
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services is not available or outdated on this device');
    }
    throw new Error(error.message || 'Google Sign-In failed');
  }
}
