export const BACKUP_FILENAME = 'paytrack_encrypted_backup.bin';

export interface DriveFileMetadata {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

/**
 * Searches for existing paytrack_encrypted_backup.bin file inside appDataFolder.
 */
export async function findBackupFile(accessToken: string): Promise<DriveFileMetadata | null> {
  const query = encodeURIComponent(`name = '${BACKUP_FILENAME}' and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,size)`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to query Google Drive: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0] as DriveFileMetadata;
  }

  return null;
}

/**
 * Uploads initial backup file into appDataFolder using Google Drive multipart upload.
 */
export async function createBackupFile(accessToken: string, content: string): Promise<DriveFileMetadata> {
  const boundary = 'foo_bar_baz_paytrack_boundary_2026';
  const metadata = JSON.stringify({
    name: BACKUP_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/octet-stream',
  });

  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    delimiter +
    'Content-Type: application/octet-stream\r\n\r\n' +
    content +
    closeDelimiter;

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create file in Google Drive: ${res.status} ${errorText}`);
  }

  return (await res.json()) as DriveFileMetadata;
}

/**
 * Updates existing backup file in Google Drive using media upload.
 */
export async function updateBackupFile(
  accessToken: string,
  fileId: string,
  content: string
): Promise<DriveFileMetadata> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
    fileId
  )}?uploadType=media&fields=id,name,modifiedTime,size`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: content,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update backup file in Google Drive: ${res.status} ${errorText}`);
  }

  return (await res.json()) as DriveFileMetadata;
}

/**
 * Downloads the encrypted backup content from Google Drive.
 */
export async function downloadBackupFile(accessToken: string, fileId: string): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to download backup file from Google Drive: ${res.status} ${errorText}`);
  }

  return await res.text();
}

/**
 * Deletes backup file from Google Drive.
 */
export async function deleteBackupFile(accessToken: string, fileId: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`Failed to delete backup file from Google Drive: ${res.status} ${errorText}`);
  }
}
