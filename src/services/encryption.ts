import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils.js';
import * as Crypto from 'expo-crypto';
import { ensureCryptoPolyfill } from './cryptoPolyfill';

/**
 * Generates cryptographically secure random bytes using Expo's native CSPRNG (SecureRandom).
 */
export function getSecureRandomBytes(byteCount: number): Uint8Array {
  ensureCryptoPolyfill();
  const buffer = new Uint8Array(byteCount);
  return Crypto.getRandomValues(buffer);
}

export const VAULT_MAGIC = 'PAYTRACK_VAULT';
export const CURRENT_VAULT_VERSION = 1;
export const DEFAULT_PBKDF2_ITERATIONS = 100_000;

export interface PayTrackEncryptedVault {
  magic: 'PAYTRACK_VAULT';
  version: number;
  createdAt: string;
  appVersion: string;
  schemaVersion: number;
  kdf: {
    algorithm: 'PBKDF2-SHA256';
    iterations: number;
    saltHex: string;
  };
  cipher: {
    algorithm: 'AES-256-GCM';
    ivHex: string;
    tagHex: string;
  };
  ciphertextBase64: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a 256-bit key from a password and salt using PBKDF2-HMAC-SHA256.
 */
export function deriveKey(password: string, salt: Uint8Array, iterations: number = DEFAULT_PBKDF2_ITERATIONS): Uint8Array {
  if (!password || password.length < 4) {
    throw new Error('Backup password must be at least 4 characters long');
  }
  return pbkdf2(sha256, password, salt, { c: iterations, dkLen: 32 });
}

/**
 * Encrypts arbitrary JSON-serializable data with AES-256-GCM into a self-contained vault envelope.
 */
export async function encryptPayload(
  payload: any,
  password: string,
  options?: {
    appVersion?: string;
    schemaVersion?: number;
    iterations?: number;
  }
): Promise<PayTrackEncryptedVault> {
  if (!password || password.trim().length === 0) {
    throw new Error('Password is required for encryption');
  }

  const iterations = options?.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const salt = getSecureRandomBytes(16);
  const iv = getSecureRandomBytes(12);

  const key = deriveKey(password, salt, iterations);
  const jsonStr = JSON.stringify(payload);
  const plaintextBytes = utf8ToBytes(jsonStr);

  const cipher = gcm(key, iv);
  // Noble AES-GCM appends 16-byte authentication tag at the end
  const encryptedWithTag = cipher.encrypt(plaintextBytes);

  const tag = encryptedWithTag.slice(-16);
  const body = encryptedWithTag.slice(0, -16);

  return {
    magic: VAULT_MAGIC,
    version: CURRENT_VAULT_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: options?.appVersion ?? '1.0.0',
    schemaVersion: options?.schemaVersion ?? 4,
    kdf: {
      algorithm: 'PBKDF2-SHA256',
      iterations,
      saltHex: bytesToHex(salt),
    },
    cipher: {
      algorithm: 'AES-256-GCM',
      ivHex: bytesToHex(iv),
      tagHex: bytesToHex(tag),
    },
    ciphertextBase64: bytesToBase64(body),
  };
}

/**
 * Decrypts a vault envelope using the provided password.
 * Throws an error if the password is wrong, magic is invalid, or the data was corrupted.
 */
export async function decryptPayload<T = any>(vault: PayTrackEncryptedVault, password: string): Promise<T> {
  if (!vault || vault.magic !== VAULT_MAGIC) {
    throw new Error('Invalid backup file: missing or invalid vault magic header');
  }

  if (vault.version !== 1) {
    throw new Error(`Unsupported vault version: ${vault.version}. Please update PayTrack.`);
  }

  if (vault.kdf.algorithm !== 'PBKDF2-SHA256') {
    throw new Error(`Unsupported KDF algorithm: ${vault.kdf.algorithm}`);
  }

  if (vault.cipher.algorithm !== 'AES-256-GCM') {
    throw new Error(`Unsupported cipher algorithm: ${vault.cipher.algorithm}`);
  }

  const salt = hexToBytes(vault.kdf.saltHex);
  const iv = hexToBytes(vault.cipher.ivHex);
  const tag = hexToBytes(vault.cipher.tagHex);
  const body = base64ToBytes(vault.ciphertextBase64);

  const key = deriveKey(password, salt, vault.kdf.iterations);

  // Re-combine body + 16-byte tag for noble AES-GCM decrypt
  const combined = new Uint8Array(body.length + tag.length);
  combined.set(body, 0);
  combined.set(tag, body.length);

  try {
    const cipher = gcm(key, iv);
    const decryptedBytes = cipher.decrypt(combined);
    const jsonStr = bytesToUtf8(decryptedBytes);
    return JSON.parse(jsonStr) as T;
  } catch (err: any) {
    // If auth tag verification fails, noble throws 'aes-gcm: invalid tag'
    if (err.message && err.message.includes('tag')) {
      throw new Error('Incorrect backup password or corrupted backup file (Authentication Tag failed)');
    }
    throw new Error(`Decryption failed: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Serializes the vault object to a string for upload/saving.
 */
export function serializeVault(vault: PayTrackEncryptedVault): string {
  return JSON.stringify(vault, null, 2);
}

/**
 * Parses raw string/json into a validated PayTrackEncryptedVault.
 */
export function parseVault(rawText: string): PayTrackEncryptedVault {
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Corrupted backup file: Not valid JSON structure');
  }

  if (!parsed || parsed.magic !== VAULT_MAGIC || !parsed.cipher || !parsed.kdf || !parsed.ciphertextBase64) {
    throw new Error('Invalid backup file: Format does not match PayTrack encrypted vault');
  }

  return parsed as PayTrackEncryptedVault;
}
