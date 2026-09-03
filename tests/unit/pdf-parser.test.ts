import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parsePayslipDocument,
  parseDutchCurrencyOrNumber,
  parseHoursStringToDecimal,
  extractPdfText,
} from '../../src/payslips/parser';

describe('Deterministic Payslip PDF Parser', () => {
  it('should parse Dutch currency and numbers with commas, dots, and negative values', () => {
    expect(parseDutchCurrencyOrNumber('1.234,56')).toBe(1234.56);
    expect(parseDutchCurrencyOrNumber('556,54')).toBe(556.54);
    expect(parseDutchCurrencyOrNumber('€ 453,23')).toBe(453.23);
    expect(parseDutchCurrencyOrNumber('€14.99')).toBe(14.99);
    expect(parseDutchCurrencyOrNumber('-29,12')).toBe(-29.12);
    expect(parseDutchCurrencyOrNumber('-0,56')).toBe(-0.56);
    expect(parseDutchCurrencyOrNumber('')).toBeNull();
    expect(parseDutchCurrencyOrNumber('invalid')).toBeNull();
  });

  it('should parse hours string formats to decimal', () => {
    expect(parseHoursStringToDecimal('16:30')).toBe(16.5);
    expect(parseHoursStringToDecimal('40:00')).toBe(40.0);
    expect(parseHoursStringToDecimal('43:55')).toBeCloseTo(43.9167, 3);
    expect(parseHoursStringToDecimal('0:33')).toBeCloseTo(0.55, 2);
  });

  it('should deterministically parse real payslip loon_82022093 (Week 33)', () => {
    const filePath = path.resolve(process.cwd(), 'payslips(example)/loon_82022093 (1).pdf');
    const buffer = fs.readFileSync(filePath);
    const result = parsePayslipDocument(new Uint8Array(buffer));
    expect(result.success).toBe(true);
    expect(result.period.weekNumber).toBe(33);
    expect(result.period.year).toBe(2026);
    expect(result.period.startDate).toBe('2026-08-10');
    expect(result.period.endDate).toBe('2026-08-16');

    // Wage totals
    expect(result.wageDetails.totalGross).toBe(556.54);
    expect(result.wageDetails.totalNet).toBe(485.75);
    expect(result.wageDetails.bankPayout).toBe(453.23);

    // Hourly components
    expect(result.wageDetails.hourlyRate).toBe(14.99);
    expect(result.wageDetails.baseWage).toBe(247.33);
    expect(result.wageDetails.advAllowance).toBe(42.53);
    expect(result.wageDetails.holidayAllowance).toBe(41.82);

    // Deductions
    expect(result.wageDetails.stippPension).toBe(19.86);
    expect(result.wageDetails.totalTax).toBe(44.90); // 29.12 + 15.78
    expect(result.wageDetails.taxableGross).toBe(532.81);

    // Bank IBAN
    expect(result.wageDetails.bankIban).toContain('LT 49 3500 0100 1913 5214');

    // Employee & Employer
    expect(result.employee.name).toContain('De heer A. Ozer');
    expect(result.employee.employeeNumber).toBe('7695425');
    expect(result.employer.name).toBe('Carrière Personeelsdiensten B.V.');

    // Components array
    expect(result.components.length).toBeGreaterThan(5);
    const grossComp = result.components.find((c) => c.name.includes('normale uren'));
    expect(grossComp?.amount).toBe(247.33);
  });

  it('should deterministically parse real payslip loon_82149389 (Week 34)', () => {
    const filePath = path.resolve(process.cwd(), 'payslips(example)/loon_82149389 (1).pdf');
    const buffer = fs.readFileSync(filePath);
    const result = parsePayslipDocument(new Uint8Array(buffer));

    expect(result.success).toBe(true);
    expect(result.period.weekNumber).toBe(34);
    expect(result.period.year).toBe(2026);
    expect(result.period.startDate).toBe('2026-08-17');
    expect(result.period.endDate).toBe('2026-08-23');

    // Wage totals
    expect(result.wageDetails.totalGross).toBe(775.90);
    expect(result.wageDetails.totalNet).toBe(619.15);
    expect(result.wageDetails.bankPayout).toBe(589.90);

    // Hourly components
    expect(result.wageDetails.hourlyRate).toBe(14.99);
    expect(result.wageDetails.baseWage).toBe(658.31);
    expect(result.wageDetails.advAllowance).toBe(59.29);
    expect(result.wageDetails.holidayAllowance).toBe(58.30);

    // Deductions
    expect(result.wageDetails.stippPension).toBe(27.69);
    expect(result.wageDetails.totalTax).toBe(120.66); // 98.67 + 21.99
    expect(result.wageDetails.taxableGross).toBe(742.82);

    // Total hours worked
    expect(result.wageDetails.totalHoursWorked).toBeCloseTo(43.92, 1);
  });

  it('should handle invalid PDF data gracefully without throwing or making fake guesses', () => {
    const invalidData = new Uint8Array([1, 2, 3, 4, 5]);
    const result = parsePayslipDocument(invalidData);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid PDF format');
    expect(result.wageDetails.totalGross).toBeNull();
    expect(result.wageDetails.totalNet).toBeNull();
  });

  it('should detect scanned or image-only PDF without making fake guesses', () => {
    // Fake PDF with image XObject but no text streams
    const fakeImagePdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources << /XObject << /Im1 4 0 R >> >> >> endobj
4 0 obj << /Type /XObject /Subtype /Image /Width 100 /Height 100 >> stream
abc
endstream endobj
xref
trailer << /Root 1 0 R >>
%%EOF`;

    const extracted = extractPdfText(fakeImagePdf);
    expect(extracted.isScannedImage).toBe(true);
    expect(extracted.success).toBe(false);

    const parsed = parsePayslipDocument(fakeImagePdf);
    expect(parsed.success).toBe(false);
    expect(parsed.wageDetails.totalGross).toBeNull();
    expect(parsed.wageDetails.totalNet).toBeNull();
  });

  it('verifies that parser source code contains zero Node built-in imports', () => {
    const extractorPath = path.resolve(process.cwd(), 'src/payslips/parser/pdfTextExtractor.ts');
    const inflatePath = path.resolve(process.cwd(), 'src/payslips/parser/pureInflate.ts');
    const parserPath = path.resolve(process.cwd(), 'src/payslips/parser/dutchPayslipParser.ts');

    const extractorCode = fs.readFileSync(extractorPath, 'utf8');
    const inflateCode = fs.readFileSync(inflatePath, 'utf8');
    const parserCode = fs.readFileSync(parserPath, 'utf8');

    const forbidden = [
      /require\s*\(\s*['"]zlib['"]\s*\)/,
      /require\s*\(\s*['"]fs['"]\s*\)/,
      /require\s*\(\s*['"]path['"]\s*\)/,
      /require\s*\(\s*['"]stream['"]\s*\)/,
      /from\s+['"]zlib['"]/,
      /from\s+['"]fs['"]/,
      /from\s+['"]path['"]/,
      /from\s+['"]stream['"]/,
      /node:/,
    ];

    for (const pat of forbidden) {
      expect(pat.test(extractorCode)).toBe(false);
      expect(pat.test(inflateCode)).toBe(false);
      expect(pat.test(parserCode)).toBe(false);
    }
  });

  it('should parse real payslip from base64 string input (simulating FileSystemLegacy read)', () => {
    const filePath = path.resolve(process.cwd(), 'payslips(example)/loon_82022093 (1).pdf');
    const buffer = fs.readFileSync(filePath);
    const base64Str = buffer.toString('base64');

    const result = parsePayslipDocument(base64Str);
    expect(result.success).toBe(true);
    expect(result.period.weekNumber).toBe(33);
    expect(result.wageDetails.totalGross).toBe(556.54);
    expect(result.wageDetails.totalNet).toBe(485.75);
    expect(result.wageDetails.bankPayout).toBe(453.23);
  });

  it('should parse real payslip Week 34 from base64 string input', () => {
    const filePath = path.resolve(process.cwd(), 'payslips(example)/loon_82149389 (1).pdf');
    const buffer = fs.readFileSync(filePath);
    const base64Str = buffer.toString('base64');

    const result = parsePayslipDocument(base64Str);
    expect(result.success).toBe(true);
    expect(result.period.weekNumber).toBe(34);
    expect(result.wageDetails.totalGross).toBe(775.90);
    expect(result.wageDetails.totalNet).toBe(619.15);
    expect(result.wageDetails.bankPayout).toBe(589.90);
  });

  it('should handle completely empty input buffer or 0-byte file gracefully', () => {
    const empty = new Uint8Array(0);
    const result = parsePayslipDocument(empty);
    expect(result.success).toBe(false);
    expect(result.wageDetails.totalGross).toBeNull();
    expect(result.wageDetails.totalNet).toBeNull();
    expect(result.wageDetails.bankPayout).toBeNull();
  });


  it('verifies that payslips.tsx does not import deprecated or legacy methods', () => {
    const payslipScreenPath = path.resolve(process.cwd(), 'app/(tabs)/payslips.tsx');
    const screenCode = fs.readFileSync(payslipScreenPath, 'utf8');

    // Root import of expo-file-system should NOT be `* as FileSystem from 'expo-file-system'`
    expect(screenCode).not.toContain("import * as FileSystem from 'expo-file-system'");
    expect(screenCode).not.toContain("readAsStringAsync");
    expect(screenCode).not.toContain("expo-file-system/legacy");
    expect(screenCode).toContain("readLocalPdfFile");
  });
});



