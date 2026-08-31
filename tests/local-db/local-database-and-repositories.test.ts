import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDatabase } from './test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import { userRepository } from '../../src/database/repositories/userRepository';
import { shiftRepository } from '../../src/database/repositories/shiftRepository';
import { workRepository } from '../../src/database/repositories/workRepository';
import { financeRepository } from '../../src/database/repositories/financeRepository';
import { exportDatabaseToJson, importDatabaseFromJson } from '../../src/database/backup';

describe('PayTrack Local SQLite Database & Repository Engine Tests', () => {
  beforeAll(async () => {
    // Setup in-memory test SQLite client and initialize schema
    setupTestDatabase();
    await initializeDatabase();
  });

  it('initializes database with default profile, employment, and CAO configs', async () => {
    const profile = await userRepository.getProfile();
    expect(profile).toBeDefined();
    expect(profile.name).toBe('Alper Ozer');
    expect(profile.timezone).toBe('Europe/Amsterdam');
    expect(profile.currency).toBe('EUR');

    const employment = await userRepository.getActiveEmployment();
    expect(employment).toBeDefined();
    expect(employment.employerName).toBe('Albert Heijn B.V. Bleiswijk');

    const configs = await userRepository.listPayrollConfigurations();
    expect(configs.length).toBeGreaterThanOrEqual(2);
    expect(configs[0].baseHourlyRate).toBe(14.99);
  });

  it('performs 7-day atomic bulk shift scheduling and previous week copying', async () => {
    const weekStart = '2026-08-17'; // Monday

    const shifts = await shiftRepository.bulkSaveWeek({
      weekStartDate: weekStart,
      shifts: [
        { date: '2026-08-17', shiftType: 'AFTERNOON', plannedStart: '2026-08-17T14:30:00.000Z', plannedEnd: '2026-08-17T23:00:00.000Z' },
        { date: '2026-08-18', shiftType: 'AFTERNOON', plannedStart: '2026-08-18T14:30:00.000Z', plannedEnd: '2026-08-18T23:00:00.000Z' },
        { date: '2026-08-19', shiftType: 'AFTERNOON', plannedStart: '2026-08-19T14:30:00.000Z', plannedEnd: '2026-08-19T23:00:00.000Z' },
        { date: '2026-08-20', shiftType: 'AFTERNOON', plannedStart: '2026-08-20T14:30:00.000Z', plannedEnd: '2026-08-20T23:00:00.000Z' },
        { date: '2026-08-21', shiftType: 'AFTERNOON', plannedStart: '2026-08-21T14:30:00.000Z', plannedEnd: '2026-08-21T23:00:00.000Z' },
        { date: '2026-08-22', shiftType: 'OFF', isDayOff: true },
        { date: '2026-08-23', shiftType: 'OFF', isDayOff: true },
      ],
    });

    expect(shifts.length).toBe(7);
    expect(shifts[0].shiftType).toBe('AFTERNOON');

    // Copy to next week
    const copied = await shiftRepository.copyPreviousWeek({
      targetWeekStartDate: '2026-08-24',
    });
    expect(copied.length).toBe(7);
    expect(copied[0].date).toBe('2026-08-24');
    expect(copied[0].shiftType).toBe('AFTERNOON');
  });

  it('records 1-tap start work and prevents duplicate active sessions', async () => {
    const session = await workRepository.startWork({
      actualStart: new Date('2026-08-24T14:30:00.000Z'),
      notes: 'Starting test shift',
    });
    expect(session).toBeDefined();
    expect(session?.status).toBe('WORKING');

    // Duplicate start attempt must throw
    await expect(workRepository.startWork()).rejects.toThrow('already in progress');
  });

  it('finishes active work with custom finish time, breaks, and 5-minute upward rounding', async () => {
    const active = await workRepository.getActiveSession();
    expect(active).toBeDefined();

    // Finish at 23:21 with 15m paid + 30m unpaid break
    const result = await workRepository.finishWork(active!.id, {
      rawFinish: new Date('2026-08-24T23:21:00.000Z'),
      breaks: [
        { type: 'PAID_15', durationMinutes: 15, isPaid: true, name: 'Paid Coffee' },
        { type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: 'Meal' },
      ],
      notes: 'Shift finished smoothly',
    });

    expect(result.session?.status).toBe('COMPLETED');
    // 23:21 ceiling rounds to 23:25
    expect(result.session?.roundedFinish).toBe('2026-08-24T23:25:00.000Z');
    expect(result.calculation.elapsedMinutes).toBe(535); // 14:30 to 23:25 = 8h 55m
    expect(result.calculation.paidMinutes).toBe(505); // 535 - 30m = 8h 25m
  });

  it('allows editing past work session and recalculates derived rounding & payroll', async () => {
    const sessions = await workRepository.listWorkSessions();
    const targetSession = sessions[0];
    expect(targetSession).toBeDefined();

    // Edit start to 14:37 and finish to 23:17
    const result = await workRepository.updateWork(targetSession.id, {
      actualStart: new Date('2026-08-24T14:37:00.000Z'),
      rawFinish: new Date('2026-08-24T23:17:00.000Z'),
      breaks: [
        { type: 'PAID_15', durationMinutes: 15, isPaid: true, name: 'Paid Coffee' },
        { type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: 'Meal' },
      ],
      notes: 'Corrected punch times',
    });

    // 23:17 ceiling rounds to 23:20
    expect(result.session?.roundedFinish).toBe('2026-08-24T23:20:00.000Z');
    // 14:37 to 23:20 = 523m elapsed, paid = 523 - 30 = 493m
    expect(result.calculation?.elapsedMinutes).toBe(523);
    expect(result.calculation?.paidMinutes).toBe(493);
  });

  it('reaggregates both old and new ISO weeks when moving a session date across weeks', async () => {
    // 1. Create a session in Week 35 (2026-08-25)
    const res = await workRepository.createManualWork({
      actualStart: new Date('2026-08-25T14:30:00.000Z'),
      rawFinish: new Date('2026-08-25T23:00:00.000Z'),
      breaks: [{ type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: 'Meal' }],
    });
    const sessionId = res.session.id;

    // 2. Move to Week 36 (2026-09-01)
    await workRepository.updateWork(sessionId, {
      actualStart: new Date('2026-09-01T14:30:00.000Z'),
      rawFinish: new Date('2026-09-01T23:00:00.000Z'),
    });

    // Verify Week 36 has the calculation
    const week36 = await workRepository.getWeeklyCalculation(new Date('2026-09-01'));
    expect(week36?.calculation?.paidMinutes).toBe(480);
  });

  it('executes finance operations, expenses, savings goals, and monthly forecast locally', async () => {
    // Add Expense
    const expense = await financeRepository.createExpense({
      categoryId: 'cat_food',
      amount: 65.40,
      date: new Date(),
      description: 'Weekly Groceries at Albert Heijn',
    });
    expect(expense).toBeDefined();
    expect(expense.amount).toBe(65.4);

    // Add Goal
    const goal = await financeRepository.createSavingsGoal({
      name: 'Holiday Trip',
      targetAmount: 2000,
      currentAmount: 500,
    });
    expect(goal.progressPercentage).toBe(25);

    // Monthly Overview
    const overview = await financeRepository.getMonthlyOverview();
    expect(overview.expenses.total).toBeGreaterThanOrEqual(65.4);

    // 6-Month Forecast
    const forecast = await financeRepository.getForecast(6);
    expect(forecast.projections.length).toBe(6);
  });

  it('creates JSON backup and atomically restores database from backup', async () => {
    const backup = await exportDatabaseToJson();
    expect(backup.version).toBe(2);
    expect(backup.userProfile.length).toBe(1);
    expect(backup.workSessions.length).toBeGreaterThan(0);

    const restoreRes = await importDatabaseFromJson(backup);
    expect(restoreRes.success).toBe(true);

    const profileAfter = await userRepository.getProfile();
    expect(profileAfter.name).toBe('Alper Ozer');
  });
});
