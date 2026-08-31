import { getDatabase } from '../db';
import { userRepository } from './userRepository';
import { roundFinishDateTo5Minutes } from '../../../shared/time/rounding';
import { calculateWorkSession } from '../../../shared/time/periods';
import { calculateGrossPayroll, calculateNetPayroll } from '../../../shared/payroll/engine';
import { CARRIERE_AH_PROFILE_2026 } from '../../../shared/payroll/profiles';
import { Decimal } from '../../../shared/money/decimal';
import type { TimeBreak } from '../../../shared/types/time';
import type { PayrollProfile } from '../../../shared/types/payroll';

function generateId(prefix = 'ws'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Calculates ISO-8601 week number, year, Monday start date, and Sunday end date.
 */
export function getISOWeekBounds(date: Date): { year: number; weekNumber: number; startDate: Date; endDate: Date } {
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

export const workRepository = {
  async listWorkSessions(filters?: { startDate?: string | Date; endDate?: string | Date; status?: string }) {
    const db = getDatabase();
    let sql = 'SELECT * FROM work_sessions WHERE 1=1';
    const params: any[] = [];

    if (filters?.startDate) {
      const s = typeof filters.startDate === 'string' ? filters.startDate : filters.startDate.toISOString();
      sql += ' AND actualStart >= ?';
      params.push(s);
    }
    if (filters?.endDate) {
      const e = typeof filters.endDate === 'string' ? filters.endDate : filters.endDate.toISOString();
      sql += ' AND actualStart <= ?';
      params.push(e);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY actualStart DESC;';
    const sessions = await db.query(sql, params);

    // Attach breaks
    const populated = [];
    for (const session of sessions) {
      const breaks = await db.query('SELECT * FROM work_breaks WHERE workSessionId = ?;', [session.id]);
      populated.push({
        ...session,
        isManualEntry: Boolean(session.isManualEntry),
        breaks: breaks.map((b) => ({ ...b, isPaid: Boolean(b.isPaid) })),
      });
    }

    return populated;
  },

  async getWorkSessionById(id: string) {
    const db = getDatabase();
    const session = await db.queryFirst('SELECT * FROM work_sessions WHERE id = ?;', [id]);
    if (!session) return null;

    const breaks = await db.query('SELECT * FROM work_breaks WHERE workSessionId = ?;', [id]);
    return {
      ...session,
      isManualEntry: Boolean(session.isManualEntry),
      breaks: breaks.map((b) => ({ ...b, isPaid: Boolean(b.isPaid) })),
    };
  },

  async getActiveSession() {
    const db = getDatabase();
    const session = await db.queryFirst("SELECT * FROM work_sessions WHERE status = 'WORKING' LIMIT 1;");
    if (!session) return null;

    const breaks = await db.query('SELECT * FROM work_breaks WHERE workSessionId = ?;', [session.id]);
    return {
      ...session,
      isManualEntry: Boolean(session.isManualEntry),
      breaks: breaks.map((b) => ({ ...b, isPaid: Boolean(b.isPaid) })),
    };
  },

  /**
   * 1-Tap Start Work with duplicate protection.
   */
  async startWork(input?: { shiftId?: string; actualStart?: Date | string; notes?: string }) {
    const db = getDatabase();
    const existing = await this.getActiveSession();
    if (existing) {
      throw new Error(`Active work session already in progress since ${existing.actualStart.substring(11, 16)}.`);
    }

    const id = generateId('ws');
    const start = input?.actualStart ? new Date(input.actualStart) : new Date();
    const startStr = start.toISOString();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO work_sessions (id, shiftId, actualStart, status, isManualEntry, notes, createdAt, updatedAt)
       VALUES (?, ?, ?, 'WORKING', ?, ?, ?, ?);`,
      [id, input?.shiftId ?? null, startStr, input?.actualStart ? 1 : 0, input?.notes ?? null, now, now]
    );

    return this.getWorkSessionById(id);
  },

  /**
   * Finish Work with customizable finish time, break selection, and 5-min upward ceiling rounding.
   */
  async finishWork(sessionId: string, input?: { rawFinish?: Date | string; breaks?: any[]; notes?: string }) {
    const db = getDatabase();
    const session = await this.getWorkSessionById(sessionId);
    if (!session) throw new Error('Work session not found');
    if (session.status !== 'WORKING') throw new Error('Session is already completed');

    const startDate = new Date(session.actualStart);
    const rawFinish = input?.rawFinish ? new Date(input.rawFinish) : new Date();
    if (rawFinish.getTime() < startDate.getTime()) {
      throw new Error('Finish timestamp cannot be earlier than start timestamp');
    }

    const roundedFinish = roundFinishDateTo5Minutes(rawFinish);

    return db.transaction(async (tx) => {
      // Save breaks
      await tx.execute('DELETE FROM work_breaks WHERE workSessionId = ?;', [sessionId]);
      const activeBreaks = input?.breaks || [];
      for (const b of activeBreaks) {
        const breakId = generateId('brk');
        await tx.execute(
          `INSERT INTO work_breaks (id, workSessionId, type, durationMinutes, isPaid, name, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [breakId, sessionId, b.type, b.durationMinutes, b.isPaid ? 1 : 0, b.name ?? null, new Date().toISOString()]
        );
      }

      const domainBreaks: TimeBreak[] = activeBreaks.map((b) => ({
        id: 'brk',
        type: b.type.toLowerCase() as any,
        durationMinutes: b.durationMinutes,
        isPaid: Boolean(b.isPaid),
        name: b.name ?? undefined,
      }));

      // Calculate deterministic session metrics
      const calculation = calculateWorkSession(startDate, rawFinish, domainBreaks);
      const now = new Date().toISOString();

      await tx.execute(
        `UPDATE work_sessions SET
           rawFinish = ?, roundedFinish = ?, elapsedMinutes = ?, paidMinutes = ?, status = 'COMPLETED', notes = ?, updatedAt = ?
         WHERE id = ?;`,
        [rawFinish.toISOString(), roundedFinish.toISOString(), calculation.elapsedMinutes, calculation.paidMinutes, input?.notes ?? session.notes, now, sessionId]
      );

      // Reaggregate Weekly Estimate
      await workRepository.aggregateWeeklyPayroll(startDate);

      const updated = await workRepository.getWorkSessionById(sessionId);
      return { session: updated, calculation };
    });
  },

  /**
   * Log Manual Past Work Session.
   */
  async createManualWork(input: {
    shiftId?: string;
    actualStart: Date | string;
    rawFinish: Date | string;
    breaks?: any[];
    notes?: string;
  }) {
    const db = getDatabase();
    const startDate = new Date(input.actualStart);
    const rawFinish = new Date(input.rawFinish);
    if (rawFinish.getTime() < startDate.getTime()) {
      throw new Error('Finish timestamp cannot be earlier than start timestamp');
    }

    const roundedFinish = roundFinishDateTo5Minutes(rawFinish);

    const domainBreaks: TimeBreak[] = (input.breaks || []).map((b) => ({
      id: 'brk',
      type: b.type.toLowerCase() as any,
      durationMinutes: b.durationMinutes,
      isPaid: Boolean(b.isPaid),
      name: b.name ?? undefined,
    }));

    const calculation = calculateWorkSession(startDate, rawFinish, domainBreaks);
    const sessionId = generateId('ws');
    const now = new Date().toISOString();

    return db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO work_sessions (
           id, shiftId, actualStart, rawFinish, roundedFinish, elapsedMinutes, paidMinutes, status, isManualEntry, notes, createdAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', 1, ?, ?, ?);`,
        [sessionId, input.shiftId ?? null, startDate.toISOString(), rawFinish.toISOString(), roundedFinish.toISOString(), calculation.elapsedMinutes, calculation.paidMinutes, input.notes ?? null, now, now]
      );

      for (const b of input.breaks || []) {
        const breakId = generateId('brk');
        await tx.execute(
          `INSERT INTO work_breaks (id, workSessionId, type, durationMinutes, isPaid, name, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [breakId, sessionId, b.type, b.durationMinutes, b.isPaid ? 1 : 0, b.name ?? null, now]
        );
      }

      await workRepository.aggregateWeeklyPayroll(startDate);

      const created = await workRepository.getWorkSessionById(sessionId);
      return { session: created, calculation };
    });
  },

  /**
   * Edit Work Session with deterministic cross-week ISO reaggregation.
   */
  async updateWork(sessionId: string, input: {
    shiftId?: string | null;
    actualStart?: Date | string;
    rawFinish?: Date | string | null;
    breaks?: any[];
    status?: string;
    notes?: string | null;
  }) {
    const db = getDatabase();
    const session = await this.getWorkSessionById(sessionId);
    if (!session) throw new Error('Work session not found');

    const oldStartDate = new Date(session.actualStart);
    const newStartDate = input.actualStart ? new Date(input.actualStart) : oldStartDate;
    const rawFinish = input.rawFinish !== undefined ? (input.rawFinish ? new Date(input.rawFinish) : null) : (session.rawFinish ? new Date(session.rawFinish) : null);

    if (rawFinish && rawFinish.getTime() < newStartDate.getTime()) {
      throw new Error('Finish timestamp cannot be earlier than start timestamp');
    }

    const roundedFinish = rawFinish ? roundFinishDateTo5Minutes(rawFinish) : null;

    return db.transaction(async (tx) => {
      if (input.breaks) {
        await tx.execute('DELETE FROM work_breaks WHERE workSessionId = ?;', [sessionId]);
        for (const b of input.breaks) {
          const breakId = generateId('brk');
          await tx.execute(
            `INSERT INTO work_breaks (id, workSessionId, type, durationMinutes, isPaid, name, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [breakId, sessionId, b.type, b.durationMinutes, b.isPaid ? 1 : 0, b.name ?? null, new Date().toISOString()]
          );
        }
      }

      const allBreaks = await tx.query('SELECT * FROM work_breaks WHERE workSessionId = ?;', [sessionId]);
      const domainBreaks: TimeBreak[] = allBreaks.map((b) => ({
        id: b.id,
        type: b.type.toLowerCase() as any,
        durationMinutes: b.durationMinutes,
        isPaid: Boolean(b.isPaid),
        name: b.name ?? undefined,
      }));

      let elapsedMinutes = 0;
      let paidMinutes = 0;
      let calculation = null;

      if (rawFinish) {
        calculation = calculateWorkSession(newStartDate, rawFinish, domainBreaks);
        elapsedMinutes = calculation.elapsedMinutes;
        paidMinutes = calculation.paidMinutes;
      }

      const now = new Date().toISOString();
      await tx.execute(
        `UPDATE work_sessions SET
           shiftId = ?, actualStart = ?, rawFinish = ?, roundedFinish = ?, elapsedMinutes = ?, paidMinutes = ?,
           status = ?, isManualEntry = 1, notes = ?, updatedAt = ?
         WHERE id = ?;`,
        [
          input.shiftId !== undefined ? input.shiftId : session.shiftId,
          newStartDate.toISOString(),
          rawFinish ? rawFinish.toISOString() : null,
          roundedFinish ? roundedFinish.toISOString() : null,
          elapsedMinutes,
          paidMinutes,
          input.status ?? (rawFinish ? 'COMPLETED' : session.status),
          input.notes !== undefined ? input.notes : session.notes,
          now,
          sessionId,
        ]
      );

      // Reaggregate old week if date changed across ISO weeks
      const oldBounds = getISOWeekBounds(oldStartDate);
      const newBounds = getISOWeekBounds(newStartDate);

      if (oldBounds.year !== newBounds.year || oldBounds.weekNumber !== newBounds.weekNumber) {
        await workRepository.aggregateWeeklyPayroll(oldStartDate);
      }
      await workRepository.aggregateWeeklyPayroll(newStartDate);

      const updated = await workRepository.getWorkSessionById(sessionId);
      return { session: updated, calculation };
    });
  },

  async deleteWork(sessionId: string) {
    const db = getDatabase();
    const session = await this.getWorkSessionById(sessionId);
    if (!session) throw new Error('Work session not found');

    const startDate = new Date(session.actualStart);
    await db.execute('DELETE FROM work_sessions WHERE id = ?;', [sessionId]);
    await this.aggregateWeeklyPayroll(startDate);
    return { success: true };
  },

  /**
   * Idempotent Auto-Start Reconciliation on app launch/focus.
   */
  async reconcileAutoStart() {
    const db = getDatabase();
    const now = new Date();
    const nowStr = now.toISOString();

    // Check if there is already an active WORKING session
    const active = await this.getActiveSession();
    if (active) return { autoStartedCount: 0, sessions: [] };

    // Find planned shifts starting up to now, not marked as day off
    const shiftsToStart = await db.query(
      `SELECT s.* FROM shifts s
       LEFT JOIN work_sessions ws ON ws.shiftId = s.id
       WHERE s.isDayOff = 0 AND s.plannedStart <= ? AND ws.id IS NULL
       ORDER BY s.plannedStart ASC;`,
      [nowStr]
    );

    const started = [];
    for (const shift of shiftsToStart) {
      if (!shift.plannedStart) continue;

      // Ensure no active session was spawned in earlier iteration
      const currentActive = await this.getActiveSession();
      if (currentActive) break;

      const sessionId = generateId('ws');
      const startStr = shift.plannedStart;
      const createdNow = new Date().toISOString();

      await db.execute(
        `INSERT INTO work_sessions (id, shiftId, actualStart, status, isManualEntry, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, 'WORKING', 0, ?, ?, ?);`,
        [sessionId, shift.id, startStr, `Auto-started from planned ${shift.shiftType} shift`, createdNow, createdNow]
      );

      const created = await this.getWorkSessionById(sessionId);
      if (created) started.push(created);
    }

    return { autoStartedCount: started.length, sessions: started };
  },

  /**
   * Deterministic Weekly Payroll Aggregation.
   */
  async aggregateWeeklyPayroll(targetDate: Date) {
    const db = getDatabase();
    const { year, weekNumber, startDate, endDate } = getISOWeekBounds(targetDate);
    const employment = await userRepository.getActiveEmployment();
    if (!employment) return null;

    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();

    // 1. Find or create PayrollWeek record
    let payrollWeek = await db.queryFirst(
      'SELECT * FROM payroll_weeks WHERE year = ? AND weekNumber = ?;',
      [year, weekNumber]
    );

    const now = new Date().toISOString();
    const payrollWeekId = payrollWeek?.id ?? generateId('pw');

    if (!payrollWeek) {
      await db.execute(
        `INSERT INTO payroll_weeks (id, employmentId, year, weekNumber, startDate, endDate, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'ESTIMATED', ?, ?);`,
        [payrollWeekId, employment.id, year, weekNumber, startStr, endStr, now, now]
      );
    }

    // 2. Query completed/edited work sessions for this week
    const weekSessions = await db.query(
      `SELECT * FROM work_sessions
       WHERE status IN ('COMPLETED', 'EDITED') AND actualStart >= ? AND actualStart <= ? AND rawFinish IS NOT NULL;`,
      [startStr, endStr]
    );

    if (weekSessions.length === 0) {
      await db.execute('DELETE FROM payroll_calculations WHERE payrollWeekId = ?;', [payrollWeekId]);
      return null;
    }

    // 3. Populate breaks for each session
    const calculatedSessions = [];
    for (const s of weekSessions) {
      const breaks = await db.query('SELECT * FROM work_breaks WHERE workSessionId = ?;', [s.id]);
      const domainBreaks: TimeBreak[] = breaks.map((b) => ({
        id: b.id,
        type: b.type.toLowerCase() as any,
        durationMinutes: b.durationMinutes,
        isPaid: Boolean(b.isPaid),
        name: b.name ?? undefined,
      }));
      calculatedSessions.push(calculateWorkSession(new Date(s.actualStart), new Date(s.rawFinish), domainBreaks));
    }

    // 4. Select applicable payroll configuration profile (or default to 2026 Carriere profile)
    const configRecord = await db.queryFirst(
      `SELECT * FROM payroll_configurations
       WHERE effectiveFromWeek <= ? AND (effectiveUntilWeek IS NULL OR effectiveUntilWeek >= ?)
       ORDER BY effectiveFromWeek DESC LIMIT 1;`,
      [weekNumber, weekNumber]
    );

    const profile: PayrollProfile = configRecord
      ? {
          id: configRecord.id,
          name: configRecord.name,
          employer: employment.employerName,
          agency: employment.agencyName ?? undefined,
          effectiveFromWeek: configRecord.effectiveFromWeek,
          effectiveUntilWeek: configRecord.effectiveUntilWeek ?? undefined,
          effectiveFromDate: configRecord.effectiveFromDate,
          baseHourlyRate: configRecord.baseHourlyRate,
          advHourlyRate: configRecord.advHourlyRate ?? undefined,
          holidayAllowancePercentage: configRecord.holidayAllowancePercentage,
          holidayEntitlementPercentage: configRecord.holidayEntitlementPercentage,
          pawwRatePercentage: configRecord.pawwRatePercentage,
          azvRatePercentage: configRecord.azvRatePercentage,
          stippRatePercentage: configRecord.stippRatePercentage,
          wgaRatePercentage: configRecord.wgaRatePercentage,
          healthInsuranceWeekly: configRecord.healthInsuranceWeekly,
          additionalInsuranceWeekly: configRecord.additionalInsuranceWeekly,
          taxEstimationMode: configRecord.taxEstimationMode as any,
          estimatedTaxRatePercentage: configRecord.estimatedTaxRatePercentage ?? 18.0,
        }
      : CARRIERE_AH_PROFILE_2026;

    // 5. Run pure payroll calculation engine
    const gross = calculateGrossPayroll(calculatedSessions, profile);
    const net = calculateNetPayroll(gross, profile);

    const paww = net.payrollDeductions.find((d) => d.code === 'PAWW')?.amount ?? new Decimal(0);
    const azv = net.payrollDeductions.find((d) => d.code === 'AZV')?.amount ?? new Decimal(0);
    const stipp = net.payrollDeductions.find((d) => d.code === 'STIPP')?.amount ?? new Decimal(0);
    const wga = net.payrollDeductions.find((d) => d.code === 'WGA')?.amount ?? new Decimal(0);

    const calcId = generateId('pc');
    await db.execute('DELETE FROM payroll_calculations WHERE payrollWeekId = ?;', [payrollWeekId]);

    await db.execute(
      `INSERT INTO payroll_calculations (
         id, payrollWeekId, configSnapshotJson, paidMinutes, paidHours, baseHourlyRate,
         baseGross, advAllowance, holidayAllowance, holidayEntitlementAccrual, holidayDaysExchange,
         etExchangeDeduction, totalGross, pawwDeduction, azvDeduction, stippDeduction, wgaDeduction,
         totalPayrollDeductions, loonSv, estimatedTax, taxAccuracy, netBeforeAdjustments,
         etExchangeReimbursement, healthInsurance, additionalInsurance, estimatedNet, estimatedBankPayment,
         createdAt, updatedAt
       ) VALUES (
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?
       );`,
      [
        calcId, payrollWeekId, JSON.stringify(profile), gross.paidMinutes, gross.paidHoursDecimal.toNumber(), profile.baseHourlyRate,
        gross.baseGross.toNumber(), gross.advAllowance.toNumber(), gross.holidayAllowance.toNumber(), gross.holidayEntitlementAccrual.toNumber(), gross.holidayDaysExchange.toNumber(),
        gross.etExchangeDeduction.toNumber(), gross.totalGross.toNumber(), paww.toNumber(), azv.toNumber(), stipp.toNumber(), wga.toNumber(),
        net.totalPayrollDeductions.toNumber(), net.loonSv.toNumber(), net.estimatedTax.toNumber(), net.taxAccuracy, net.netBeforeAdjustments.toNumber(),
        net.etExchangeReimbursement.toNumber(), net.healthInsurance.toNumber(), net.additionalInsurance.toNumber(), net.estimatedNet.toNumber(), net.estimatedBankPayment.toNumber(),
        now, now
      ]
    );

    return {
      payrollWeekId,
      gross,
      net,
    };
  },

  async getWeeklyCalculation(targetDate: Date) {
    const db = getDatabase();
    const { year, weekNumber } = getISOWeekBounds(targetDate);
    const week = await db.queryFirst('SELECT * FROM payroll_weeks WHERE year = ? AND weekNumber = ?;', [year, weekNumber]);
    if (!week) return null;

    const calc = await db.queryFirst('SELECT * FROM payroll_calculations WHERE payrollWeekId = ?;', [week.id]);
    return { week, calculation: calc };
  },
};
