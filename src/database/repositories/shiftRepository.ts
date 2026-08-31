import { getDatabase } from '../db';
import { userRepository } from './userRepository';
import { dbEvents } from '../events';

function generateId(prefix = 'shift'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export const shiftRepository = {
  async listShifts(filters?: { startDate?: string | Date; endDate?: string | Date }) {
    const db = getDatabase();
    let sql = 'SELECT * FROM shifts WHERE 1=1';
    const params: any[] = [];

    if (filters?.startDate) {
      const s = typeof filters.startDate === 'string' ? filters.startDate : filters.startDate.toISOString();
      sql += ' AND date >= ?';
      params.push(s.substring(0, 10));
    }
    if (filters?.endDate) {
      const e = typeof filters.endDate === 'string' ? filters.endDate : filters.endDate.toISOString();
      sql += ' AND date <= ?';
      params.push(e.substring(0, 10));
    }

    sql += ' ORDER BY date ASC, plannedStart ASC;';
    return db.query(sql, params);
  },

  async getShiftById(id: string) {
    const db = getDatabase();
    return db.queryFirst('SELECT * FROM shifts WHERE id = ?;', [id]);
  },

  async saveShift(input: {
    id?: string;
    date: Date | string;
    shiftType: string;
    plannedStart?: Date | string | null;
    plannedEnd?: Date | string | null;
    startAdjustmentMinutes?: number;
    expectedActualStart?: Date | string | null;
    isDayOff?: boolean;
    notes?: string | null;
  }) {
    const db = getDatabase();
    const employment = await userRepository.getActiveEmployment();
    if (!employment) throw new Error('No active employment found.');

    const dStr = typeof input.date === 'string' ? input.date.substring(0, 10) : input.date.toISOString().substring(0, 10);
    const startStr = input.plannedStart ? (typeof input.plannedStart === 'string' ? input.plannedStart : input.plannedStart.toISOString()) : null;
    const endStr = input.plannedEnd ? (typeof input.plannedEnd === 'string' ? input.plannedEnd : input.plannedEnd.toISOString()) : null;
    const isOff = input.isDayOff ?? (input.shiftType === 'OFF' ? 1 : 0);
    const adjMins = input.startAdjustmentMinutes ?? 0;

    let expectedStartStr: string | null = null;
    if (!isOff && startStr) {
      if (input.expectedActualStart) {
        expectedStartStr = typeof input.expectedActualStart === 'string' ? input.expectedActualStart : input.expectedActualStart.toISOString();
      } else if (adjMins > 0) {
        const s = new Date(startStr);
        s.setMinutes(s.getMinutes() + adjMins);
        expectedStartStr = s.toISOString();
      } else {
        expectedStartStr = startStr;
      }
    }

    const now = new Date().toISOString();

    let res;
    if (input.id) {
      await db.execute(
        `UPDATE shifts SET
           date = ?, shiftType = ?, plannedStart = ?, plannedEnd = ?,
           startAdjustmentMinutes = ?, expectedActualStart = ?,
           isDayOff = ?, notes = ?, updatedAt = ?
         WHERE id = ?;`,
        [
          dStr,
          input.shiftType,
          isOff ? null : startStr,
          isOff ? null : endStr,
          isOff ? 0 : adjMins,
          isOff ? null : expectedStartStr,
          isOff ? 1 : 0,
          input.notes ?? null,
          now,
          input.id,
        ]
      );
      res = await this.getShiftById(input.id);
    } else {
      const id = generateId('shift');
      await db.execute(
        `INSERT INTO shifts (
           id, employmentId, date, shiftType, plannedStart, plannedEnd,
           startAdjustmentMinutes, expectedActualStart, isDayOff, notes, createdAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          id,
          employment.id,
          dStr,
          input.shiftType,
          isOff ? null : startStr,
          isOff ? null : endStr,
          isOff ? 0 : adjMins,
          isOff ? null : expectedStartStr,
          isOff ? 1 : 0,
          input.notes ?? null,
          now,
          now,
        ]
      );
      res = await this.getShiftById(id);
    }

    dbEvents.emit('shifts_changed');
    return res;
  },

  async bulkSaveWeek(input: {
    weekStartDate: Date | string;
    shifts: Array<{
      date: Date | string;
      shiftType: string;
      plannedStart?: Date | string | null;
      plannedEnd?: Date | string | null;
      startAdjustmentMinutes?: number;
      expectedActualStart?: Date | string | null;
      isDayOff?: boolean;
      notes?: string | null;
    }>;
  }) {
    const db = getDatabase();
    const employment = await userRepository.getActiveEmployment();
    if (!employment) throw new Error('No active employment found.');

    const mon = new Date(input.weekStartDate);
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);

    const monStr = mon.toISOString().substring(0, 10);
    const sunStr = sun.toISOString().substring(0, 10);
    const now = new Date().toISOString();

    const result = await db.transaction(async (tx) => {
      await tx.execute('DELETE FROM shifts WHERE date >= ? AND date <= ?;', [monStr, sunStr]);

      for (const item of input.shifts) {
        const id = generateId('shift');
        const dStr = typeof item.date === 'string' ? item.date.substring(0, 10) : item.date.toISOString().substring(0, 10);
        const startStr = item.plannedStart ? (typeof item.plannedStart === 'string' ? item.plannedStart : item.plannedStart.toISOString()) : null;
        const endStr = item.plannedEnd ? (typeof item.plannedEnd === 'string' ? item.plannedEnd : item.plannedEnd.toISOString()) : null;
        const isOff = item.isDayOff ?? (item.shiftType === 'OFF' ? 1 : 0);
        const adjMins = item.startAdjustmentMinutes ?? 0;

        let expectedStartStr: string | null = null;
        if (!isOff && startStr) {
          if (item.expectedActualStart) {
            expectedStartStr = typeof item.expectedActualStart === 'string' ? item.expectedActualStart : item.expectedActualStart.toISOString();
          } else if (adjMins > 0) {
            const s = new Date(startStr);
            s.setMinutes(s.getMinutes() + adjMins);
            expectedStartStr = s.toISOString();
          } else {
            expectedStartStr = startStr;
          }
        }

        await tx.execute(
          `INSERT INTO shifts (
             id, employmentId, date, shiftType, plannedStart, plannedEnd,
             startAdjustmentMinutes, expectedActualStart, isDayOff, notes, createdAt, updatedAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            id,
            employment.id,
            dStr,
            item.shiftType,
            isOff ? null : startStr,
            isOff ? null : endStr,
            isOff ? 0 : adjMins,
            isOff ? null : expectedStartStr,
            isOff ? 1 : 0,
            item.notes ?? null,
            now,
            now,
          ]
        );
      }

      return tx.query('SELECT * FROM shifts WHERE date >= ? AND date <= ? ORDER BY date ASC;', [monStr, sunStr]);
    });

    dbEvents.emit('shifts_changed');
    return result;
  },

  async copyPreviousWeek(input: { targetWeekStartDate: Date | string }) {
    const db = getDatabase();
    const employment = await userRepository.getActiveEmployment();
    if (!employment) throw new Error('No active employment found.');

    const targetMon = new Date(input.targetWeekStartDate);
    targetMon.setHours(0, 0, 0, 0);

    const prevMon = new Date(targetMon);
    prevMon.setDate(targetMon.getDate() - 7);
    prevMon.setHours(0, 0, 0, 0);

    const prevSun = new Date(prevMon);
    prevSun.setDate(prevMon.getDate() + 6);
    prevSun.setHours(23, 59, 59, 999);

    const prevMonStr = prevMon.toISOString().substring(0, 10);
    const prevSunStr = prevSun.toISOString().substring(0, 10);

    const prevShifts = await db.query('SELECT * FROM shifts WHERE date >= ? AND date <= ? ORDER BY date ASC;', [prevMonStr, prevSunStr]);
    if (prevShifts.length === 0) {
      throw new Error('No shifts found in the previous week to copy.');
    }

    const targetSun = new Date(targetMon);
    targetSun.setDate(targetMon.getDate() + 6);
    targetSun.setHours(23, 59, 59, 999);

    const targetMonStr = targetMon.toISOString().substring(0, 10);
    const targetSunStr = targetSun.toISOString().substring(0, 10);
    const now = new Date().toISOString();

    const result = await db.transaction(async (tx) => {
      await tx.execute('DELETE FROM shifts WHERE date >= ? AND date <= ?;', [targetMonStr, targetSunStr]);

      for (const shift of prevShifts) {
        const id = generateId('shift');
        const prevDate = new Date(shift.date);
        const newDate = new Date(prevDate);
        newDate.setDate(prevDate.getDate() + 7);
        const newDateStr = newDate.toISOString().substring(0, 10);

        let newStartStr: string | null = null;
        let newEndStr: string | null = null;
        let newExpectedStartStr: string | null = null;

        if (shift.plannedStart) {
          const s = new Date(shift.plannedStart);
          s.setDate(s.getDate() + 7);
          newStartStr = s.toISOString();
        }
        if (shift.plannedEnd) {
          const e = new Date(shift.plannedEnd);
          e.setDate(e.getDate() + 7);
          newEndStr = e.toISOString();
        }
        if (shift.expectedActualStart) {
          const exp = new Date(shift.expectedActualStart);
          exp.setDate(exp.getDate() + 7);
          newExpectedStartStr = exp.toISOString();
        }

        await tx.execute(
          `INSERT INTO shifts (
             id, employmentId, date, shiftType, plannedStart, plannedEnd,
             startAdjustmentMinutes, expectedActualStart, isDayOff, notes, createdAt, updatedAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            id,
            employment.id,
            newDateStr,
            shift.shiftType,
            newStartStr,
            newEndStr,
            shift.startAdjustmentMinutes ?? 0,
            newExpectedStartStr,
            shift.isDayOff,
            shift.notes,
            now,
            now,
          ]
        );
      }

      return tx.query('SELECT * FROM shifts WHERE date >= ? AND date <= ? ORDER BY date ASC;', [targetMonStr, targetSunStr]);
    });

    dbEvents.emit('shifts_changed');
    return result;
  },

  async deleteShift(id: string) {
    const db = getDatabase();
    await db.execute('DELETE FROM shifts WHERE id = ?;', [id]);
    dbEvents.emit('shifts_changed');
    return { success: true };
  },
};
