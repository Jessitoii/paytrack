import { prisma } from '../../db/prisma.js';
import { z } from 'zod';
import { roundFinishDateTo5Minutes } from '../../../../shared/time/rounding.js';
import { calculateWorkSession } from '../../../../shared/time/periods.js';
import { calculateGrossPayroll, calculateNetPayroll } from '../../../../shared/payroll/engine.js';
import { CARRIERE_AH_PROFILE_2026 } from '../../../../shared/payroll/profiles.js';
import { Decimal } from '../../../../shared/money/decimal.js';
import type { TimeBreak } from '../../../../shared/types/time.js';
import type { PayrollProfile } from '../../../../shared/types/payroll.js';

export const startWorkSchema = z.object({
  shiftId: z.string().optional(),
  actualStart: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const breakInputSchema = z.object({
  type: z.enum(['PAID_15', 'UNPAID_30', 'PAID_15_EXTRA', 'CUSTOM']),
  durationMinutes: z.number().int().positive(),
  isPaid: z.boolean(),
  name: z.string().optional(),
});

export const finishWorkSchema = z.object({
  rawFinish: z.coerce.date().optional(),
  breaks: z.array(breakInputSchema).optional(),
  notes: z.string().optional(),
});

export const updateWorkSchema = z.object({
  shiftId: z.string().nullable().optional(),
  actualStart: z.coerce.date().optional(),
  rawFinish: z.coerce.date().nullable().optional(),
  breaks: z.array(breakInputSchema).optional(),
  status: z.enum(['WORKING', 'COMPLETED', 'EDITED', 'CANCELLED']).optional(),
  notes: z.string().nullable().optional(),
});

/**
 * Calculates ISO-8601 week number, year, Monday start date, and Sunday end date.
 */
function getISOWeekBounds(date: Date): { year: number; weekNumber: number; startDate: Date; endDate: Date } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();

  // Monday of this week
  const mon = new Date(date);
  const currentDay = mon.getDay() || 7;
  mon.setDate(mon.getDate() - currentDay + 1);
  mon.setHours(0, 0, 0, 0);

  // Sunday of this week
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);

  return { year, weekNumber, startDate: mon, endDate: sun };
}

export class WorkService {
  /**
   * Aggregates completed work sessions for the target week and updates live PayrollCalculation estimate.
   */
  static async aggregateWeeklyCalculation(userId: string, targetDate: Date) {
    const { year, weekNumber, startDate, endDate } = getISOWeekBounds(targetDate);

    // 1. Find active employment
    const employment = await prisma.employment.findFirst({
      where: { userId, isActive: true },
      include: {
        employer: true,
        payrollConfigurations: {
          where: {
            effectiveFromWeek: { lte: weekNumber },
            OR: [{ effectiveUntilWeek: null }, { effectiveUntilWeek: { gte: weekNumber } }],
          },
          orderBy: { effectiveFromWeek: 'desc' },
        },
      },
    });

    if (!employment) return null;

    // 2. Find or create PayrollWeek record
    const payrollWeek = await prisma.payrollWeek.upsert({
      where: {
        userId_year_weekNumber: { userId, year, weekNumber },
      },
      update: {
        startDate,
        endDate,
      },
      create: {
        userId,
        employmentId: employment.id,
        year,
        weekNumber,
        startDate,
        endDate,
        status: 'ESTIMATED',
      },
    });

    // 3. Find all completed/edited work sessions for this week
    const weekSessions = await prisma.workSession.findMany({
      where: {
        userId,
        status: { in: ['COMPLETED', 'EDITED'] },
        actualStart: { gte: startDate, lte: endDate },
        rawFinish: { not: null },
      },
      include: { breaks: true },
    });

    if (weekSessions.length === 0) {
      // Clean up estimate calculation if no sessions exist
      if (payrollWeek.status !== 'PAID') {
        await prisma.payrollCalculation.deleteMany({ where: { payrollWeekId: payrollWeek.id } });
      }
      return null;
    }

    // 4. Calculate individual session breakdowns
    const calculatedSessions = weekSessions.map((s) => {
      const domainBreaks: TimeBreak[] = s.breaks.map((b) => ({
        id: b.id,
        type: b.type.toLowerCase() as any,
        durationMinutes: b.durationMinutes,
        isPaid: b.isPaid,
        name: b.name ?? undefined,
      }));
      return calculateWorkSession(s.actualStart, s.rawFinish!, domainBreaks);
    });

    // 5. Select applicable payroll configuration profile (or default to 2026 Carriere profile)
    const configRecord = employment.payrollConfigurations[0];
    const profile: PayrollProfile = configRecord
      ? {
          id: configRecord.id,
          name: configRecord.name,
          employer: employment.employer?.name ?? 'Employer',
          agency: employment.employer?.agency ?? undefined,
          effectiveFromWeek: configRecord.effectiveFromWeek,
          effectiveUntilWeek: configRecord.effectiveUntilWeek ?? undefined,
          effectiveFromDate: configRecord.effectiveFromDate.toISOString().substring(0, 10),
          baseHourlyRate: configRecord.baseHourlyRate.toNumber(),
          advHourlyRate: configRecord.advHourlyRate ? configRecord.advHourlyRate.toNumber() : undefined,
          holidayAllowancePercentage: configRecord.holidayAllowancePercentage.toNumber(),
          holidayEntitlementPercentage: configRecord.holidayEntitlementPercentage.toNumber(),
          pawwRatePercentage: configRecord.pawwRatePercentage.toNumber(),
          azvRatePercentage: configRecord.azvRatePercentage.toNumber(),
          stippRatePercentage: configRecord.stippRatePercentage.toNumber(),
          wgaRatePercentage: configRecord.wgaRatePercentage.toNumber(),
          healthInsuranceWeekly: configRecord.healthInsuranceWeekly.toNumber(),
          additionalInsuranceWeekly: configRecord.additionalInsuranceWeekly.toNumber(),
          taxEstimationMode: configRecord.taxEstimationMode as any,
          estimatedTaxRatePercentage: configRecord.estimatedTaxRatePercentage ? configRecord.estimatedTaxRatePercentage.toNumber() : 18.0,
        }
      : CARRIERE_AH_PROFILE_2026;

    // 6. Run pure payroll calculation engine
    const gross = calculateGrossPayroll(calculatedSessions, profile);
    const net = calculateNetPayroll(gross, profile);

    const paww = net.payrollDeductions.find((d) => d.code === 'PAWW')?.amount ?? new Decimal(0);
    const azv = net.payrollDeductions.find((d) => d.code === 'AZV')?.amount ?? new Decimal(0);
    const stipp = net.payrollDeductions.find((d) => d.code === 'STIPP')?.amount ?? new Decimal(0);
    const wga = net.payrollDeductions.find((d) => d.code === 'WGA')?.amount ?? new Decimal(0);

    // 7. Upsert PayrollCalculation record linked to this PayrollWeek
    const calculation = await prisma.payrollCalculation.upsert({
      where: { payrollWeekId: payrollWeek.id },
      update: {
        configSnapshotJson: JSON.stringify(profile),
        paidMinutes: gross.paidMinutes,
        paidHours: gross.paidHoursDecimal.toNumber(),
        baseHourlyRate: profile.baseHourlyRate,
        baseGross: gross.baseGross.toNumber(),
        advAllowance: gross.advAllowance.toNumber(),
        holidayAllowance: gross.holidayAllowance.toNumber(),
        holidayEntitlementAccrual: gross.holidayEntitlementAccrual.toNumber(),
        holidayDaysExchange: gross.holidayDaysExchange.toNumber(),
        etExchangeDeduction: gross.etExchangeDeduction.toNumber(),
        totalGross: gross.totalGross.toNumber(),
        pawwDeduction: paww.toNumber(),
        azvDeduction: azv.toNumber(),
        stippDeduction: stipp.toNumber(),
        wgaDeduction: wga.toNumber(),
        totalPayrollDeductions: net.totalPayrollDeductions.toNumber(),
        loonSv: net.loonSv.toNumber(),
        estimatedTax: net.estimatedTax.toNumber(),
        taxAccuracy: net.taxAccuracy,
        netBeforeAdjustments: net.netBeforeAdjustments.toNumber(),
        etExchangeReimbursement: net.etExchangeReimbursement.toNumber(),
        healthInsurance: net.healthInsurance.toNumber(),
        additionalInsurance: net.additionalInsurance.toNumber(),
        estimatedNet: net.estimatedNet.toNumber(),
        estimatedBankPayment: net.estimatedBankPayment.toNumber(),
      },
      create: {
        payrollWeekId: payrollWeek.id,
        configSnapshotJson: JSON.stringify(profile),
        paidMinutes: gross.paidMinutes,
        paidHours: gross.paidHoursDecimal.toNumber(),
        baseHourlyRate: profile.baseHourlyRate,
        baseGross: gross.baseGross.toNumber(),
        advAllowance: gross.advAllowance.toNumber(),
        holidayAllowance: gross.holidayAllowance.toNumber(),
        holidayEntitlementAccrual: gross.holidayEntitlementAccrual.toNumber(),
        holidayDaysExchange: gross.holidayDaysExchange.toNumber(),
        etExchangeDeduction: gross.etExchangeDeduction.toNumber(),
        totalGross: gross.totalGross.toNumber(),
        pawwDeduction: paww.toNumber(),
        azvDeduction: azv.toNumber(),
        stippDeduction: stipp.toNumber(),
        wgaDeduction: wga.toNumber(),
        totalPayrollDeductions: net.totalPayrollDeductions.toNumber(),
        loonSv: net.loonSv.toNumber(),
        estimatedTax: net.estimatedTax.toNumber(),
        taxAccuracy: net.taxAccuracy,
        netBeforeAdjustments: net.netBeforeAdjustments.toNumber(),
        etExchangeReimbursement: net.etExchangeReimbursement.toNumber(),
        healthInsurance: net.healthInsurance.toNumber(),
        additionalInsurance: net.additionalInsurance.toNumber(),
        estimatedNet: net.estimatedNet.toNumber(),
        estimatedBankPayment: net.estimatedBankPayment.toNumber(),
      },
    });

    return {
      payrollWeek,
      calculation,
    };
  }

  /**
   * 1-Tap Start Work.
   */
  static async startWork(userId: string, input: z.infer<typeof startWorkSchema>) {
    const actualStart = input.actualStart ?? new Date();

    const session = await prisma.workSession.create({
      data: {
        userId,
        shiftId: input.shiftId,
        actualStart,
        status: 'WORKING',
        notes: input.notes,
        isManualEntry: input.actualStart !== undefined,
      },
      include: {
        breaks: true,
        shift: true,
      },
    });

    return session;
  }

  /**
   * 1-Tap Finish Work with 5-minute upward rounding & deterministic break calculation.
   */
  static async finishWork(userId: string, sessionId: string, input: z.infer<typeof finishWorkSchema>) {
    const session = await prisma.workSession.findFirst({
      where: { id: sessionId, userId },
      include: { breaks: true },
    });

    if (!session) {
      throw new Error('Work session not found or unauthorized');
    }

    const rawFinish = input.rawFinish ?? new Date();
    const roundedFinish = roundFinishDateTo5Minutes(rawFinish);

    // If breaks provided in finish payload, replace or add them
    if (input.breaks && input.breaks.length > 0) {
      await prisma.workBreak.deleteMany({ where: { workSessionId: sessionId } });
      await prisma.workBreak.createMany({
        data: input.breaks.map((b) => ({
          workSessionId: sessionId,
          type: b.type,
          durationMinutes: b.durationMinutes,
          isPaid: b.isPaid,
          name: b.name,
        })),
      });
    }

    // Retrieve active breaks for calculation
    const allBreaks = await prisma.workBreak.findMany({ where: { workSessionId: sessionId } });
    const domainBreaks: TimeBreak[] = allBreaks.map((b) => ({
      id: b.id,
      type: b.type.toLowerCase() as any,
      durationMinutes: b.durationMinutes,
      isPaid: b.isPaid,
      name: b.name ?? undefined,
    }));

    // Calculate deterministic session metrics using shared calculation engine
    const calculation = calculateWorkSession(session.actualStart, rawFinish, domainBreaks);

    const updated = await prisma.workSession.update({
      where: { id: sessionId },
      data: {
        rawFinish,
        roundedFinish,
        elapsedMinutes: calculation.elapsedMinutes,
        paidMinutes: calculation.paidMinutes,
        status: 'COMPLETED',
        notes: input.notes ?? session.notes,
      },
      include: {
        breaks: true,
        shift: true,
      },
    });

    // Trigger Live Weekly Estimate Aggregation in background/synchronously
    await this.aggregateWeeklyCalculation(userId, session.actualStart);

    return {
      session: updated,
      calculation,
    };
  }

  /**
   * Update work session with automatic recalculation of derived cache fields and weekly aggregation.
   */
  static async updateWork(userId: string, sessionId: string, input: z.infer<typeof updateWorkSchema>) {
    const session = await prisma.workSession.findFirst({
      where: { id: sessionId, userId },
      include: { breaks: true },
    });

    if (!session) {
      throw new Error('Work session not found or unauthorized');
    }

    const actualStart = input.actualStart ?? session.actualStart;
    const rawFinish = input.rawFinish !== undefined ? input.rawFinish : session.rawFinish;
    const roundedFinish = rawFinish ? roundFinishDateTo5Minutes(rawFinish) : null;

    if (input.breaks) {
      await prisma.workBreak.deleteMany({ where: { workSessionId: sessionId } });
      await prisma.workBreak.createMany({
        data: input.breaks.map((b) => ({
          workSessionId: sessionId,
          type: b.type,
          durationMinutes: b.durationMinutes,
          isPaid: b.isPaid,
          name: b.name,
        })),
      });
    }

    const allBreaks = await prisma.workBreak.findMany({ where: { workSessionId: sessionId } });
    const domainBreaks: TimeBreak[] = allBreaks.map((b) => ({
      id: b.id,
      type: b.type.toLowerCase() as any,
      durationMinutes: b.durationMinutes,
      isPaid: b.isPaid,
      name: b.name ?? undefined,
    }));

    let elapsedMinutes = 0;
    let paidMinutes = 0;
    let calculation = null;

    if (rawFinish) {
      calculation = calculateWorkSession(actualStart, rawFinish, domainBreaks);
      elapsedMinutes = calculation.elapsedMinutes;
      paidMinutes = calculation.paidMinutes;
    }

    const updated = await prisma.workSession.update({
      where: { id: sessionId },
      data: {
        shiftId: input.shiftId !== undefined ? input.shiftId : session.shiftId,
        actualStart,
        rawFinish,
        roundedFinish,
        elapsedMinutes,
        paidMinutes,
        status: input.status ?? (rawFinish ? 'EDITED' : session.status),
        isManualEntry: true,
        notes: input.notes !== undefined ? input.notes : session.notes,
      },
      include: {
        breaks: true,
        shift: true,
      },
    });

    // Trigger Live Weekly Estimate Aggregation
    await this.aggregateWeeklyCalculation(userId, actualStart);

    return {
      session: updated,
      calculation,
    };
  }

  /**
   * List work sessions with optional filters.
   */
  static async listWorkSessions(
    userId: string,
    filters?: { startDate?: Date; endDate?: Date; status?: string }
  ) {
    const where: any = { userId };

    if (filters?.startDate || filters?.endDate) {
      where.actualStart = {};
      if (filters.startDate) where.actualStart.gte = filters.startDate;
      if (filters.endDate) where.actualStart.lte = filters.endDate;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const sessions = await prisma.workSession.findMany({
      where,
      include: {
        breaks: true,
        shift: true,
      },
      orderBy: { actualStart: 'desc' },
    });

    return sessions;
  }

  /**
   * Get single work session with full calculation breakdown.
   */
  static async getWorkSession(userId: string, sessionId: string) {
    const session = await prisma.workSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        breaks: true,
        shift: true,
      },
    });

    if (!session) {
      throw new Error('Work session not found or unauthorized');
    }

    let calculation = null;
    if (session.rawFinish) {
      const domainBreaks: TimeBreak[] = session.breaks.map((b) => ({
        id: b.id,
        type: b.type.toLowerCase() as any,
        durationMinutes: b.durationMinutes,
        isPaid: b.isPaid,
        name: b.name ?? undefined,
      }));
      calculation = calculateWorkSession(session.actualStart, session.rawFinish, domainBreaks);
    }

    return {
      session,
      calculation,
    };
  }

  /**
   * Delete work session.
   */
  static async deleteWorkSession(userId: string, sessionId: string) {
    const session = await prisma.workSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Work session not found or unauthorized');
    }

    await prisma.workSession.delete({
      where: { id: sessionId },
    });

    // Recalculate weekly estimate after deletion
    await this.aggregateWeeklyCalculation(userId, session.actualStart);

    return { success: true };
  }
}
