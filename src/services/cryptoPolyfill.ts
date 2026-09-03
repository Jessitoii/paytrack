import * as Crypto from 'expo-crypto';

/**
 * Polyfills globalThis.crypto.getRandomValues with Expo's native CSPRNG implementation (expo-crypto).
 * This ensures full compatibility with Web Cryptography API standards and libraries (like @noble/hashes)
 * across React Native, Hermes, and Expo Development Builds.
 */
export function ensureCryptoPolyfill(): void {
  const g: any = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global;

  if (typeof g.crypto !== 'object' || g.crypto === null) {
    g.crypto = {};
  }

  if (typeof g.crypto.getRandomValues !== 'function') {
    g.crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
      if (!array) {
        throw new TypeError('Failed to execute getRandomValues: 1 argument required, but only 0 present.');
      }
      return Crypto.getRandomValues(array as any) as T;
    };
  }
}

// Auto-initialize immediately upon import
ensureCryptoPolyfill();
