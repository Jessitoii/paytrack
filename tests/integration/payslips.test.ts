import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildApp } from '../../server/src/app.js';
import { prisma } from '../../server/src/db/prisma.js';
import { PdfExtractor } from '../../server/src/modules/payslips/pdf-extractor.js';
import { calculateGrossPayroll, calculateNetPayroll } from '../../shared/payroll/engine.js';
import { CARRIERE_AH_PROFILE_2026 } from '../../shared/payroll/profiles.js';
import type { FastifyInstance } from 'fastify';

describe('AI Payslip Parsing, Review & Reconciliation Pipeline Integration Tests', () => {
  let app: FastifyInstance;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let employmentAId: string;
  let week33PdfBuffer: Buffer;
  let week34PdfBuffer: Buffer;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Read real sample payslips
    const sampleDir = path.resolve(process.cwd(), 'payslips(example)');
    week33PdfBuffer = await fs.readFile(path.join(sampleDir, 'loon_82022093 (1).pdf'));
    week34PdfBuffer = await fs.readFile(path.join(sampleDir, 'loon_82149389 (1).pdf'));

    // Clean up
    await prisma.payslipComponent.deleteMany();
    await prisma.payslip.deleteMany();
    await prisma.payrollCalculationComponent.deleteMany();
    await prisma.payrollCalculation.deleteMany();
    await prisma.payrollWeek.deleteMany();
    await prisma.employment.deleteMany();
    await prisma.employer.deleteMany();
    await prisma.user.deleteMany();

    // Create User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'workerA@paytrack.app', password: 'password123', name: 'Alper Ozer' },
    });
    const dataA = JSON.parse(resA.body);
    userAToken = dataA.token;
    userAId = dataA.user.id;

    // Create User B (for isolation tests)
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'workerB@paytrack.app', password: 'password123', name: 'Other User' },
    });
    userBToken = JSON.parse(resB.body).token;
    userBId = JSON.parse(resB.body).user.id;

    // Create Employer & Employment for User A
    const employer = await prisma.employer.create({
      data: { name: 'Albert Heijn B.V. Bleiswijk', agency: 'Carrière' },
    });

    const employment = await prisma.employment.create({
      data: {
        userId: userAId,
        employerId: employer.id,
        startDate: new Date('2026-01-01'),
        isActive: true,
      },
    });
    employmentAId = employment.id;

    // Pre-create an estimated PayrollWeek and PayrollCalculation for Week 34 for reconciliation testing
    const week34Gross = calculateGrossPayroll(
      [{ elapsedMinutes: 2635, unpaidBreakMinutes: 0, paidBreakMinutes: 0, paidMinutes: 2635, segments: [{ name: 'Base', rateMultiplier: 1.0, minutes: 2635, description: 'Normal' }] }],
      CARRIERE_AH_PROFILE_2026,
      { etExchangeAmount: 11.52 }
    );
    const week34Net = calculateNetPayroll(week34Gross, CARRIERE_AH_PROFILE_2026, {
      etExchangeAmount: 11.52,
      overridePensionBase: 369.18,
      overrideTaxAmount: 120.66,
    });

    const payrollWeek34 = await prisma.payrollWeek.create({
      data: {
        userId: userAId,
        employmentId: employmentAId,
        year: 2026,
        weekNumber: 34,
        startDate: new Date('2026-08-17'),
        endDate: new Date('2026-08-23'),
        status: 'ESTIMATED',
      },
    });

    await prisma.payrollCalculation.create({
      data: {
        payrollWeekId: payrollWeek34.id,
        configSnapshotJson: JSON.stringify(CARRIERE_AH_PROFILE_2026),
        paidMinutes: 2635,
        paidHours: week34Gross.paidHoursDecimal.toNumber(),
        baseHourlyRate: 14.99,
        baseGross: week34Gross.baseGross.toNumber(),
        advAllowance: week34Gross.advAllowance.toNumber(),
        holidayAllowance: week34Gross.holidayAllowance.toNumber(),
        holidayEntitlementAccrual: week34Gross.holidayEntitlementAccrual.toNumber(),
        holidayDaysExchange: week34Gross.holidayDaysExchange.toNumber(),
        etExchangeDeduction: week34Gross.etExchangeDeduction.toNumber(),
        totalGross: week34Gross.totalGross.toNumber(),
        pawwDeduction: 0.78,
        azvDeduction: 4.61,
        stippDeduction: 27.69,
        wgaDeduction: 3.01,
        totalPayrollDeductions: week34Net.totalPayrollDeductions.toNumber(),
        loonSv: week34Net.loonSv.toNumber(),
        estimatedTax: 120.66,
        taxAccuracy: 'ESTIMATED',
        netBeforeAdjustments: week34Net.netBeforeAdjustments.toNumber(),
        etExchangeReimbursement: 11.52,
        healthInsurance: 38.01,
        additionalInsurance: 2.76,
        estimatedNet: week34Net.estimatedNet.toNumber(),
        estimatedBankPayment: week34Net.estimatedBankPayment.toNumber(),
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('1. PDF Text Extraction Utility', () => {
    it('successfully extracts raw text and metadata from real Week 33 PDF', async () => {
      const extracted = await PdfExtractor.extractText(week33PdfBuffer);
      expect(extracted.text).toContain('Carriere Personeelsdiensten B.V.');
      expect(extracted.text).toContain('Week 33 (2026)');
      expect(extracted.text).toContain('Albert Heijn');
      expect(extracted.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('successfully extracts raw text and metadata from real Week 34 PDF', async () => {
      const extracted = await PdfExtractor.extractText(week34PdfBuffer);
      expect(extracted.text).toContain('Week 34 (2026)');
      expect(extracted.text).toContain('43:55');
      expect(extracted.text).toContain('589,90');
    });

    it('rejects empty buffer gracefully', async () => {
      await expect(PdfExtractor.extractText(Buffer.from(''))).rejects.toThrow('empty file buffer');
    });
  });

  describe('2. Payslip Upload & AI Parsing (POST /api/payslips/upload)', () => {
    let week34PayslipId: string;
    let extractedPayload: any;

    it('uploads Week 34 PDF, extracts text, calls AI parser and returns structured schema for review', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/payslips/upload',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          fileBase64: week34PdfBuffer.toString('base64'),
          fileName: 'loon_week34.pdf',
          provider: 'mock',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.parsingStatus).toBe('PARSED');
      expect(json.extractedData.payrollPeriod.weekNumber).toBe(34);
      expect(json.extractedData.totals.totalGross).toBe(775.90);
      expect(json.extractedData.totals.bankPayment).toBe(589.90);

      week34PayslipId = json.payslipId;
      extractedPayload = json.extractedData;
    });

    it('detects duplicate upload with matching file hash', async () => {
      // First confirm it
      await app.inject({
        method: 'POST',
        url: `/api/payslips/${week34PayslipId}/confirm`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: extractedPayload,
      });

      // Try re-uploading identical PDF
      const dupRes = await app.inject({
        method: 'POST',
        url: '/api/payslips/upload',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          fileBase64: week34PdfBuffer.toString('base64'),
          fileName: 'loon_week34_duplicate.pdf',
          provider: 'mock',
        },
      });

      expect(dupRes.statusCode).toBe(400);
      expect(JSON.parse(dupRes.body).message).toContain('already been uploaded and confirmed');
    });
  });

  describe('3. Payslip Review & Confirmation (POST /api/payslips/:id/confirm)', () => {
    it('confirms Week 33 payslip and stores granular line-item components and links PayrollWeek', async () => {
      // Upload Week 33
      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/payslips/upload',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          fileBase64: week33PdfBuffer.toString('base64'),
          fileName: 'loon_week33.pdf',
          provider: 'mock',
        },
      });

      const { payslipId, extractedData } = JSON.parse(uploadRes.body);

      // Confirm with reviewed payload
      const confirmRes = await app.inject({
        method: 'POST',
        url: `/api/payslips/${payslipId}/confirm`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: extractedData,
      });

      expect(confirmRes.statusCode).toBe(200);
      const json = JSON.parse(confirmRes.body);
      expect(json.payslip.parsingStatus).toBe('CONFIRMED');
      expect(json.payslip.payrollWeek.weekNumber).toBe(33);
      expect(json.payslip.components.length).toBeGreaterThan(0);

      // Check specific stored components
      const pawwComp = json.payslip.components.find((c: any) => c.name.includes('PAWW'));
      expect(pawwComp.amount).toBe('0.56');
    });
  });

  describe('4. Actual vs. Estimated Reconciliation (GET /api/payslips/:id/reconcile)', () => {
    it('compares confirmed Week 34 actual payslip with PayTrack calculated estimate and highlights match', async () => {
      const payslipsRes = await app.inject({
        method: 'GET',
        url: '/api/payslips',
        headers: { authorization: `Bearer ${userAToken}` },
      });
      const payslips = JSON.parse(payslipsRes.body).payslips;
      const week34Payslip = payslips.find((p: any) => p.payrollWeek.weekNumber === 34);

      const reconcileRes = await app.inject({
        method: 'GET',
        url: `/api/payslips/${week34Payslip.id}/reconcile`,
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(reconcileRes.statusCode).toBe(200);
      const json = JSON.parse(reconcileRes.body);
      expect(json.weekNumber).toBe(34);
      expect(json.actual.gross).toBe(775.90);
      expect(json.actual.bankPayment).toBe(589.90);
      expect(json.estimate.gross).toBe(775.93);
      expect(json.estimate.bankPayment).toBe(589.93);
      expect(json.variance.isMatch).toBe(true); // Within €0.03 cents variance
    });
  });

  describe('5. Payslip User Isolation', () => {
    it('User B cannot access User A uploaded payslips or reconciliation data', async () => {
      const payslipsRes = await app.inject({
        method: 'GET',
        url: '/api/payslips',
        headers: { authorization: `Bearer ${userAToken}` },
      });
      const payslipId = JSON.parse(payslipsRes.body).payslips[0].id;

      // User B tries to view
      const viewRes = await app.inject({
        method: 'GET',
        url: `/api/payslips/${payslipId}`,
        headers: { authorization: `Bearer ${userBToken}` },
      });
      expect(viewRes.statusCode).toBe(404);

      // User B tries to reconcile
      const reconcileRes = await app.inject({
        method: 'GET',
        url: `/api/payslips/${payslipId}/reconcile`,
        headers: { authorization: `Bearer ${userBToken}` },
      });
      expect(reconcileRes.statusCode).toBe(404);
    });
  });
});
