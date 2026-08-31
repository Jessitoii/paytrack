import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../server/src/app';
import { prisma } from '../../server/src/db/prisma';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

describe('Advanced Shifts Calendar, Bulk Planning, Auto-Start & Manual Work Tests', () => {
  let app: FastifyInstance;
  let testUserId: string;
  let token: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Clean up test data
    await prisma.user.deleteMany({ where: { email: 'shifts.tester@paytrack.app' } });

    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await prisma.user.create({
      data: {
        email: 'shifts.tester@paytrack.app',
        passwordHash,
        name: 'Shift Tester',
        timezone: 'Europe/Amsterdam',
        currency: 'EUR',
      },
    });
    testUserId = user.id;

    const employer = await prisma.employer.create({
      data: { name: 'AH Bleiswijk', agency: 'Carrière' },
    });

    await prisma.employment.create({
      data: {
        userId: testUserId,
        employerId: employer.id,
        startDate: new Date('2026-01-01'),
        isActive: true,
      },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'shifts.tester@paytrack.app', password: 'password123' },
    });

    token = JSON.parse(loginRes.body).token;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('saves an entire 7-day week schedule in a single atomic transaction', async () => {
    const monday = new Date('2026-09-07T00:00:00.000Z');

    const shifts = [
      { date: new Date('2026-09-07T00:00:00.000Z'), shiftType: 'MORNING', plannedStart: new Date('2026-09-07T06:00:00.000Z'), plannedEnd: new Date('2026-09-07T15:00:00.000Z'), isDayOff: false },
      { date: new Date('2026-09-08T00:00:00.000Z'), shiftType: 'AFTERNOON', plannedStart: new Date('2026-09-08T14:30:00.000Z'), plannedEnd: new Date('2026-09-08T23:00:00.000Z'), isDayOff: false },
      { date: new Date('2026-09-09T00:00:00.000Z'), shiftType: 'AFTERNOON', plannedStart: new Date('2026-09-09T14:30:00.000Z'), plannedEnd: new Date('2026-09-09T23:00:00.000Z'), isDayOff: false },
      { date: new Date('2026-09-10T00:00:00.000Z'), shiftType: 'AFTERNOON', plannedStart: new Date('2026-09-10T14:30:00.000Z'), plannedEnd: new Date('2026-09-10T23:00:00.000Z'), isDayOff: false },
      { date: new Date('2026-09-11T00:00:00.000Z'), shiftType: 'NIGHT', plannedStart: new Date('2026-09-11T22:30:00.000Z'), plannedEnd: new Date('2026-09-12T07:00:00.000Z'), isDayOff: false },
      { date: new Date('2026-09-12T00:00:00.000Z'), shiftType: 'OFF', isDayOff: true },
      { date: new Date('2026-09-13T00:00:00.000Z'), shiftType: 'OFF', isDayOff: true },
    ];

    const res = await app.inject({
      method: 'POST',
      url: '/api/shifts/bulk-week',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        weekStartDate: monday,
        shifts,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.shifts).toHaveLength(7);
    expect(json.shifts[0].shiftType).toBe('MORNING');
    expect(json.shifts[5].isDayOff).toBe(true);
  });

  it('copies previous week shifts into the following week atomically', async () => {
    const nextMonday = new Date('2026-09-14T00:00:00.000Z');

    const res = await app.inject({
      method: 'POST',
      url: '/api/shifts/copy-previous-week',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        targetWeekStartDate: nextMonday,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.shifts).toHaveLength(7);
    expect(json.shifts[0].shiftType).toBe('MORNING');
    expect(new Date(json.shifts[0].date).toISOString()).toBe('2026-09-14T00:00:00.000Z');
  });

  it('auto-starts scheduled shifts when plannedStart has arrived with duplicate protection', async () => {
    // 1. Create a planned shift starting 10 minutes in the past
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const inSevenHours = new Date(Date.now() + 7 * 60 * 60 * 1000);

    const shiftRes = await app.inject({
      method: 'POST',
      url: '/api/shifts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        date: new Date(),
        shiftType: 'AFTERNOON',
        plannedStart: tenMinAgo,
        plannedEnd: inSevenHours,
        isDayOff: false,
        notes: 'Testing Auto-Start',
      },
    });

    expect(shiftRes.statusCode).toBe(201);
    const createdShift = JSON.parse(shiftRes.body).shift;

    // 2. Trigger auto-start check
    const checkRes = await app.inject({
      method: 'GET',
      url: '/api/work/auto-start-check',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(checkRes.statusCode).toBe(200);
    const checkJson = JSON.parse(checkRes.body);
    expect(checkJson.autoStartedCount).toBeGreaterThanOrEqual(1);

    // Verify session is active in WORKING status
    const sessionsRes = await app.inject({
      method: 'GET',
      url: '/api/work',
      headers: { authorization: `Bearer ${token}` },
    });
    const active = JSON.parse(sessionsRes.body).sessions.find((s: any) => s.status === 'WORKING');
    expect(active).toBeDefined();
    expect(active.shiftId).toBe(createdShift.id);

    // 3. Trigger auto-start check AGAIN -> verify duplicate protection prevents another session
    const duplicateCheckRes = await app.inject({
      method: 'GET',
      url: '/api/work/auto-start-check',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(duplicateCheckRes.statusCode).toBe(200);
    expect(JSON.parse(duplicateCheckRes.body).autoStartedCount).toBe(0);

    // Clean up active session
    await app.inject({
      method: 'POST',
      url: `/api/work/${active.id}/finish`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
  });

  it('records manual past work session with 5-minute upward rounding and break deduction', async () => {
    const start = new Date('2026-08-20T14:37:00.000Z');
    const finish = new Date('2026-08-20T23:21:00.000Z');

    const res = await app.inject({
      method: 'POST',
      url: '/api/work/manual',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        actualStart: start,
        rawFinish: finish,
        breaks: [
          { type: 'PAID_15', durationMinutes: 15, isPaid: true, name: 'Coffee Break' },
          { type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: 'Meal Break' },
        ],
        notes: 'Forgot to punch in real-time',
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);

    // Finish 23:21 rounds up to 23:25
    expect(new Date(json.session.roundedFinish).toISOString()).toBe('2026-08-20T23:25:00.000Z');
    expect(json.session.isManualEntry).toBe(true);
    expect(json.session.status).toBe('COMPLETED');

    // Elapsed: 14:37 to 23:25 = 528 minutes (8h 48m)
    // Paid: 528 - 30m unpaid break = 498 minutes (8h 18m)
    expect(json.calculation.elapsedMinutes).toBe(528);
    expect(json.calculation.paidMinutes).toBe(498);
  });
});
