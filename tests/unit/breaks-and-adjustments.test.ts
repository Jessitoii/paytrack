import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDatabase } from '../local-db/test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import { calculateWorkSession } from '../../shared/time/periods';
import { workRepository } from '../../src/database/repositories/workRepository';
import { shiftRepository } from '../../src/database/repositories/shiftRepository';
import { financeRepository } from '../../src/database/repositories/financeRepository';
import { dbEvents } from '../../src/database/events';
import type { TimeBreak } from '../../shared/types/time';

describe('Multi-Break Logic & Mathematical Payroll Proof Tests', () => {
  const start = new Date('2026-08-24T14:30:00.000Z');
  const finish = new Date('2026-08-24T23:00:00.000Z'); // 510 elapsed mins (8h 30m)

  it('1 x 15m PAID break does NOT deduct from paidMinutes (elapsed = 510, paid = 510)', () => {
    const breaks: TimeBreak[] = [
      { id: '1', type: 'paid_15' as any, durationMinutes: 15, isPaid: true, name: 'Coffee 1' },
    ];
    const res = calculateWorkSession(start, finish, breaks);
    expect(res.elapsedMinutes).toBe(510);
    expect(res.paidBreakMinutes).toBe(15);
    expect(res.unpaidBreakMinutes).toBe(0);
    expect(res.paidMinutes).toBe(510); // UNCHANGED
  });

  it('2 x 15m PAID breaks do NOT deduct from paidMinutes (elapsed = 510, paid = 510)', () => {
    const breaks: TimeBreak[] = [
      { id: '1', type: 'paid_15' as any, durationMinutes: 15, isPaid: true, name: 'Coffee 1' },
      { id: '2', type: 'paid_15' as any, durationMinutes: 15, isPaid: true, name: 'Coffee 2' },
    ];
    const res = calculateWorkSession(start, finish, breaks);
    expect(res.elapsedMinutes).toBe(510);
    expect(res.paidBreakMinutes).toBe(30);
    expect(res.unpaidBreakMinutes).toBe(0);
    expect(res.paidMinutes).toBe(510); // UNCHANGED
  });

  it('3 x 15m PAID breaks do NOT deduct from paidMinutes (elapsed = 510, paid = 510)', () => {
    const breaks: TimeBreak[] = [
      { id: '1', type: 'paid_15' as any, durationMinutes: 15, isPaid: true, name: 'Coffee 1' },
      { id: '2', type: 'paid_15' as any, durationMinutes: 15, isPaid: true, name: 'Coffee 2' },
      { id: '3', type: 'paid_15' as any, durationMinutes: 15, isPaid: true, name: 'Coffee 3' },
    ];
    const res = calculateWorkSession(start, finish, breaks);
    expect(res.elapsedMinutes).toBe(510);
    expect(res.paidBreakMinutes).toBe(45);
    expect(res.unpaidBreakMinutes).toBe(0);
    expect(res.paidMinutes).toBe(510); // UNCHANGED
  });

  it('1 x 30m UNPAID break deducts exactly 30 minutes (paidMinutes = 480)', () => {
    const breaks: TimeBreak[] = [
      { id: '1', type: 'unpaid_30' as any, durationMinutes: 30, isPaid: false, name: 'Meal' },
    ];
    const res = calculateWorkSession(start, finish, breaks);
    expect(res.elapsedMinutes).toBe(510);
    expect(res.unpaidBreakMinutes).toBe(30);
    expect(res.paidMinutes).toBe(480); // 510 - 30 = 480
  });

  it('2 x 30m UNPAID breaks deduct exactly 60 minutes (paidMinutes = 450)', () => {
    const breaks: TimeBreak[] = [
      { id: '1', type: 'unpaid_30' as any, durationMinutes: 30, isPaid: false, name: 'Meal 1' },
      { id: '2', type: 'unpaid_30' as any, durationMinutes: 30, isPaid: false, name: 'Meal 2' },
    ];
    const res = calculateWorkSession(start, finish, breaks);
    expect(res.elapsedMinutes).toBe(510);
    expect(res.unpaidBreakMinutes).toBe(60);
    expect(res.paidMinutes).toBe(450); // 510 - 60 = 450
  });

  it('15m PAID + 30m UNPAID deducts ONLY 30 minutes (paidMinutes = 480)', () => {
    const breaks: TimeBreak[] = [
      { id: '1', type: 'paid_15' as any, durationMinutes: 15, isPaid: true, name: 'Coffee' },
      { id: '2', type: 'unpaid_30' as any, durationMinutes: 30, isPaid: false, name: 'Meal' },
    ];
    const res = calculateWorkSession(start, finish, breaks);
    expect(res.elapsedMinutes).toBe(510);
    expect(res.paidBreakMinutes).toBe(15);
    expect(res.unpaidBreakMinutes).toBe(30);
    expect(res.paidMinutes).toBe(480); // 510 - 30 = 480
  });

  it('15m PAID + 15m PAID + 30m UNPAID deducts ONLY 30 minutes (paidMinutes = 480)', () => {
    const breaks: TimeBreak[] = [
      { id: '1', type: 'paid_15' as any, durationMinutes: 15, isPaid: true, name: 'Coffee 1' },
      { id: '2', type: 'unpaid_30' as any, durationMinutes: 30, isPaid: false, name: 'Meal' },
      { id: '3', type: 'paid_15' as any, durationMinutes: 15, isPaid: true, name: 'Coffee 2' },
    ];
    const res = calculateWorkSession(start, finish, breaks);
    expect(res.elapsedMinutes).toBe(510);
    expect(res.paidBreakMinutes).toBe(30);
    expect(res.unpaidBreakMinutes).toBe(30);
    expect(res.paidMinutes).toBe(480); // 510 - 30 = 480
  });

  it('supports custom duration breaks (e.g. 20m paid + 45m unpaid -> 510 - 45 = 465)', () => {
    const breaks: TimeBreak[] = [
      { id: '1', type: 'custom_paid' as any, durationMinutes: 20, isPaid: true, name: 'Extended Coffee' },
      { id: '2', type: 'custom_unpaid' as any, durationMinutes: 45, isPaid: false, name: 'Dinner' },
    ];
    const res = calculateWorkSession(start, finish, breaks);
    expect(res.elapsedMinutes).toBe(510);
    expect(res.paidBreakMinutes).toBe(20);
    expect(res.unpaidBreakMinutes).toBe(45);
    expect(res.paidMinutes).toBe(465); // 510 - 45 = 465
  });
});

describe('Shift Start Adjustment & Auto-Start Reconciliation Tests', () => {
  beforeAll(async () => {
    setupTestDatabase();
    await initializeDatabase();
  });

  it('saves shift with +15 min late adjustment, preserving plannedStart and computing expectedActualStart', async () => {
    const shift = await shiftRepository.saveShift({
      date: '2026-09-17',
      shiftType: 'AFTERNOON',
      plannedStart: '2026-09-17T14:30:00.000Z',
      plannedEnd: '2026-09-17T23:00:00.000Z',
      startAdjustmentMinutes: 15,
    });

    expect(shift.plannedStart).toBe('2026-09-17T14:30:00.000Z');
    expect(shift.startAdjustmentMinutes).toBe(15);
    expect(shift.expectedActualStart).toBe('2026-09-17T14:45:00.000Z');
  });

  it('saves shift with +30 min late adjustment', async () => {
    const shift = await shiftRepository.saveShift({
      date: '2026-09-18',
      shiftType: 'AFTERNOON',
      plannedStart: '2026-09-18T14:30:00.000Z',
      plannedEnd: '2026-09-18T23:00:00.000Z',
      startAdjustmentMinutes: 30,
    });

    expect(shift.plannedStart).toBe('2026-09-18T14:30:00.000Z');
    expect(shift.startAdjustmentMinutes).toBe(30);
    expect(shift.expectedActualStart).toBe('2026-09-18T15:00:00.000Z');
  });

  it('auto-start reconciliation anchors actualStart to expectedActualStart (14:45) when adjustment is present', async () => {
    // Setup shift in the past relative to execution
    const pastShift = await shiftRepository.saveShift({
      date: '2026-01-05',
      shiftType: 'AFTERNOON',
      plannedStart: '2026-01-05T14:30:00.000Z',
      plannedEnd: '2026-01-05T23:00:00.000Z',
      startAdjustmentMinutes: 15,
    });

    const res = await workRepository.reconcileAutoStart();
    expect(res.autoStartedCount).toBe(1);
    expect(res.sessions[0].actualStart).toBe('2026-01-05T14:45:00.000Z');
    expect(res.sessions[0].shiftId).toBe(pastShift.id);

    // Clean up active session for subsequent tests
    await workRepository.deleteWork(res.sessions[0].id);
  });
});

describe('Database Reactivity & Change Event Tests', () => {
  beforeAll(async () => {
    setupTestDatabase();
    await initializeDatabase();
  });

  it('emits work_changed when work session is started, finished, or edited', async () => {
    let workEventsCount = 0;
    const unsub = dbEvents.subscribe('work_changed', () => {
      workEventsCount++;
    });

    const session = await workRepository.startWork({
      actualStart: new Date('2026-08-25T14:30:00.000Z'),
    });
    expect(workEventsCount).toBe(1);

    await workRepository.finishWork(session!.id, {
      rawFinish: new Date('2026-08-25T23:17:00.000Z'),
      breaks: [
        { type: 'PAID_15', durationMinutes: 15, isPaid: true, name: 'Coffee 1' },
        { type: 'PAID_15', durationMinutes: 15, isPaid: true, name: 'Coffee 2' },
        { type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: 'Meal' },
      ],
    });
    expect(workEventsCount).toBe(2);

    unsub();
  });

  it('emits finance_changed when an expense is recorded', async () => {
    let financeEventsCount = 0;
    const unsub = dbEvents.subscribe('finance_changed', () => {
      financeEventsCount++;
    });

    await financeRepository.createExpense({
      categoryId: 'cat_food',
      amount: 42.5,
      date: new Date(),
      description: 'Weekly Groceries',
    });
    expect(financeEventsCount).toBe(1);

    unsub();
  });
});
