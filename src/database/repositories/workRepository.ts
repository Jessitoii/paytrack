import { getDatabase } from '../db';
import { userRepository } from './userRepository';
import { roundFinishDateTo5Minutes } from '../../../shared/time/rounding';
import { calculateWorkSession } from '../../../shared/time/periods';
import { calculateGrossPayroll, calculateNetPayroll } from '../../../shared/payroll/engine';
import { CARRIERE_AH_PROFILE_2026 } from '../../../shared/payroll/profiles';
import { Decimal } from '../../../shared/money/decimal';
import { dbEvents } from '../events';
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
      const breaks = await db.query('SELECT * FROM work_breaks WHERE workSessionId = ? ORDER BY createdAt ASC;', [session.id]);
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

    const breaks = await db.query('SELECT * FROM work_breaks WHERE workSessionId = ? ORDER BY createdAt ASC;', [id]);
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

    const breaks = await db.query('SELECT * FROM work_breaks WHERE workSessionId = ? ORDER BY createdAt ASC;', [session.id]);
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

    const created = await this.getWorkSessionById(id);
    dbEvents.emit('work_changed');
    return created;
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

    const result = await db.transaction(async (tx) => {
      // Save breaks
      await tx.execute('DELETE FROM work_breaks WHERE workSessionId = ?;', [sessionId]);
      const activeBreaks = input?.breaks || [];
      for (const b of activeBreaks) {
        const breakId = generateId('brk');
        await tx.execute(
          `INSERT INTO work_breaks (id, workSessionId, type, durationMinutes, isPaid, name, startTime, endTime, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            breakId,
            sessionId,
            b.type,
            b.durationMinutes,
            b.isPaid ? 1 : 0,
            b.name ?? null,
            b.startTime ?? null,
            b.endTime ?? null,
            new Date().toISOString(),
          ]
        );
      }

      const domainBreaks: TimeBreak[] = activeBreaks.map((b) => ({
        id: 'brk',
        type: b.type.toLowerCase() as any,
        durationMinutes: b.durationMinutes,
        isPaid: Boolean(b.isPaid),
        name: b.name ?? undefined,
        startTime: b.startTime ?? undefined,
        endTime: b.endTime ?? undefined,
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

    dbEvents.emit('work_changed');
    return result;
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
      startTime: b.startTime ?? undefined,
      endTime: b.endTime ?? undefined,
    }));

    const calculation = calculateWorkSession(startDate, rawFinish, domainBreaks);
    const sessionId = generateId('ws');
    const now = new Date().toISOString();

    const result = await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO work_sessions (
           id, shiftId, actualStart, rawFinish, roundedFinish, elapsedMinutes, paidMinutes, status, isManualEntry, notes, createdAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED', 1, ?, ?, ?);`,
        [sessionId, input.shiftId ?? null, startDate.toISOString(), rawFinish.toISOString(), roundedFinish.toISOString(), calculation.elapsedMinutes, calculation.paidMinutes, input.notes ?? null, now, now]
      );

      for (const b of input.breaks || []) {
        const breakId = generateId('brk');
        await tx.execute(
          `INSERT INTO work_breaks (id, workSessionId, type, durationMinutes, isPaid, name, startTime, endTime, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            breakId,
            sessionId,
            b.type,
            b.durationMinutes,
            b.isPaid ? 1 : 0,
            b.name ?? null,
            b.startTime ?? null,
            b.endTime ?? null,
            now,
          ]
        );
      }

      await workRepository.aggregateWeeklyPayroll(startDate);

      const created = await workRepository.getWorkSessionById(sessionId);
      return { session: created, calculation };
    });

    dbEvents.emit('work_changed');
    return result;
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

    const result = await db.transaction(async (tx) => {
      if (input.breaks) {
        await tx.execute('DELETE FROM work_breaks WHERE workSessionId = ?;', [sessionId]);
        for (const b of input.breaks) {
          const breakId = generateId('brk');
          await tx.execute(
            `INSERT INTO work_breaks (id, workSessionId, type, durationMinutes, isPaid, name, startTime, endTime, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              breakId,
              sessionId,
              b.type,
              b.durationMinutes,
              b.isPaid ? 1 : 0,
              b.name ?? null,
              b.startTime ?? null,
              b.endTime ?? null,
              new Date().toISOString(),
            ]
          );
        }
      }

      const allBreaks = await tx.query('SELECT * FROM work_breaks WHERE workSessionId = ? ORDER BY createdAt ASC;', [sessionId]);
      const domainBreaks: TimeBreak[] = allBreaks.map((b) => ({
        id: b.id,
        type: b.type.toLowerCase() as any,
        durationMinutes: b.durationMinutes,
        isPaid: Boolean(b.isPaid),
        name: b.name ?? undefined,
        startTime: b.startTime ?? undefined,
        endTime: b.endTime ?? undefined,
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

    dbEvents.emit('work_changed');
    return result;
  },

  async deleteWork(sessionId: string) {
    const db = getDatabase();
    const session = await this.getWorkSessionById(sessionId);
    if (!session) throw new Error('Work session not found');

    const startDate = new Date(session.actualStart);
    await db.execute('DELETE FROM work_sessions WHERE id = ?;', [sessionId]);
    await this.aggregateWeeklyPayroll(startDate);
    dbEvents.emit('work_changed');
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
       WHERE s.isDayOff = 0
         AND COALESCE(s.expectedActualStart, s.plannedStart) <= ?
         AND ws.id IS NULL
       ORDER BY COALESCE(s.expectedActualStart, s.plannedStart) ASC;`,
      [nowStr]
    );

    const started = [];
    for (const shift of shiftsToStart) {
      const targetStart = shift.expectedActualStart || shift.plannedStart;
      if (!targetStart) continue;

      // Ensure no active session was spawned in earlier iteration
      const currentActive = await this.getActiveSession();
      if (currentActive) break;

      const sessionId = generateId('ws');
      const createdNow = new Date().toISOString();

      await db.execute(
        `INSERT INTO work_sessions (id, shiftId, actualStart, status, isManualEntry, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, 'WORKING', 0, ?, ?, ?);`,
        [sessionId, shift.id, targetStart, `Auto-started from planned ${shift.shiftType} shift`, createdNow, createdNow]
      );

      const created = await this.getWorkSessionById(sessionId);
      if (created) started.push(created);
    }

    if (started.length > 0) {
      dbEvents.emit('work_changed');
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

    // Get completed sessions in this ISO week
    const sessions = await db.query(
      `SELECT * FROM work_sessions
       WHERE status = 'COMPLETED' AND actualStart >= ? AND actualStart <= ?
       ORDER BY actualStart ASC;`,
      [startStr, endStr]
    );

    // Calculate domain work sessions
    const calculatedSessions = [];
    for (const s of sessions) {
      const sStart = new Date(s.actualStart);
      const sFinish = s.rawFinish ? new Date(s.rawFinish) : sStart;
      const breaks = await db.query('SELECT * FROM work_breaks WHERE workSessionId = ? ORDER BY createdAt ASC;', [s.id]);
      const domainBreaks: TimeBreak[] = breaks.map((b) => ({
        id: b.id,
        type: b.type.toLowerCase() as any,
        durationMinutes: b.durationMinutes,
        isPaid: Boolean(b.isPaid),
        name: b.name ?? undefined,
        startTime: b.startTime ?? undefined,
        endTime: b.endTime ?? undefined,
      }));

      const calc = calculateWorkSession(sStart, sFinish, domainBreaks);
      calculatedSessions.push(calc);
    }

    // Get applicable payroll configuration
    const configRow = await userRepository.getEffectivePayrollConfig(targetDate);
    const profile: PayrollProfile = configRow
      ? {
          id: configRow.id,
          name: configRow.name,
          employer: employment.employerName,
          agency: employment.agencyName ?? undefined,
          effectiveFromWeek: configRow.effectiveFromWeek,
          effectiveUntilWeek: configRow.effectiveUntilWeek ?? undefined,
          effectiveFromDate: configRow.effectiveFromDate,
          baseHourlyRate: configRow.baseHourlyRate,
          advHourlyRate: configRow.advHourlyRate ?? undefined,
          advPercentage: configRow.advPercentage ?? undefined,
          holidayAllowancePercentage: configRow.holidayAllowancePercentage,
          holidayEntitlementPercentage: configRow.holidayEntitlementPercentage,
          pawwRatePercentage: configRow.pawwRatePercentage,
          azvRatePercentage: configRow.azvRatePercentage,
          stippRatePercentage: configRow.stippRatePercentage,
          wgaRatePercentage: configRow.wgaRatePercentage,
          healthInsuranceWeekly: configRow.healthInsuranceWeekly,
          additionalInsuranceWeekly: configRow.additionalInsuranceWeekly,
          taxEstimationMode: configRow.taxEstimationMode as any,
          estimatedTaxRatePercentage: configRow.estimatedTaxRatePercentage ?? undefined,
        }
      : CARRIERE_AH_PROFILE_2026;

    // Run deterministic payroll calculations
    const grossResult = calculateGrossPayroll(calculatedSessions, profile);
    const netResult = calculateNetPayroll(grossResult, profile);

    // Upsert payroll_weeks
    let weekRecord = await db.queryFirst('SELECT id FROM payroll_weeks WHERE year = ? AND weekNumber = ?;', [year, weekNumber]);
    const now = new Date().toISOString();
    let weekId: string;

    if (weekRecord) {
      weekId = weekRecord.id;
      await db.execute(
        `UPDATE payroll_weeks SET updatedAt = ? WHERE id = ?;`,
        [now, weekId]
      );
    } else {
      weekId = generateId('pw');
      await db.execute(
        `INSERT INTO payroll_weeks (id, employmentId, year, weekNumber, startDate, endDate, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'ESTIMATED', ?, ?);`,
        [weekId, employment.id, year, weekNumber, startStr, endStr, now, now]
      );
    }

    // Upsert payroll_calculations
    const calcId = generateId('calc');
    const configSnapshot = JSON.stringify(profile);

    await db.execute('DELETE FROM payroll_calculations WHERE payrollWeekId = ?;', [weekId]);

    await db.execute(
      `INSERT INTO payroll_calculations (
         id, payrollWeekId, configSnapshotJson, paidMinutes, paidHours, baseHourlyRate,
         baseGross, advAllowance, holidayAllowance, holidayEntitlementAccrual,
         holidayDaysExchange, etExchangeDeduction, totalGross, pawwDeduction,
         azvDeduction, stippDeduction, wgaDeduction, totalPayrollDeductions,
         loonSv, estimatedTax, taxAccuracy, netBeforeAdjustments,
         etExchangeReimbursement, healthInsurance, additionalInsurance,
         estimatedNet, estimatedBankPayment, createdAt, updatedAt
       ) VALUES (
         ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?
       );`,
      [
        calcId,
        weekId,
        configSnapshot,
        grossResult.paidMinutes,
        grossResult.paidHoursDecimal.toNumber(),
        profile.baseHourlyRate,
        grossResult.baseGross.toNumber(),
        grossResult.advAllowance.toNumber(),
        grossResult.holidayAllowance.toNumber(),
        grossResult.holidayEntitlementAccrual.toNumber(),
        grossResult.holidayDaysExchange.toNumber(),
        grossResult.etExchangeDeduction.toNumber(),
        grossResult.totalGross.toNumber(),
        netResult.payrollDeductions.find((d) => d.name.includes('PAWW'))?.amount.toNumber() || 0,
        netResult.payrollDeductions.find((d) => d.name.includes('AZV'))?.amount.toNumber() || 0,
        netResult.payrollDeductions.find((d) => d.name.includes('StiPP'))?.amount.toNumber() || 0,
        netResult.payrollDeductions.find((d) => d.name.includes('WGA'))?.amount.toNumber() || 0,
        netResult.totalPayrollDeductions.toNumber(),
        netResult.loonSv.toNumber(),
        netResult.estimatedTax.toNumber(),
        netResult.taxAccuracy,
        netResult.netBeforeAdjustments.toNumber(),
        netResult.etExchangeReimbursement.toNumber(),
        netResult.healthInsurance.toNumber(),
        netResult.additionalInsurance.toNumber(),
        netResult.estimatedNet.toNumber(),
        netResult.estimatedBankPayment.toNumber(),
        now,
        now,
      ]
    );

    return { weekId, grossResult, netResult };
  },

  async getWeeklyCalculation(targetDate: Date = new Date()) {
    const db = getDatabase();
    const { year, weekNumber, startDate, endDate } = getISOWeekBounds(targetDate);

    const week = await db.queryFirst(
      'SELECT * FROM payroll_weeks WHERE year = ? AND weekNumber = ?;',
      [year, weekNumber]
    );
    if (!week) return null;

    const calc = await db.queryFirst(
      'SELECT * FROM payroll_calculations WHERE payrollWeekId = ?;',
      [week.id]
    );

    return { week, calculation: calc };
  },

  /**
   * Returns list of ISO weeks that have recorded work sessions or payroll calculations,
   * sorted in descending chronological order.
   */
  async listISOWeeksWithSummary(limit = 20) {
    const db = getDatabase();
    // Query distinct sessions
    const sessions = await db.query(
      `SELECT * FROM work_sessions
       WHERE status IN ('COMPLETED', 'EDITED')
       ORDER BY actualStart DESC;`
    );

    // Group by year and weekNumber
    const weekMap = new Map<string, {
      year: number;
      weekNumber: number;
      startDate: Date;
      endDate: Date;
      totalElapsedMinutes: number;
      totalPaidMinutes: number;
      sessionCount: number;
    }>();

    for (const s of sessions) {
      const sDate = new Date(s.actualStart);
      const bounds = getISOWeekBounds(sDate);
      const key = `${bounds.year}_W${String(bounds.weekNumber).padStart(2, '0')}`;

      const existing = weekMap.get(key);
      if (existing) {
        existing.totalElapsedMinutes += s.elapsedMinutes || 0;
        existing.totalPaidMinutes += s.paidMinutes || 0;
        existing.sessionCount += 1;
      } else {
        weekMap.set(key, {
          year: bounds.year,
          weekNumber: bounds.weekNumber,
          startDate: bounds.startDate,
          endDate: bounds.endDate,
          totalElapsedMinutes: s.elapsedMinutes || 0,
          totalPaidMinutes: s.paidMinutes || 0,
          sessionCount: 1,
        });
      }
    }

    // Attach payroll calculation totals
    const result = [];
    for (const weekData of weekMap.values()) {
      const weekCalc = await db.queryFirst(
        `SELECT pc.* FROM payroll_calculations pc
         JOIN payroll_weeks pw ON pw.id = pc.payrollWeekId
         WHERE pw.year = ? AND pw.weekNumber = ?;`,
        [weekData.year, weekData.weekNumber]
      );

      const estimatedGross = weekCalc?.totalGross ?? (weekData.totalPaidMinutes / 60) * 16.34;
      const estimatedNet = weekCalc?.estimatedNet ?? (weekData.totalPaidMinutes / 60) * 13.50;

      result.push({
        ...weekData,
        estimatedGross: Number(estimatedGross.toFixed(2)),
        estimatedNet: Number(estimatedNet.toFixed(2)),
        status: weekCalc ? 'CALCULATED' : 'ESTIMATED',
      });
    }

    // Sort descending by year, weekNumber
    return result
      .sort((a, b) => (b.year === a.year ? b.weekNumber - a.weekNumber : b.year - a.year))
      .slice(0, limit);
  },

  /**
   * Returns a complete 7-day timesheet detail for the given ISO week (Monday through Sunday),
   * showing planned shift vs actual work sessions for every single day.
   */
  async getWeekTimesheetDetail(year: number, weekNumber: number) {
    const db = getDatabase();

    // 1. Calculate Monday 00:00:00 to Sunday 23:59:59.999
    const simple = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = simple.getUTCDay() || 7;
    const isoMonday = new Date(simple.getTime() + (weekNumber - 1) * 7 * 86400000 - (dayOfWeek - 1) * 86400000);

    const monday = new Date(isoMonday.getUTCFullYear(), isoMonday.getUTCMonth(), isoMonday.getUTCDate(), 0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const startStr = monday.toISOString();
    const endStr = sunday.toISOString();

    // 2. Fetch all shifts in this week
    const shifts = await db.query(
      `SELECT * FROM shifts WHERE date >= ? AND date <= ? ORDER BY date ASC;`,
      [startStr.substring(0, 10), endStr.substring(0, 10)]
    );

    // 3. Fetch all work sessions in this week
    const sessions = await db.query(
      `SELECT * FROM work_sessions WHERE actualStart >= ? AND actualStart <= ? ORDER BY actualStart ASC;`,
      [startStr, endStr]
    );

    // Fetch breaks for each session
    const populatedSessions = [];
    for (const s of sessions) {
      const breaks = await db.query('SELECT * FROM work_breaks WHERE workSessionId = ? ORDER BY createdAt ASC;', [s.id]);
      populatedSessions.push({
        ...s,
        isManualEntry: Boolean(s.isManualEntry),
        breaks: breaks.map((b) => ({ ...b, isPaid: Boolean(b.isPaid) })),
      });
    }

    // 4. Fetch payroll calculation for this week
    const weekCalc = await db.queryFirst(
      `SELECT pc.* FROM payroll_calculations pc
       JOIN payroll_weeks pw ON pw.id = pc.payrollWeekId
       WHERE pw.year = ? AND pw.weekNumber = ?;`,
      [year, weekNumber]
    );

    // 5. Build 7-day array (Monday to Sunday)
    const DAY_NAMES = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const todayStr = new Date().toISOString().substring(0, 10);

    let totalWorkedMinutes = 0;
    let totalPaidMinutes = 0;

    const days = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const y = dayDate.getFullYear();
      const m = String(dayDate.getMonth() + 1).padStart(2, '0');
      const d = String(dayDate.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const formattedDate = `${dayDate.getDate()} ${MONTH_SHORT[dayDate.getMonth()]}`;

      // Find matching shift
      const dayShift = shifts.find((sh: any) => sh.date.substring(0, 10) === dateStr) || null;

      // Find matching sessions on this calendar day
      const daySessions = populatedSessions.filter((ws: any) => ws.actualStart.substring(0, 10) === dateStr);

      let dayWorkedMins = 0;
      let dayPaidMins = 0;
      for (const s of daySessions) {
        dayWorkedMins += s.elapsedMinutes || 0;
        dayPaidMins += s.paidMinutes || 0;
      }

      totalWorkedMinutes += dayWorkedMins;
      totalPaidMinutes += dayPaidMins;

      // Gross estimate for this day (hourly rate approx 16.34)
      const dayGross = (dayPaidMins / 60) * 16.34;

      const hasWork = daySessions.length > 0;
      const isOff = dayShift ? (Boolean(dayShift.isDayOff) || dayShift.shiftType === 'OFF') : false;

      days.push({
        dayIndex: i,
        dateStr,
        dayName: DAY_NAMES[i],
        formattedDate,
        isToday: dateStr === todayStr,
        isDayOff: isOff,
        shift: dayShift,
        sessions: daySessions,
        primarySession: daySessions[0] || null,
        hasWork,
        workedMinutes: dayWorkedMins,
        paidMinutes: dayPaidMins,
        grossAmount: Number(dayGross.toFixed(2)),
      });
    }

    const estimatedGross = weekCalc?.totalGross ?? (totalPaidMinutes / 60) * 16.34;
    const estimatedNet = weekCalc?.estimatedNet ?? (totalPaidMinutes / 60) * 13.50;

    return {
      summary: {
        year,
        weekNumber,
        startDate: monday,
        endDate: sunday,
        formattedRange: `${monday.getDate()} ${MONTH_SHORT[monday.getMonth()]} – ${sunday.getDate()} ${MONTH_SHORT[sunday.getMonth()]}`,
        totalWorkedMinutes,
        totalPaidMinutes,
        estimatedGross: Number(estimatedGross.toFixed(2)),
        estimatedNet: Number(estimatedNet.toFixed(2)),
        sessionCount: populatedSessions.length,
        isCalculated: Boolean(weekCalc),
      },
      days,
    };
  },
};
