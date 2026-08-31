import { prisma } from '../../db/prisma.js';
import { StorageService } from '../storage/storage.service.js';
import { PdfExtractor } from './pdf-extractor.js';
import { AiProviderFactory } from '../ai/ai.factory.js';
import {
  parsedPayslipSchema,
  confirmPayslipSchema,
  type ConfirmPayslipPayload,
  type ParsedPayslipData,
} from '../../../../shared/schemas/payslip.schema.js';
import { Decimal, roundCurrency } from '../../../../shared/money/decimal.js';

export class PayslipsService {
  /**
   * 1. Uploads PDF, extracts text, calls AI parser, and returns structured data for review.
   */
  static async uploadAndParse(
    userId: string,
    fileBuffer: Buffer,
    fileName: string,
    preferredProvider?: 'groq' | 'cerebras' | 'mock'
  ) {
    const fileHash = StorageService.calculateHash(fileBuffer);

    // Duplicate detection
    const existing = await prisma.payslip.findFirst({
      where: { userId, fileHash },
    });

    if (existing && existing.parsingStatus === 'CONFIRMED') {
      throw new Error(`This payslip has already been uploaded and confirmed (Week ${existing.periodStart.toISOString().substring(0, 10)})`);
    }

    // 1. Store file securely
    const storedFile = await StorageService.saveFile(userId, fileName, fileBuffer);

    // 2. Extract plain text from PDF
    const extractedDoc = await PdfExtractor.extractText(fileBuffer);

    // 3. AI Extraction
    const provider = AiProviderFactory.getProvider(preferredProvider);
    const parsedData = await provider.parsePayslipText(extractedDoc.text);

    // 4. Schema validation
    const validatedData = parsedPayslipSchema.parse(parsedData);

    // 5. Get active employment
    const activeEmployment = await prisma.employment.findFirst({
      where: { userId, isActive: true },
    });

    if (!activeEmployment) {
      throw new Error('No active employment found for user. Please set up employment first.');
    }

    // 6. Create initial unconfirmed Payslip record in database
    const periodStart = new Date(validatedData.payrollPeriod.startDate);
    const periodEnd = new Date(validatedData.payrollPeriod.endDate);

    const payslip = await prisma.payslip.create({
      data: {
        userId,
        employmentId: activeEmployment.id,
        filePath: storedFile.filePath,
        fileName: storedFile.fileName,
        fileSizeBytes: storedFile.fileSizeBytes,
        fileHash: storedFile.fileHash,
        parsingStatus: 'PARSED',
        periodStart,
        periodEnd,
        totalGross: validatedData.totals.totalGross,
        totalNet: validatedData.totals.totalNet,
        bankPayment: validatedData.totals.bankPayment,
        rawAiOutputJson: JSON.stringify(validatedData),
      },
    });

    return {
      payslipId: payslip.id,
      fileName: storedFile.fileName,
      parsingStatus: payslip.parsingStatus,
      extractedData: validatedData,
    };
  }

  /**
   * 2. User confirms reviewed/edited payslip data.
   */
  static async confirmPayslip(userId: string, payslipId: string, payload: ConfirmPayslipPayload) {
    const validatedPayload = confirmPayslipSchema.parse(payload);

    const payslip = await prisma.payslip.findFirst({
      where: { id: payslipId, userId },
      include: { employment: true },
    });

    if (!payslip) {
      throw new Error('Payslip not found or unauthorized');
    }

    const { payrollPeriod, totals, earnings, deductions, adjustments } = validatedPayload;
    const startDate = new Date(payrollPeriod.startDate);
    const endDate = new Date(payrollPeriod.endDate);

    // Find or create the corresponding PayrollWeek
    const payrollWeek = await prisma.payrollWeek.upsert({
      where: {
        userId_year_weekNumber: {
          userId,
          year: payrollPeriod.year,
          weekNumber: payrollPeriod.weekNumber,
        },
      },
      update: {
        startDate,
        endDate,
        status: 'PAID',
      },
      create: {
        userId,
        employmentId: payslip.employmentId,
        year: payrollPeriod.year,
        weekNumber: payrollPeriod.weekNumber,
        startDate,
        endDate,
        status: 'PAID',
      },
    });

    // Delete existing components if any
    await prisma.payslipComponent.deleteMany({ where: { payslipId } });

    // Create components
    const componentData: any[] = [];

    // Earnings
    for (const e of earnings) {
      componentData.push({
        payslipId,
        category: 'GROSS',
        code: e.code ?? e.category,
        name: e.name,
        baseAmount: e.hours ? e.hours * (e.rate ?? 0) : undefined,
        rate: e.rate,
        amount: e.amount,
      });
    }

    // Deductions
    for (const d of deductions) {
      componentData.push({
        payslipId,
        category: 'DEDUCTION',
        code: d.code ?? d.category,
        name: d.name,
        baseAmount: d.baseAmount,
        rate: d.ratePercentage,
        amount: d.amount,
      });
    }

    // Adjustments
    for (const a of adjustments) {
      componentData.push({
        payslipId,
        category: 'ADJUSTMENT',
        name: a.name,
        amount: a.amount,
      });
    }

    if (componentData.length > 0) {
      await prisma.payslipComponent.createMany({ data: componentData });
    }

    // Update Payslip record
    const updatedPayslip = await prisma.payslip.update({
      where: { id: payslipId },
      data: {
        payrollWeekId: payrollWeek.id,
        periodStart: startDate,
        periodEnd: endDate,
        totalGross: totals.totalGross,
        totalNet: totals.totalNet,
        bankPayment: totals.bankPayment,
        userEditedJson: JSON.stringify(validatedPayload),
        parsingStatus: 'CONFIRMED',
        confirmedAt: new Date(),
      },
      include: {
        components: true,
        payrollWeek: true,
      },
    });

    return updatedPayslip;
  }

  /**
   * 3. Reconciles Actual Payslip with PayTrack's Calculated Estimate for that week.
   */
  static async reconcilePayslip(userId: string, payslipId: string) {
    const payslip = await prisma.payslip.findFirst({
      where: { id: payslipId, userId },
      include: {
        components: true,
        payrollWeek: {
          include: {
            calculation: {
              include: { components: true },
            },
          },
        },
      },
    });

    if (!payslip) {
      throw new Error('Payslip not found or unauthorized');
    }

    const calc = payslip.payrollWeek?.calculation;

    const actual = {
      gross: new Decimal(payslip.totalGross.toString()),
      net: new Decimal(payslip.totalNet.toString()),
      bankPayment: new Decimal(payslip.bankPayment.toString()),
    };

    const estimate = calc
      ? {
          paidHours: calc.paidHours.toNumber(),
          gross: new Decimal(calc.totalGross.toString()),
          deductions: new Decimal(calc.totalPayrollDeductions.toString()),
          tax: new Decimal(calc.estimatedTax.toString()),
          net: new Decimal(calc.estimatedNet.toString()),
          bankPayment: new Decimal(calc.estimatedBankPayment.toString()),
        }
      : null;

    let variance = null;
    if (estimate) {
      const grossDiff = roundCurrency(actual.gross.minus(estimate.gross));
      const netDiff = roundCurrency(actual.net.minus(estimate.net));
      const bankPaymentDiff = roundCurrency(actual.bankPayment.minus(estimate.bankPayment));

      variance = {
        grossDifference: grossDiff.toNumber(),
        grossDifferencePercentage: estimate.gross.toNumber() > 0
          ? roundCurrency(grossDiff.dividedBy(estimate.gross).times(100)).toNumber()
          : 0,
        netDifference: netDiff.toNumber(),
        netDifferencePercentage: estimate.net.toNumber() > 0
          ? roundCurrency(netDiff.dividedBy(estimate.net).times(100)).toNumber()
          : 0,
        bankPaymentDifference: bankPaymentDiff.toNumber(),
        isMatch: bankPaymentDiff.abs().toNumber() < 0.05, // within cents rounding tolerance
      };
    }

    return {
      payslipId: payslip.id,
      weekNumber: payslip.payrollWeek?.weekNumber,
      year: payslip.payrollWeek?.year,
      actual: {
        gross: actual.gross.toNumber(),
        net: actual.net.toNumber(),
        bankPayment: actual.bankPayment.toNumber(),
        components: payslip.components,
      },
      estimate: estimate
        ? {
            ...estimate,
            gross: estimate.gross.toNumber(),
            deductions: estimate.deductions.toNumber(),
            tax: estimate.tax.toNumber(),
            net: estimate.net.toNumber(),
            bankPayment: estimate.bankPayment.toNumber(),
          }
        : null,
      variance,
    };
  }

  /**
   * Lists all payslips for user.
   */
  static async listPayslips(userId: string) {
    const payslips = await prisma.payslip.findMany({
      where: { userId },
      include: {
        payrollWeek: true,
      },
      orderBy: { periodStart: 'desc' },
    });
    return payslips;
  }

  /**
   * Retrieves single payslip with components.
   */
  static async getPayslip(userId: string, payslipId: string) {
    const payslip = await prisma.payslip.findFirst({
      where: { id: payslipId, userId },
      include: {
        components: true,
        payrollWeek: {
          include: { calculation: true },
        },
      },
    });

    if (!payslip) {
      throw new Error('Payslip not found or unauthorized');
    }

    return payslip;
  }

  /**
   * Deletes payslip and its stored PDF.
   */
  static async deletePayslip(userId: string, payslipId: string) {
    const payslip = await prisma.payslip.findFirst({
      where: { id: payslipId, userId },
    });

    if (!payslip) {
      throw new Error('Payslip not found or unauthorized');
    }

    await StorageService.deleteFile(payslip.filePath);
    await prisma.payslip.delete({ where: { id: payslipId } });

    return { success: true };
  }
}
