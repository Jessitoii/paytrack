import * as FileSystem from 'expo-file-system/legacy';
import { exportDatabaseToJson, importDatabaseFromJson, PayTrackBackup } from '../database/backup';
import { dbEvents } from '../database/events';
import { userRepository } from '../database/repositories/userRepository';
import {
  getValidAccessToken,
  getSecureItem,
  setSecureItem,
  SECURE_KEYS,
} from './googleAuth';
import {
  findBackupFile,
  createBackupFile,
  updateBackupFile,
  downloadBackupFile,
} from './googleDrive';
import {
  encryptPayload,
  decryptPayload,
  serializeVault,
  parseVault,
} from './encryption';

export type CloudSyncStatus =
  | 'not_connected'
  | 'connected'
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'error';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isUploading = false;
let hasPendingMutationDuringUpload = false;
let isInitialized = false;

/**
 * Saves safety backup of current database snapshot to local device storage before restore.
 */
export async function createPreRestoreSafetyBackup(): Promise<string | null> {
  try {
    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      return null;
    }

    const backupDir = `${docDir}safety_backups/`;
    const dirInfo = await FileSystem.getInfoAsync(backupDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
    }

    const currentSnapshot = await exportDatabaseToJson();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `${backupDir}safety_before_restore_${timestamp}.json`;

    await FileSystem.writeAsStringAsync(filePath, JSON.stringify(currentSnapshot, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return filePath;
  } catch (err) {
    console.warn('Could not create pre-restore safety backup to file system:', err);
    return null;
  }
}

/**
 * Executes cloud backup directly to Google Drive.
 */
export async function executeCloudBackup(
  customPassword?: string
): Promise<{ success: boolean; modifiedTime?: string; error?: string }> {
  const token = await getValidAccessToken();
  if (!token) {
    await userRepository.setSetting('cloud_backup_status', 'not_connected');
    return { success: false, error: 'Google Drive is not connected' };
  }

  const password = customPassword || (await getSecureItem(SECURE_KEYS.BACKUP_PASSWORD));
  if (!password) {
    await userRepository.setSetting('cloud_backup_status', 'connected');
    return { success: false, error: 'Backup password is not set' };
  }

  try {
    await userRepository.setSetting('cloud_backup_status', 'syncing');

    // 1. Export entire SQLite database to JSON snapshot
    const dbSnapshot = await exportDatabaseToJson();

    // 2. Encrypt with AES-256-GCM and PBKDF2-SHA256
    const vault = await encryptPayload(dbSnapshot, password);
    const serializedVault = serializeVault(vault);

    // 3. Locate existing file in Drive appDataFolder
    let fileId = await getSecureItem(SECURE_KEYS.DRIVE_FILE_ID);
    if (!fileId) {
      const existing = await findBackupFile(token);
      if (existing) {
        fileId = existing.id;
        await setSecureItem(SECURE_KEYS.DRIVE_FILE_ID, fileId);
      }
    }

    let result;
    if (fileId) {
      try {
        result = await updateBackupFile(token, fileId, serializedVault);
      } catch (err: any) {
        // If fileId is invalid or was deleted externally, create new
        if (err.message && err.message.includes('404')) {
          result = await createBackupFile(token, serializedVault);
          await setSecureItem(SECURE_KEYS.DRIVE_FILE_ID, result.id);
        } else {
          throw err;
        }
      }
    } else {
      result = await createBackupFile(token, serializedVault);
      await setSecureItem(SECURE_KEYS.DRIVE_FILE_ID, result.id);
    }

    const now = new Date().toISOString();
    await userRepository.setSetting('cloud_backup_status', 'synced');
    await userRepository.setSetting('last_cloud_backup_at', now);
    await userRepository.setSetting('last_cloud_backup_error', '');

    return { success: true, modifiedTime: result.modifiedTime || now };
  } catch (err: any) {
    console.error('Execute Cloud Backup failed:', err);
    await userRepository.setSetting('cloud_backup_status', 'pending');
    await userRepository.setSetting('last_cloud_backup_error', err.message || 'Backup failed');
    return { success: false, error: err.message || 'Backup failed' };
  }
}

/**
 * Enqueues a non-blocking cloud backup with debouncing and single-flight lock.
 */
export function enqueueCloudBackup(delayMs: number = 3000): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  // Mark status as pending immediately so UI reflects unsaved changes
  userRepository.setSetting('cloud_backup_status', 'pending').catch(() => {});

  debounceTimer = setTimeout(async () => {
    debounceTimer = null;

    if (isUploading) {
      hasPendingMutationDuringUpload = true;
      return;
    }

    isUploading = true;
    try {
      await executeCloudBackup();
    } catch (err) {
      console.warn('Enqueued cloud backup execution failed:', err);
    } finally {
      isUploading = false;
      if (hasPendingMutationDuringUpload) {
        hasPendingMutationDuringUpload = false;
        // Trigger latest snapshot wins
        enqueueCloudBackup(1000);
      }
    }
  }, delayMs);
}

/**
 * Downloads, verifies, decrypts and atomically restores database from Google Drive.
 */
export async function restoreFromCloud(
  password: string
): Promise<{ success: boolean; safetyBackupPath?: string | null }> {
  if (!password || password.trim().length === 0) {
    throw new Error('Backup password is required');
  }

  const token = await getValidAccessToken();
  if (!token) {
    throw new Error('Google Drive is not connected. Please connect your account first.');
  }

  // 1. Locate backup in Drive appDataFolder
  let fileId = await getSecureItem(SECURE_KEYS.DRIVE_FILE_ID);
  if (!fileId) {
    const file = await findBackupFile(token);
    if (!file) {
      throw new Error('No backup file found in Google Drive appDataFolder.');
    }
    fileId = file.id;
    await setSecureItem(SECURE_KEYS.DRIVE_FILE_ID, fileId);
  }

  // 2. Download encrypted backup payload
  const encryptedText = await downloadBackupFile(token, fileId);
  const vault = parseVault(encryptedText);

  // 3. Decrypt payload (Authentication tag verification happens here)
  const decryptedData = await decryptPayload<PayTrackBackup>(vault, password);

  // 4. Create pre-restore safety backup of current local DB
  const safetyBackupPath = await createPreRestoreSafetyBackup();

  // 5. Restore database atomically inside transaction
  await importDatabaseFromJson(decryptedData);

  // 6. Save verified password in SecureStore for future automatic backups
  await setSecureItem(SECURE_KEYS.BACKUP_PASSWORD, password);

  // 7. Emit database events to refresh UI
  dbEvents.emit('work_changed');
  dbEvents.emit('shifts_changed');
  dbEvents.emit('finance_changed');
  dbEvents.emit('payslips_changed');
  dbEvents.emit('settings_changed');

  // 8. Trigger immediate fresh backup to guarantee cloud is in sync
  await executeCloudBackup(password);

  return { success: true, safetyBackupPath };
}

/**
 * Initializes automatic mutation listener and checks for pending backups on app launch.
 */
export function initializeCloudBackupSync(): () => void {
  if (isInitialized) {
    return () => {};
  }
  isInitialized = true;

  // Check if there was an unfulfilled pending backup from a previous session
  userRepository.getSetting('cloud_backup_status', 'not_connected').then((status) => {
    if (status === 'pending') {
      enqueueCloudBackup(2000);
    }
  });

  // Subscribe to mutations
  const unsubWork = dbEvents.subscribe('work_changed', () => enqueueCloudBackup());
  const unsubShifts = dbEvents.subscribe('shifts_changed', () => enqueueCloudBackup());
  const unsubFinance = dbEvents.subscribe('finance_changed', () => enqueueCloudBackup());
  const unsubPayslips = dbEvents.subscribe('payslips_changed', () => enqueueCloudBackup());

  return () => {
    unsubWork();
    unsubShifts();
    unsubFinance();
    unsubPayslips();
    isInitialized = false;
  };
}
