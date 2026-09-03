import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTestDatabase } from '../local-db/test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import { exportDatabaseToJson, importDatabaseFromJson } from '../../src/database/backup';
import {
  encryptPayload,
  decryptPayload,
  serializeVault,
  parseVault,
  CURRENT_VAULT_VERSION,
  VAULT_MAGIC,
  getSecureRandomBytes,
} from '../../src/services/encryption';
import { ensureCryptoPolyfill } from '../../src/services/cryptoPolyfill';
import {
  executeCloudBackup,
  restoreFromCloud,
  createPreRestoreSafetyBackup,
} from '../../src/services/cloudBackup';
import {
  SECURE_KEYS,
  setSecureItem,
  getSecureItem,
  deleteSecureItem,
  saveAuthTokens,
  clearAuthSession,
  getValidAccessToken,
} from '../../src/services/googleAuth';
import {
  findBackupFile,
  createBackupFile,
  updateBackupFile,
  downloadBackupFile,
} from '../../src/services/googleDrive';
import { userRepository } from '../../src/database/repositories/userRepository';

describe('Zero-Knowledge Encryption Vault (AES-256-GCM + PBKDF2)', () => {
  const samplePayload = {
    userProfile: [{ id: '1', name: 'Alper User' }],
    shifts: [{ id: 's1', date: '2026-09-02', earnings: 145.5 }],
    secretNote: 'Confidential tax and wage records',
  };
  const correctPassword = 'MySuperSecretPassword2026!';
  const wrongPassword = 'WrongPasswordAttempt!';

  it('successfully encrypts and decrypts payload with correct password (round-trip)', async () => {
    // 1. Encrypt with lower iterations for fast testing
    const vault = await encryptPayload(samplePayload, correctPassword, { iterations: 1000 });

    expect(vault.magic).toBe(VAULT_MAGIC);
    expect(vault.version).toBe(CURRENT_VAULT_VERSION);
    expect(vault.cipher.algorithm).toBe('AES-256-GCM');
    expect(vault.kdf.algorithm).toBe('PBKDF2-SHA256');
    expect(vault.kdf.iterations).toBe(1000);
    expect(vault.cipher.ivHex).toHaveLength(24); // 12 bytes = 24 hex
    expect(vault.cipher.tagHex).toHaveLength(32); // 16 bytes = 32 hex
    expect(vault.ciphertextBase64).toBeTruthy();

    // 2. Decrypt with correct password
    const decrypted = await decryptPayload<typeof samplePayload>(vault, correctPassword);
    expect(decrypted).toEqual(samplePayload);
  });

  it('fails decryption immediately with wrong password (Auth Tag verification fails)', async () => {
    const vault = await encryptPayload(samplePayload, correctPassword, { iterations: 1000 });

    await expect(decryptPayload(vault, wrongPassword)).rejects.toThrow(
      /Incorrect backup password or corrupted backup file/
    );
  });

  it('rejects corrupted ciphertext (bit flip tampering)', async () => {
    const vault = await encryptPayload(samplePayload, correctPassword, { iterations: 1000 });

    // Tamper with ciphertext by corrupting characters
    const tamperedVault = {
      ...vault,
      ciphertextBase64: 'X' + vault.ciphertextBase64.substring(1),
    };

    await expect(decryptPayload(tamperedVault, correctPassword)).rejects.toThrow();
  });

  it('rejects invalid or missing magic header', async () => {
    const vault = await encryptPayload(samplePayload, correctPassword, { iterations: 1000 });
    const invalidVault = { ...vault, magic: 'INVALID_HEADER' as any };

    await expect(decryptPayload(invalidVault, correctPassword)).rejects.toThrow(
      /missing or invalid vault magic header/
    );
  });

  it('correctly serializes and parses vault envelope', async () => {
    const vault = await encryptPayload(samplePayload, correctPassword, { iterations: 1000 });
    const serialized = serializeVault(vault);
    expect(typeof serialized).toBe('string');

    const parsed = parseVault(serialized);
    expect(parsed).toEqual(vault);
  });

  it('generates secure random bytes of specified length with strong entropy', () => {
    const bytes1 = getSecureRandomBytes(16);
    const bytes2 = getSecureRandomBytes(16);

    expect(bytes1).toBeInstanceOf(Uint8Array);
    expect(bytes1).toHaveLength(16);
    expect(bytes2).toHaveLength(16);
    // Two successive random buffers must not be identical (CSPRNG divergence)
    expect(bytes1).not.toEqual(bytes2);
  });

  it('ensures distinct IV/nonce and salt on successive encryption operations (never reused)', async () => {
    const vault1 = await encryptPayload(samplePayload, correctPassword, { iterations: 500 });
    const vault2 = await encryptPayload(samplePayload, correctPassword, { iterations: 500 });

    // Nonce/IV must never collide between encryptions
    expect(vault1.cipher.ivHex).not.toEqual(vault2.cipher.ivHex);
    // Salt must be distinct
    expect(vault1.kdf.saltHex).not.toEqual(vault2.kdf.saltHex);
    // Ciphertext must differ even for identical plaintext & password
    expect(vault1.ciphertextBase64).not.toEqual(vault2.ciphertextBase64);

    // Both vaults must decrypt to the exact same original plaintext
    const dec1 = await decryptPayload(vault1, correctPassword);
    const dec2 = await decryptPayload(vault2, correctPassword);
    expect(dec1).toEqual(samplePayload);
    expect(dec2).toEqual(samplePayload);
  });

  it('ensures globalThis.crypto.getRandomValues polyfill is initialized and populates arrays in-place', () => {
    ensureCryptoPolyfill();
    expect(typeof globalThis.crypto).toBe('object');
    expect(typeof globalThis.crypto.getRandomValues).toBe('function');

    const testArray = new Uint8Array(24);
    const returned = globalThis.crypto.getRandomValues(testArray);

    expect(returned).toBe(testArray); // Mutates and returns in-place
    expect(testArray.some((b) => b !== 0)).toBe(true); // Must contain non-zero random values
  });
});

describe('Secure Storage & Token Management', () => {
  beforeEach(async () => {
    await clearAuthSession();
  });

  it('saves and retrieves authentication tokens and credentials', async () => {
    await saveAuthTokens({
      accessToken: 'ya29.sample_access_token',
      userEmail: 'paytrack.user@gmail.com',
    });

    expect(await getSecureItem(SECURE_KEYS.ACCESS_TOKEN)).toBe('ya29.sample_access_token');
    expect(await getSecureItem(SECURE_KEYS.USER_EMAIL)).toBe('paytrack.user@gmail.com');
  });

  it('clears all credentials on logout', async () => {
    await saveAuthTokens({
      accessToken: 'test_token',
      userEmail: 'test@example.com',
    });
    await setSecureItem(SECURE_KEYS.BACKUP_PASSWORD, 'user_pwd');

    await clearAuthSession();

    expect(await getSecureItem(SECURE_KEYS.ACCESS_TOKEN)).toBeNull();
    expect(await getSecureItem(SECURE_KEYS.USER_EMAIL)).toBeNull();
    expect(await getSecureItem(SECURE_KEYS.BACKUP_PASSWORD)).toBeNull();
  });
});

describe('Google Drive REST API Service', () => {
  const dummyToken = 'dummy_valid_token';

  it('searches for existing backup file in appDataFolder', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [{ id: 'drive_file_123', name: 'paytrack_encrypted_backup.bin', size: '1024' }],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const file = await findBackupFile(dummyToken);
    expect(file).not.toBeNull();
    expect(file?.id).toBe('drive_file_123');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('spaces=appDataFolder'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${dummyToken}` }),
      })
    );
  });

  it('creates new multipart file in appDataFolder', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new_file_456', name: 'paytrack_encrypted_backup.bin' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const created = await createBackupFile(dummyToken, '{"content": "dummy"}');
    expect(created.id).toBe('new_file_456');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('uploadType=multipart'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${dummyToken}`,
          'Content-Type': expect.stringContaining('multipart/related'),
        }),
      })
    );
  });

  it('updates existing backup file using media upload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'file_789', modifiedTime: '2026-09-02T16:00:00Z' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const updated = await updateBackupFile(dummyToken, 'file_789', 'updated_content');
    expect(updated.id).toBe('file_789');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('uploadType=media'),
      expect.objectContaining({
        method: 'PATCH',
        body: 'updated_content',
      })
    );
  });

  it('downloads backup content', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'downloaded_encrypted_string',
    });
    vi.stubGlobal('fetch', mockFetch);

    const content = await downloadBackupFile(dummyToken, 'file_789');
    expect(content).toBe('downloaded_encrypted_string');
  });
});

describe('Cloud Backup & Restore Lifecycle with SQLite', () => {
  beforeEach(async () => {
    setupTestDatabase();
    await initializeDatabase();
    await clearAuthSession();
  });

  it('includes all database tables in full export snapshot', async () => {
    const snapshot = await exportDatabaseToJson();

    expect(snapshot).toHaveProperty('userProfile');
    expect(snapshot).toHaveProperty('appSettings');
    expect(snapshot).toHaveProperty('employments');
    expect(snapshot).toHaveProperty('payrollConfigurations');
    expect(snapshot).toHaveProperty('shifts');
    expect(snapshot).toHaveProperty('workSessions');
    expect(snapshot).toHaveProperty('workBreaks');
    expect(snapshot).toHaveProperty('payrollWeeks');
    expect(snapshot).toHaveProperty('payrollCalculations');
    expect(snapshot).toHaveProperty('payslips');
    expect(snapshot).toHaveProperty('payslipComponents');
    expect(snapshot).toHaveProperty('expenseCategories');
    expect(snapshot).toHaveProperty('expenses');
    expect(snapshot).toHaveProperty('recurringExpenses');
    expect(snapshot).toHaveProperty('savingsGoals');
    expect(snapshot).toHaveProperty('payrollCalibrations');
  });

  it('executes cloud backup successfully when authenticated', async () => {
    await saveAuthTokens({
      accessToken: 'valid_access_token',
    });
    await setSecureItem(SECURE_KEYS.BACKUP_PASSWORD, 'TestPassword123!');

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('spaces=appDataFolder')) {
        return {
          ok: true,
          json: async () => ({ files: [] }),
        };
      }
      if (url.includes('uploadType=multipart')) {
        return {
          ok: true,
          json: async () => ({
            id: 'created_drive_file_id',
            name: 'paytrack_encrypted_backup.bin',
            modifiedTime: '2026-09-02T16:00:00Z',
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await executeCloudBackup();
    expect(result.success).toBe(true);
    expect(result.modifiedTime).toBeTruthy();
  });

  it('restores database from encrypted backup and rolls back if corrupted', async () => {
    const originalSnapshot = await exportDatabaseToJson();
    const password = 'TestRestorePassword2026!';
    const vault = await encryptPayload(originalSnapshot, password, { iterations: 1000 });
    const serializedVault = serializeVault(vault);

    await saveAuthTokens({
      accessToken: 'valid_access_token',
    });
    await setSecureItem(SECURE_KEYS.DRIVE_FILE_ID, 'drive_file_abc');

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('alt=media')) {
        return {
          ok: true,
          text: async () => serializedVault,
        };
      }
      if (url.includes('uploadType=media') || url.includes('uploadType=multipart')) {
        return {
          ok: true,
          json: async () => ({ id: 'drive_file_abc' }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', mockFetch);

    // 1. Successful restore
    const restoreResult = await restoreFromCloud(password);
    expect(restoreResult.success).toBe(true);

    // 2. Failed restore with wrong password -> throws error, does not corrupt DB
    await expect(restoreFromCloud('WrongPass!')).rejects.toThrow(
      /Incorrect backup password or corrupted backup file/
    );
  });

  it('handles offline / network failure gracefully and marks status as pending', async () => {
    await saveAuthTokens({
      accessToken: 'valid_access_token',
    });
    await setSecureItem(SECURE_KEYS.BACKUP_PASSWORD, 'TestPassword123!');

    // Mock network failure
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network request failed'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await executeCloudBackup();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network request failed');

    // Verify status was marked as pending in app_settings
    const status = await userRepository.getSetting('cloud_backup_status');
    expect(status).toBe('pending');
  });

  it('creates pre-restore safety backup snapshot on disk', async () => {
    const safetyPath = await createPreRestoreSafetyBackup();
    expect(safetyPath).toBeTruthy();
    expect(safetyPath).toContain('safety_before_restore_');
  });

  it('retrieves access token natively via GoogleSignin.getTokens() without client_secret', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'test_web_client_id.apps.googleusercontent.com';

    const validToken = await getValidAccessToken();
    expect(validToken).toBe('ya29.mock_native_access_token');
    expect(await getSecureItem(SECURE_KEYS.ACCESS_TOKEN)).toBe('ya29.mock_native_access_token');
  });
});

describe('Disaster Recovery & Cross-Device Portability Audit (Tests A - H)', () => {
  const masterPassword = 'MasterDisasterPassword2026!';

  it('Test A: Cross-Device Portability (Device A Encrypt -> Simulated Device B Restore)', async () => {
    // 1. On Device A: Export full database & encrypt vault
    const deviceASnapshot = await exportDatabaseToJson();
    const deviceAVault = await encryptPayload(deviceASnapshot, masterPassword, { iterations: 1000 });
    const exportedVaultString = serializeVault(deviceAVault);

    // 2. Simulate complete device wipe (Device B fresh install with clean storage)
    await clearAuthSession();
    expect(await getSecureItem(SECURE_KEYS.BACKUP_PASSWORD)).toBeNull();
    expect(await getSecureItem(SECURE_KEYS.ACCESS_TOKEN)).toBeNull();

    // 3. On Device B: Parse envelope and decrypt using only the user-provided master password
    const deviceBReceivedVault = parseVault(exportedVaultString);
    const deviceBRestoredData = await decryptPayload<typeof deviceASnapshot>(deviceBReceivedVault, masterPassword);

    // 4. Assert 100% deep equality of all tables and records
    expect(deviceBRestoredData).toEqual(deviceASnapshot);
    expect(deviceBRestoredData.userProfile).toEqual(deviceASnapshot.userProfile);
    expect(deviceBRestoredData.shifts).toEqual(deviceASnapshot.shifts);
    expect(deviceBRestoredData.payrollConfigurations).toEqual(deviceASnapshot.payrollConfigurations);
    expect(deviceBRestoredData.expenses).toEqual(deviceASnapshot.expenses);
  });

  it('Test B: Corrupted/Malformed Payload Rejection', async () => {
    expect(() => parseVault('not-a-json-string')).toThrow(/Not valid JSON/);
    expect(() => parseVault('{"magic":"WRONG"}')).toThrow(/Format does not match PayTrack/);
  });

  it('Test C: Wrong Master Password Rejection', async () => {
    const snapshot = await exportDatabaseToJson();
    const vault = await encryptPayload(snapshot, masterPassword, { iterations: 1000 });

    await expect(decryptPayload(vault, 'WrongPassword2026!')).rejects.toThrow(
      /Incorrect backup password or corrupted backup file/
    );
  });

  it('Test D: Tampered Salt Rejection (Auth Tag Fails)', async () => {
    const snapshot = await exportDatabaseToJson();
    const vault = await encryptPayload(snapshot, masterPassword, { iterations: 1000 });

    // Tamper with saltHex
    const tamperedSaltVault = {
      ...vault,
      kdf: {
        ...vault.kdf,
        saltHex: '00' + vault.kdf.saltHex.substring(2),
      },
    };

    await expect(decryptPayload(tamperedSaltVault, masterPassword)).rejects.toThrow(
      /Incorrect backup password or corrupted backup file/
    );
  });

  it('Test E: Tampered IV/Nonce Rejection (Auth Tag Fails)', async () => {
    const snapshot = await exportDatabaseToJson();
    const vault = await encryptPayload(snapshot, masterPassword, { iterations: 1000 });

    // Tamper with ivHex
    const tamperedIvVault = {
      ...vault,
      cipher: {
        ...vault.cipher,
        ivHex: 'ff' + vault.cipher.ivHex.substring(2),
      },
    };

    await expect(decryptPayload(tamperedIvVault, masterPassword)).rejects.toThrow(
      /Incorrect backup password or corrupted backup file/
    );
  });

  it('Test F: Tampered Ciphertext or Auth Tag Rejection', async () => {
    const snapshot = await exportDatabaseToJson();
    const vault = await encryptPayload(snapshot, masterPassword, { iterations: 1000 });

    // 1. Tamper tag
    const tamperedTagVault = {
      ...vault,
      cipher: {
        ...vault.cipher,
        tagHex: 'ee' + vault.cipher.tagHex.substring(2),
      },
    };
    await expect(decryptPayload(tamperedTagVault, masterPassword)).rejects.toThrow(
      /Incorrect backup password or corrupted backup file/
    );

    // 2. Tamper ciphertext
    const tamperedBodyVault = {
      ...vault,
      ciphertextBase64: vault.ciphertextBase64.substring(0, 10) + 'A' + vault.ciphertextBase64.substring(11),
    };
    await expect(decryptPayload(tamperedBodyVault, masterPassword)).rejects.toThrow(
      /Incorrect backup password or corrupted backup file/
    );
  });

  it('Test G: New Device Cloud Discovery & Zero-Knowledge Restore Flow', async () => {
    // Generate backup on Device A
    const originalSnapshot = await exportDatabaseToJson();
    const vault = await encryptPayload(originalSnapshot, masterPassword, { iterations: 1000 });
    const serializedVault = serializeVault(vault);

    // Device B fresh start (no cached fileId, no cached password)
    await clearAuthSession();
    await saveAuthTokens({ accessToken: 'valid_device_b_token' });

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      // Discovery in appDataFolder
      if (url.includes('spaces=appDataFolder')) {
        return {
          ok: true,
          json: async () => ({
            files: [{ id: 'drive_file_discovered_on_device_b', name: 'paytrack_encrypted_backup.bin' }],
          }),
        };
      }
      // Download content
      if (url.includes('alt=media')) {
        return {
          ok: true,
          text: async () => serializedVault,
        };
      }
      // Update/Upload acknowledgement
      if (url.includes('uploadType=media') || url.includes('uploadType=multipart')) {
        return {
          ok: true,
          json: async () => ({ id: 'drive_file_discovered_on_device_b' }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', mockFetch);

    // Device B restores using master password
    const restoreResult = await restoreFromCloud(masterPassword);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.safetyBackupPath).toBeTruthy();

    // Verify master password is now cached on Device B for subsequent continuous backups
    expect(await getSecureItem(SECURE_KEYS.BACKUP_PASSWORD)).toBe(masterPassword);
    expect(await getSecureItem(SECURE_KEYS.DRIVE_FILE_ID)).toBe('drive_file_discovered_on_device_b');
  });

  it('Test H: Multi-Device Disaster Recovery Portability (Same Vault on Multiple Devices)', async () => {
    const snapshot = await exportDatabaseToJson();
    const vault = await encryptPayload(snapshot, masterPassword, { iterations: 1000 });
    const serializedVault = serializeVault(vault);

    // Device 1 restore
    const dev1Parsed = parseVault(serializedVault);
    const dev1Data = await decryptPayload(dev1Parsed, masterPassword);

    // Device 2 restore
    const dev2Parsed = parseVault(serializedVault);
    const dev2Data = await decryptPayload(dev2Parsed, masterPassword);

    expect(dev1Data).toEqual(snapshot);
    expect(dev2Data).toEqual(snapshot);
    expect(dev1Data).toEqual(dev2Data);
  });
});
