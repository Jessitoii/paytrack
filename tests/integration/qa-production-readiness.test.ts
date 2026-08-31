import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../server/src/app.js';
import { prisma } from '../../server/src/db/prisma.js';
import type { FastifyInstance } from 'fastify';

describe('QA Production Readiness & Failure Path Audit Tests', () => {
  let app: FastifyInstance;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let userACategoryId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Clean up
    await prisma.expense.deleteMany();
    await prisma.recurringExpense.deleteMany();
    await prisma.savingsGoal.deleteMany();
    await prisma.workBreak.deleteMany();
    await prisma.workSession.deleteMany();
    await prisma.payrollCalculation.deleteMany();
    await prisma.payrollWeek.deleteMany();
    await prisma.employment.deleteMany();
    await prisma.employer.deleteMany();
    await prisma.expenseCategory.deleteMany();
    await prisma.user.deleteMany();

    // Register User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'qa.userA@paytrack.app', password: 'password123', name: 'User A' },
    });
    const bodyA = JSON.parse(resA.body);
    userAToken = bodyA.token;
    userAId = bodyA.user.id;

    // Register User B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'qa.userB@paytrack.app', password: 'password123', name: 'User B' },
    });
    const bodyB = JSON.parse(resB.body);
    userBToken = bodyB.token;
    userBId = bodyB.user.id;

    // User A creates an employment
    const employerA = await prisma.employer.create({
      data: { name: 'AH Distribution BLE', agency: 'Carriere' },
    });
    await prisma.employment.create({
      data: { userId: userAId, employerId: employerA.id, startDate: new Date('2026-01-01'), isActive: true },
    });

    // User A creates a custom private category
    const cat = await prisma.expenseCategory.create({
      data: { name: 'Private User A Only', userId: userAId, icon: 'lock', color: '#EF4444', isDefault: false },
    });
    userACategoryId = cat.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('1. Work Session Guards & Double-Start Protection', () => {
    let activeSessionId: string;

    it('successfully starts a work session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/work/start',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: { actualStart: new Date('2026-08-24T14:30:00Z').toISOString() },
      });

      expect(res.statusCode).toBe(201);
      activeSessionId = JSON.parse(res.body).session.id;
    });

    it('rejects accidental double Start Work while session is already in progress', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/work/start',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: { actualStart: new Date('2026-08-24T15:00:00Z').toISOString() },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('active work session is already in progress');
    });

    it('rejects finish when rawFinish is earlier than actualStart', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/work/${activeSessionId}/finish`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: { rawFinish: new Date('2026-08-24T13:00:00Z').toISOString() },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('earlier than start timestamp');
    });

    it('successfully finishes active work session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/work/${activeSessionId}/finish`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          rawFinish: new Date('2026-08-24T23:21:00Z').toISOString(),
          breaks: [{ type: 'UNPAID_30', durationMinutes: 30, isPaid: false }],
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it('rejects finishing an already finished work session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/work/${activeSessionId}/finish`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: { rawFinish: new Date('2026-08-24T23:30:00Z').toISOString() },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('already been completed');
    });
  });

  describe('2. Security & IDOR Failure Paths', () => {
    it('User B cannot create an expense with User A private category', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/expenses',
        headers: { authorization: `Bearer ${userBToken}` },
        payload: {
          categoryId: userACategoryId,
          amount: 45.0,
          date: '2026-08-24T12:00:00Z',
          description: 'Hacking attempt',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('Invalid or unauthorized expense category');
    });

    it('User B cannot create a recurring expense with User A private category', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/recurring-expenses',
        headers: { authorization: `Bearer ${userBToken}` },
        payload: {
          categoryId: userACategoryId,
          name: 'Unauthorized subscription',
          amount: 15.0,
          frequency: 'MONTHLY',
          dayOfMonth: 1,
          startDate: '2026-09-01T00:00:00Z',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('Invalid or unauthorized expense category');
    });

    it('API returns 401 Unauthorized for expired or missing JWT tokens', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/work',
        headers: { authorization: 'Bearer invalid.or.expired.jwt.token' },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
