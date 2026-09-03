/**
 * Robust Local PDF File Reader for Expo Go & React Native.
 * Bypasses Android Expo Go scoped sandbox restrictions by leveraging
 * React Native core binary streaming (XHR / fetch / blob) and Expo SDK 57 File API.
 */

import { File, Paths } from 'expo-file-system';
import { decodeBase64ToUint8Array } from './pdfTextExtractor';

export interface ReadFileResult {
  success: boolean;
  bytes: Uint8Array | null;
  readable: boolean;
  selectedUri: string;
  cachedUri: string | null;
  fileSize: number;
  fileName: string;
  mimeType: string;
  error?: string;
}

/**
 * Reads a local file URI via React Native's core XMLHttpRequest (arraybuffer).
 * This directly accesses Android file:// and content:// streams through OkHttp/ContentResolver
 * without triggering ExponentFileSystem's scoped experience permission rejection.
 */
function readUriViaXHR(uri: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === 'undefined') {
      return reject(new Error('XMLHttpRequest is not defined in this environment'));
    }

    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      try {
        const response = xhr.response;
        if (response instanceof ArrayBuffer) {
          resolve(new Uint8Array(response));
        } else if (response && response.byteLength !== undefined) {
          resolve(new Uint8Array(response));
        } else {
          reject(new Error('XHR did not return an ArrayBuffer response'));
        }
      } catch (err: any) {
        reject(err);
      }
    };
    xhr.onerror = () => {
      reject(new Error(`XHR network/file read error on ${uri}`));
    };
    xhr.ontimeout = () => {
      reject(new Error(`XHR timeout while reading ${uri}`));
    };

    xhr.open('GET', uri, true);
    xhr.responseType = 'arraybuffer';
    xhr.send(null);
  });
}

/**
 * Reads a local file URI via React Native's core fetch + Blob + FileReader API.
 */
async function readUriViaFetchBlob(uri: string): Promise<Uint8Array> {
  if (typeof fetch === 'undefined') {
    throw new Error('fetch is not defined in this environment');
  }

  const response = await fetch(uri);
  const blob = await response.blob();

  // Try direct arrayBuffer on blob or response if supported
  if (typeof (blob as any).arrayBuffer === 'function') {
    const ab = await (blob as any).arrayBuffer();
    return new Uint8Array(ab);
  }

  if (typeof (response as any).arrayBuffer === 'function') {
    try {
      const ab = await response.arrayBuffer();
      return new Uint8Array(ab);
    } catch (_) {}
  }

  // Fallback to FileReader data URL
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const res = reader.result;
          if (typeof res === 'string') {
            const commaIndex = res.indexOf(',');
            const base64 = commaIndex >= 0 ? res.substring(commaIndex + 1) : res;
            const bytes = decodeBase64ToUint8Array(base64);
            resolve(bytes);
          } else if (res instanceof ArrayBuffer) {
            resolve(new Uint8Array(res));
          } else {
            reject(new Error('FileReader did not return valid result'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('FileReader failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  throw new Error('Neither arrayBuffer nor FileReader available');
}

/**
 * Primary multi-tier document reader that reliably loads PDF bytes on Android Expo Go.
 */
export async function readLocalPdfFile(
  uri: string,
  fileName = 'document.pdf',
  declaredSize?: number,
  mimeType = 'application/pdf'
): Promise<ReadFileResult> {
  console.log(`[PAYSLIP] Selected URI: ${uri}`);
  console.log(`[PAYSLIP] File name: ${fileName}`);
  console.log(`[PAYSLIP] File size reported by picker: ${declaredSize ?? 'unknown'}`);
  console.log(`[PAYSLIP] MIME type: ${mimeType}`);

  let bytes: Uint8Array | null = null;
  let lastError: string | null = null;

  // Step 1: Try React Native core XHR with arraybuffer (most reliable on Android Expo Go)
  try {
    const xhrBytes = await readUriViaXHR(uri);
    if (xhrBytes && xhrBytes.byteLength > 0) {
      bytes = xhrBytes;
      console.log(`[PAYSLIP] Bytes loaded via core XHR: ${bytes.byteLength}`);
    }
  } catch (xhrErr: any) {
    lastError = xhrErr?.message || String(xhrErr);
    console.log(`[PAYSLIP] XHR read failed (${lastError}), trying fetch blob...`);
  }

  // Step 2: Try React Native core fetch + blob
  if (!bytes || bytes.byteLength === 0) {
    try {
      const fetchBytes = await readUriViaFetchBlob(uri);
      if (fetchBytes && fetchBytes.byteLength > 0) {
        bytes = fetchBytes;
        console.log(`[PAYSLIP] Bytes loaded via fetch blob: ${bytes.byteLength}`);
      }
    } catch (fetchErr: any) {
      lastError = fetchErr?.message || String(fetchErr);
      console.log(`[PAYSLIP] Fetch blob read failed (${lastError}), trying Expo File API...`);
    }
  }

  // Step 3: Try modern Expo SDK 57 File API
  if (!bytes || bytes.byteLength === 0) {
    try {
      const file = new File(uri);
      const fileBytes = await file.bytes();
      if (fileBytes && fileBytes.byteLength > 0) {
        bytes = fileBytes;
        console.log(`[PAYSLIP] Bytes loaded via Expo File.bytes(): ${bytes.byteLength}`);
      }
    } catch (fileErr: any) {
      lastError = fileErr?.message || String(fileErr);
      console.log(`[PAYSLIP] File.bytes() failed: ${lastError}`);
    }
  }

  // Verify bytes and header
  const isByteLoaded = !!bytes && bytes.byteLength >= 5;
  let isReadable = false;

  if (isByteLoaded && bytes) {
    const headerStr = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
    console.log(`[PAYSLIP] PDF header: ${headerStr}`);
    isReadable = headerStr.startsWith('%PDF');
  }

  console.log(`[PAYSLIP] File size: ${bytes?.byteLength ?? 0}`);
  console.log(`[PAYSLIP] Readable: ${isReadable}`);

  // Step 4: Copy to app-owned cache directory (Paths.cache) for persistent local reference
  let cachedUri: string | null = null;
  if (isReadable && bytes) {
    try {
      const safeName = `payslip_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9_\.-]/g, '_')}`;
      const cachedFile = new File(Paths.cache, safeName);
      cachedFile.write(bytes);
      cachedUri = cachedFile.uri;
      console.log(`[PAYSLIP] Cached URI: ${cachedUri}`);
    } catch (cacheErr: any) {
      console.log(`[PAYSLIP] Caching to Paths.cache skipped (${cacheErr.message}), proceeding with in-memory bytes`);
    }
  }

  if (!isReadable || !bytes) {
    return {
      success: false,
      bytes: null,
      readable: false,
      selectedUri: uri,
      cachedUri: null,
      fileSize: bytes?.byteLength ?? 0,
      fileName,
      mimeType,
      error: lastError || 'File could not be read or does not contain a valid %PDF header.',
    };
  }

  return {
    success: true,
    bytes,
    readable: true,
    selectedUri: uri,
    cachedUri,
    fileSize: bytes.byteLength,
    fileName,
    mimeType,
  };
}
