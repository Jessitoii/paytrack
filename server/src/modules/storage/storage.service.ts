import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export interface StoredFileMetadata {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  fileHash: string;
}

export class StorageService {
  private static uploadDir = path.resolve(process.cwd(), 'uploads', 'payslips');

  /**
   * Initializes uploads directory if it does not exist.
   */
  static async init() {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  /**
   * Calculates SHA-256 hash of a buffer.
   */
  static calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Saves a file securely to the uploads directory.
   */
  static async saveFile(userId: string, originalName: string, buffer: Buffer): Promise<StoredFileMetadata> {
    await this.init();

    const fileHash = this.calculateHash(buffer);
    const sanitizedExt = path.extname(originalName).toLowerCase() || '.pdf';
    const safeFileName = `${userId}_${Date.now()}_${fileHash.substring(0, 12)}${sanitizedExt}`;
    const destinationPath = path.join(this.uploadDir, safeFileName);

    // Prevent path traversal
    if (!destinationPath.startsWith(this.uploadDir)) {
      throw new Error('Invalid file storage path');
    }

    await fs.writeFile(destinationPath, buffer);

    return {
      filePath: destinationPath,
      fileName: originalName,
      fileSizeBytes: buffer.length,
      fileHash,
    };
  }

  /**
   * Reads a stored file buffer.
   */
  static async readFile(filePath: string): Promise<Buffer> {
    // Security check: ensure path is inside uploads directory
    if (!path.resolve(filePath).startsWith(this.uploadDir)) {
      throw new Error('Unauthorized file access path');
    }
    return fs.readFile(filePath);
  }

  /**
   * Deletes a stored file.
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      if (path.resolve(filePath).startsWith(this.uploadDir)) {
        await fs.unlink(filePath);
      }
    } catch {
      // Ignore if file already deleted
    }
  }
}
