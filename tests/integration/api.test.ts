import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../server/src/app.js';
import { prisma } from '../../server/src/db/prisma.js';
import type { FastifyInstance } from 'fastify';

describe('Fastify Work & Shift API Integration Tests', () => {
  let app: FastifyInstance;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let employmentAId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Clean up test data
    await prisma.workBreak.deleteMany();
    await prisma.workSession.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.employment.deleteMany();
    await prisma.employer.deleteMany();
    await prisma.user.deleteMany();

    // 1. Create User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'userA@test.com',
        password: 'password123',
        name: 'User A',
      },
    });
    const dataA = JSON.parse(resA.body);
    userAToken = dataA.token;
    userAId = dataA.user.id;

    // 2. Create User B (for isolation testing)
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'userB@test.com',
        password: 'password123',
        name: 'User B',
      },
    });
    const dataB = JSON.parse(resB.body);
    userBToken = dataB.token;
    userBId = dataB.user.id;

    // 3. Create Employer & Employment for User A
    const employer = await prisma.employer.create({
      data: {
        name: 'Albert Heijn Bleiswijk',
        agency: 'Carrière',
      },
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
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('Health and Authentication', () => {
    it('GET /api/health returns 200 ok', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.status).toBe('ok');
    });

    it('GET /api/auth/me returns authenticated user profile', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${userAToken}` },
      });
      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.user.email).toBe('userA@test.com');
    });

    it('rejects unauthenticated requests to protected endpoints', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/work',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Work Tracking API (1-Tap Start, Finish, 5-Min Rounding & Breaks)', () => {
    let activeSessionId: string;

    it('POST /api/work/start creates an active work session', async () => {
      const startTimestamp = new Date('2026-08-17T14:30:00');
      const res = await app.inject({
        method: 'POST',
        url: '/api/work/start',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          actualStart: startTimestamp.toISOString(),
          notes: 'Started afternoon shift',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.session.status).toBe('WORKING');
      expect(json.session.userId).toBe(userAId);
      activeSessionId = json.session.id;
    });

    it('POST /api/work/:id/finish records raw finish, applies 5-min ceiling rounding, and calculates breaks', async () => {
      // Raw finish 23:21:15 -> rounded finish must be 23:25:00
      const rawFinish = new Date('2026-08-17T23:21:15');
      const breaks = [
        { type: 'PAID_15', durationMinutes: 15, isPaid: true, name: 'Paid coffee' },
        { type: 'UNPAID_30', durationMinutes: 30, isPaid: false, name: 'Lunch' },
      ];

      const res = await app.inject({
        method: 'POST',
        url: `/api/work/${activeSessionId}/finish`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          rawFinish: rawFinish.toISOString(),
          breaks,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.session.status).toBe('COMPLETED');

      // Raw finish preserved
      expect(new Date(json.session.rawFinish).getMinutes()).toBe(21);
      // Rounded finish ceiling to 25
      expect(new Date(json.session.roundedFinish).getMinutes()).toBe(25);

      // Duration verification
      expect(json.calculation.elapsedMinutes).toBe(535); // 8h 55m
      expect(json.calculation.unpaidBreakMinutes).toBe(30);
      expect(json.calculation.paidBreakMinutes).toBe(15);
      expect(json.calculation.paidMinutes).toBe(505); // 8h 25m

      // Cache fields in DB match calculation
      expect(json.session.paidMinutes).toBe(505);
      expect(json.session.elapsedMinutes).toBe(535);
    });

    it('PATCH /api/work/:id manually updates times and recalculates derived metrics deterministically', async () => {
      const updatedStart = new Date('2026-08-17T14:00:00');
      const updatedFinish = new Date('2026-08-17T23:26:00'); // rounds to 23:30

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/work/${activeSessionId}`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          actualStart: updatedStart.toISOString(),
          rawFinish: updatedFinish.toISOString(),
          notes: 'Adjusted start time to 14:00',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(new Date(json.session.roundedFinish).getMinutes()).toBe(30);
      expect(json.session.notes).toBe('Adjusted start time to 14:00');
      expect(json.session.elapsedMinutes).toBe(570); // 9h 30m
      expect(json.session.paidMinutes).toBe(540); // 9h 00m (570 - 30)
    });

    it('GET /api/work lists work sessions for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/work',
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Midnight Crossing Shift Verification', () => {
    it('handles night shift crossing midnight without error or negative duration', async () => {
      // 23:00 -> 06:00 (next day)
      const start = new Date('2026-08-17T23:00:00');
      const finish = new Date('2026-08-18T06:00:00');

      const startRes = await app.inject({
        method: 'POST',
        url: '/api/work/start',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: { actualStart: start.toISOString() },
      });
      const session = JSON.parse(startRes.body).session;

      const finishRes = await app.inject({
        method: 'POST',
        url: `/api/work/${session.id}/finish`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          rawFinish: finish.toISOString(),
          breaks: [{ type: 'UNPAID_30', durationMinutes: 30, isPaid: false }],
        },
      });

      expect(finishRes.statusCode).toBe(200);
      const json = JSON.parse(finishRes.body);
      expect(json.calculation.elapsedMinutes).toBe(420); // 7h 00m
      expect(json.calculation.paidMinutes).toBe(390); // 6h 30m
    });
  });

  describe('Shift Planning API', () => {
    let createdShiftId: string;

    it('POST /api/shifts creates a planned shift', async () => {
      const shiftDate = new Date('2026-08-24T00:00:00');
      const plannedStart = new Date('2026-08-24T06:00:00');
      const plannedEnd = new Date('2026-08-24T14:30:00');

      const res = await app.inject({
        method: 'POST',
        url: '/api/shifts',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          employmentId: employmentAId,
          date: shiftDate.toISOString(),
          shiftType: 'MORNING',
          plannedStart: plannedStart.toISOString(),
          plannedEnd: plannedEnd.toISOString(),
          notes: 'Week A Morning rotation',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.shift.shiftType).toBe('MORNING');
      createdShiftId = json.shift.id;
    });

    it('PATCH /api/shifts/:id updates planned shift details', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/shifts/${createdShiftId}`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          notes: 'Updated note: morning shift starts at gate 3',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.shift.notes).toBe('Updated note: morning shift starts at gate 3');
    });

    it('GET /api/shifts retrieves planned shifts for user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/shifts',
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.shifts.length).toBeGreaterThanOrEqual(1);
    });

    it('DELETE /api/shifts/:id deletes shift', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/shifts/${createdShiftId}`,
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('Strict Multi-Tenant User Isolation', () => {
    let sessionUserAId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/work/start',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: { notes: 'User A private session' },
      });
      sessionUserAId = JSON.parse(res.body).session.id;
    });

    it('User B cannot access or view User A work session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/work/${sessionUserAId}`,
        headers: { authorization: `Bearer ${userBToken}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('User B cannot modify or finish User A work session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/work/${sessionUserAId}/finish`,
        headers: { authorization: `Bearer ${userBToken}` },
        payload: { rawFinish: new Date().toISOString() },
      });

      expect(res.statusCode).toBe(400);
    });

    it('User B cannot delete User A work session', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/work/${sessionUserAId}`,
        headers: { authorization: `Bearer ${userBToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
