import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase } from '../local-db/test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import { simulateWeek } from '../../src/payroll/weekSimulator';
import { getDatabase } from '../../src/database/db';

describe('In-Memory Week Simulation Engine', () => {
  beforeEach(async () => {
    setupTestDatabase();
    await initializeDatabase();
  });

  it('should compute deterministic gross and net for 40 hours without modifying database records', async () => {
    const db = getDatabase();

    const initialSessions = await db.query('SELECT * FROM work_sessions;');
    const initialPayslips = await db.query('SELECT * FROM payslips;');
    const initialExpenses = await db.query('SELECT * FROM expenses;');

    const res = simulateWeek({
      totalHours: 40,
      unpaidBreakMinutes: 30,
    });

    expect(res.paidHours).toBeCloseTo(39.5, 1);
    expect(res.estimatedGross).toBeGreaterThan(500);
    expect(res.estimatedNet).toBeGreaterThan(400);
    expect(res.estimatedBankPayout).toBeGreaterThan(400);
    expect(res.advAllowance).toBeGreaterThan(40);
    expect(res.holidayAllowance).toBeGreaterThan(40);
    expect(res.projectedWeeklySavings).toBeDefined();

    // Verify database remains completely untouched
    const afterSessions = await db.query('SELECT * FROM work_sessions;');
    const afterPayslips = await db.query('SELECT * FROM payslips;');
    const afterExpenses = await db.query('SELECT * FROM expenses;');

    expect(afterSessions.length).toBe(initialSessions.length);
    expect(afterPayslips.length).toBe(initialPayslips.length);
    expect(afterExpenses.length).toBe(initialExpenses.length);
  });

  it('should support day-by-day shift simulation', async () => {
    const res = simulateWeek({
      days: [
        { day: 'Monday', hours: 8 },
        { day: 'Tuesday', hours: 8 },
        { day: 'Wednesday', hours: 8 },
        { day: 'Thursday', hours: 8 },
        { day: 'Friday', hours: 8 },
        { day: 'Saturday', hours: 0 },
        { day: 'Sunday', hours: 0 },
      ],
      unpaidBreakMinutes: 0,
    });

    expect(res.paidHours).toBe(40.0);
    expect(res.hourlyRate).toBe(14.99);
    expect(res.baseGross).toBeCloseTo(40 * 14.99, 1);
  });
});
