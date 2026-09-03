/**
 * Deterministic PDF Text Stream Extractor.
 * Pure TypeScript implementation that extracts text blocks and coordinates
 * from PDF documents without requiring native C++ or Node.js dependencies.
 * 100% compatible with React Native, Expo Go, Web, and Node.
 */

import { pureInflate } from './pureInflate';

export interface PdfToken {
  x: number;
  y: number;
  text: string;
}

export interface PdfExtractionResult {
  success: boolean;
  isScannedImage: boolean;
  rawText: string;
  lines: string[];
  tokens: PdfToken[];
  error?: string;
}

/**
 * Pure TypeScript Base64 to Uint8Array decoder.
 * Works across Hermes (React Native), Expo Go, Web, and Node without Node.js Buffer.
 */
export function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/\s/g, '');
  if (typeof atob !== 'undefined') {
    try {
      const binStr = atob(clean);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i) & 0xff;
      }
      return bytes;
    } catch (_) {
      // Fallback to manual decoding
    }
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const bytes: number[] = [];
  let i = 0;

  while (i < clean.length) {
    const enc1 = chars.indexOf(clean.charAt(i++));
    const enc2 = chars.indexOf(clean.charAt(i++));
    const enc3 = chars.indexOf(clean.charAt(i++));
    const enc4 = chars.indexOf(clean.charAt(i++));

    if (enc1 === -1 || enc2 === -1) break;

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes.push(chr1);
    if (enc3 !== 64 && enc3 !== -1) {
      bytes.push(chr2);
    }
    if (enc4 !== 64 && enc4 !== -1) {
      bytes.push(chr3);
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Converts a binary string to a Uint8Array.
 */
export function binaryStringToUint8Array(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Converts a Uint8Array to a binary string in chunks to prevent call stack overflow.
 */
export function uint8ArrayToBinaryString(bytes: Uint8Array): string {
  let str = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    str += String.fromCharCode.apply(null, chunk as any);
  }
  return str;
}

/**
 * Decodes PDF escaped octal characters and standard escape sequences.
 */
function decodePdfString(raw: string): string {
  // Replace octal sequences \ddd
  let str = raw.replace(/\\([0-7]{1,3})/g, (_, oct) => {
    const code = parseInt(oct, 8);
    // WinAnsi Euro symbol is 0x80 (128)
    if (code === 128) return '€';
    return String.fromCharCode(code);
  });

  // Replace standard escape sequences
  str = str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');

  // Handle WinAnsi 0x80 Euro sign in direct Latin1 bytes
  str = str.replace(/\x80/g, '€');

  return str;
}

/**
 * Extracts streams and text tokens from a PDF buffer (Uint8Array, ArrayBuffer, or base64 string).
 */
export function extractPdfText(input: Uint8Array | ArrayBuffer | string): PdfExtractionResult {
  let bytes: Uint8Array;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('%PDF')) {
      bytes = binaryStringToUint8Array(trimmed);
    } else {
      bytes = decodeBase64ToUint8Array(trimmed);
    }
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }

  console.log(`[PAYSLIP] Bytes loaded: ${bytes.length}`);

  if (bytes.length < 5) {
    return {
      success: false,
      isScannedImage: false,
      rawText: '',
      lines: [],
      tokens: [],
      error: 'Invalid PDF format: File is empty or truncated.',
    };
  }

  const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
  console.log(`[PAYSLIP] PDF header: ${header}`);
  if (!header.startsWith('%PDF')) {
    return {
      success: false,
      isScannedImage: false,
      rawText: '',
      lines: [],
      tokens: [],
      error: 'Invalid PDF format: %PDF header missing.',
    };
  }

  const binaryString = uint8ArrayToBinaryString(bytes);

  // Check if PDF contains scanned image objects
  const hasImages = /\/Subtype\s*\/Image/i.test(binaryString);

  // Match streams in the PDF
  const streamRegex = /<<([\s\S]*?)>>\s*stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match: RegExpExecArray | null;
  const tokens: PdfToken[] = [];
  let totalStreamsChecked = 0;
  let flateStreamsCount = 0;

  while ((match = streamRegex.exec(binaryString)) !== null) {
    totalStreamsChecked++;
    const streamHeader = match[1];
    let streamBody = match[2];

    // If stream is compressed with FlateDecode, decompress using pure TypeScript Inflate
    if (streamHeader.includes('/FlateDecode')) {
      flateStreamsCount++;
      try {
        const compressed = binaryStringToUint8Array(streamBody);
        const decompressed = pureInflate(compressed);
        streamBody = uint8ArrayToBinaryString(decompressed);
      } catch (_) {
        // Continue if decompression fails for image or binary object streams
      }
    }

    // Process text tokens inside the stream body
    const streamLines = streamBody.split(/[\r\n]+/);
    let curX = 0;
    let curY = 0;

    for (const line of streamLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Position matrix: a b c d x y Tm
      const tmMatch = /([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+([0-9\.\-]+)\s+Tm/.exec(trimmed);
      if (tmMatch) {
        curX = parseFloat(tmMatch[5]);
        curY = parseFloat(tmMatch[6]);
      }

      // Relative translate: x y Td or TD
      const tdMatch = /([0-9\.\-]+)\s+([0-9\.\-]+)\s+T[dD]/.exec(trimmed);
      if (tdMatch) {
        curX = parseFloat(tdMatch[1]);
        curY = parseFloat(tdMatch[2]);
      }

      // Text display: (text) Tj or ' or "
      const tjMatches = trimmed.matchAll(/\((.*?)(?<!\\)\)\s*(?:Tj|'|")/g);
      for (const tj of tjMatches) {
        const decoded = decodePdfString(tj[1]).trim();
        if (decoded) {
          tokens.push({ x: curX, y: curY, text: decoded });
        }
      }

      // TJ array: [ (text) -123 (text) ] TJ
      const tjArrayMatch = trimmed.match(/\[(.*?)\]\s*TJ/);
      if (tjArrayMatch) {
        const arrContent = tjArrayMatch[1];
        const partMatches = arrContent.matchAll(/\((.*?)(?<!\\)\)/g);
        const combined = Array.from(partMatches)
          .map((m) => decodePdfString(m[1]))
          .join('')
          .trim();
        if (combined) {
          tokens.push({ x: curX, y: curY, text: combined });
        }
      }
    }
  }

  console.log(`[PAYSLIP] PDF streams found: ${totalStreamsChecked}`);
  console.log(`[PAYSLIP] FlateDecode streams: ${flateStreamsCount}`);
  console.log(`[PAYSLIP] Text operators found: ${tokens.length}`);

  // Detect scanned image PDF
  if (tokens.length === 0) {
    if (hasImages) {
      return {
        success: false,
        isScannedImage: true,
        rawText: '',
        lines: [],
        tokens: [],
        error: 'Scanned or image-only PDF detected. Could not extract text without OCR.',
      };
    }
    return {
      success: false,
      isScannedImage: false,
      rawText: '',
      lines: [],
      tokens: [],
      error: 'No text objects or streams found in document.',
    };
  }

  // Group tokens into lines by Y coordinate (within tolerance of 3 points)
  const sortedTokens = [...tokens].sort((a, b) => {
    // Sort descending by Y (PDF Y=0 is bottom), then ascending by X
    if (Math.abs(b.y - a.y) > 3) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const lineGroups: { y: number; textParts: string[] }[] = [];
  for (const token of sortedTokens) {
    const existing = lineGroups.find((g) => Math.abs(g.y - token.y) <= 3);
    if (existing) {
      existing.textParts.push(token.text);
    } else {
      lineGroups.push({ y: token.y, textParts: [token.text] });
    }
  }

  const lines = lineGroups.map((g) => g.textParts.join('  ').trim());
  const rawText = lines.join('\n');

  console.log(`[PAYSLIP] Extracted text length: ${rawText.length}`);

  return {
    success: true,
    isScannedImage: false,
    rawText,
    lines,
    tokens,
  };
}
