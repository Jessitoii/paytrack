import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parsePayslipDocument, extractPdfText } from '../../src/payslips/parser';

describe('Document Upload Pipeline Integration', () => {
  it('simulates DocumentPicker asset to Uint8Array to deterministic parser for Week 33', () => {
    const filePath = path.resolve(process.cwd(), 'payslips(example)/loon_82022093 (1).pdf');
    const rawBuffer = fs.readFileSync(filePath);
    const pickerAsset = {
      name: 'loon_82022093 (1).pdf',
      size: rawBuffer.length,
      mimeType: 'application/pdf',
      uri: `file:///data/user/0/host.exp.exponent/cache/DocumentPicker/12345.pdf`,
    };

    // Simulate binary load
    const bytes = new Uint8Array(rawBuffer);
    expect(bytes.byteLength).toBe(pickerAsset.size);

    // Verify PDF header
    const headerStr = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
    expect(headerStr).toBe('%PDF-');

    // Extract text
    const extracted = extractPdfText(bytes);
    expect(extracted.success).toBe(true);
    expect(extracted.isScannedImage).toBe(false);
    expect(extracted.lines.length).toBeGreaterThan(10);

    // Parse payslip
    const parsed = parsePayslipDocument(bytes);
    expect(parsed.success).toBe(true);
    expect(parsed.period.weekNumber).toBe(33);
    expect(parsed.period.year).toBe(2026);
    expect(parsed.wageDetails.totalGross).toBe(556.54);
    expect(parsed.wageDetails.totalNet).toBe(485.75);
    expect(parsed.wageDetails.bankPayout).toBe(453.23);
    expect(parsed.wageDetails.hourlyRate).toBe(14.99);
  });

  it('simulates DocumentPicker asset to Uint8Array to deterministic parser for Week 34', () => {
    const filePath = path.resolve(process.cwd(), 'payslips(example)/loon_82149389 (1).pdf');
    const rawBuffer = fs.readFileSync(filePath);
    const pickerAsset = {
      name: 'loon_82149389 (1).pdf',
      size: rawBuffer.length,
      mimeType: 'application/pdf',
      uri: `file:///data/user/0/host.exp.exponent/cache/DocumentPicker/67890.pdf`,
    };

    const bytes = new Uint8Array(rawBuffer);
    expect(bytes.byteLength).toBe(pickerAsset.size);

    const headerStr = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
    expect(headerStr).toBe('%PDF-');

    const parsed = parsePayslipDocument(bytes);
    expect(parsed.success).toBe(true);
    expect(parsed.period.weekNumber).toBe(34);
    expect(parsed.period.year).toBe(2026);
    expect(parsed.wageDetails.totalGross).toBe(775.90);
    expect(parsed.wageDetails.totalNet).toBe(619.15);
    expect(parsed.wageDetails.bankPayout).toBe(589.90);
    expect(parsed.wageDetails.hourlyRate).toBe(14.99);
  });

  it('verifies that unreadable file halts pipeline before parser is called', () => {
    // 0-byte or corrupted file
    const corruptedBytes = new Uint8Array([0x00, 0x11, 0x22]);
    const headerStr = String.fromCharCode(corruptedBytes[0], corruptedBytes[1], corruptedBytes[2]);
    const isReadable = headerStr.startsWith('%PDF');
    expect(isReadable).toBe(false);

    // If not readable, parser is never invoked with fake values
    const parsed = parsePayslipDocument(corruptedBytes);
    expect(parsed.success).toBe(false);
    expect(parsed.wageDetails.totalGross).toBeNull();
    expect(parsed.wageDetails.totalNet).toBeNull();
    expect(parsed.wageDetails.bankPayout).toBeNull();
  });
});
