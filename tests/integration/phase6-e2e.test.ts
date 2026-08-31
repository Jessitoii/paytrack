import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../server/src/app.js';
import { prisma } from '../../server/src/db/prisma.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 6 End-to-End Integration & Mobile Flow Tests', () => {
  let app: FastifyInstance;
  let userToken: string;
  let userId: string;
  let foodCatId: string;

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

    // Seed default categories
    const food = await prisma.expenseCategory.create({
      data: { name: 'Food & Groceries', icon: 'utensils', color: '#10B981', isDefault: true },
    });
    foodCatId = food.id;

    await prisma.expenseCategory.create({
      data: { name: 'Rent & Housing', icon: 'home', color: '#3B82F6', isDefault: true },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('1. Mobile Auth Flow: Register -> Login -> Profile -> Guard', () => {
    it('registers a new shift worker', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'worker.phase6@paytrack.app',
          password: 'securePassword123',
          name: 'Alper Can Ozer',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.token).toBeDefined();
      expect(json.user.name).toBe('Alper Can Ozer');
      userId = json.user.id;
    });

    it('logs in and returns secure JWT token and user profile', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'worker.phase6@paytrack.app',
          password: 'securePassword123',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.token).toBeDefined();
      userToken = json.token;
    });

    it('GET /api/auth/me validates restored token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.user.id).toBe(userId);
    });
  });

  describe('2. Live Weekly Estimate Aggregation upon Work Finish & Edit', () => {
    let sessionId: string;

    beforeAll(async () => {
      // Create Employer & Employment for live calculations
      const employer = await prisma.employer.create({
        data: { name: 'Albert Heijn Bleiswijk', agency: 'Carrière' },
      });
      await prisma.employment.create({
        data: {
          userId,
          employerId: employer.id,
          startDate: new Date('2026-01-01'),
          isActive: true,
        },
      });
    });

    it('finishing a work session automatically creates/updates PayrollWeek and PayrollCalculation', async () => {
      // Start session
      const startRes = await app.inject({
        method: 'POST',
        url: '/api/work/start',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { actualStart: new Date('2026-08-24T14:30:00').toISOString() },
      });
      sessionId = JSON.parse(startRes.body).session.id;

      // Finish session (14:30 -> 23:21 rounds to 23:25 = 535m elapsed, 30m unpaid break = 505m paid = 8h 25m)
      const finishRes = await app.inject({
        method: 'POST',
        url: `/api/work/${sessionId}/finish`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          rawFinish: new Date('2026-08-24T23:21:00').toISOString(),
          breaks: [{ type: 'UNPAID_30', durationMinutes: 30, isPaid: false }],
        },
      });

      expect(finishRes.statusCode).toBe(200);

      // Verify that PayrollWeek for Week 35 was automatically created/aggregated
      const weekRecord = await prisma.payrollWeek.findFirst({
        where: { userId, year: 2026, weekNumber: 35 },
        include: { calculation: true },
      });

      expect(weekRecord).toBeDefined();
      expect(weekRecord?.status).toBe('ESTIMATED');
      expect(weekRecord?.calculation?.paidMinutes).toBe(505);
      expect(Number(weekRecord?.calculation?.totalGross)).toBeGreaterThan(0);
    });

    it('editing session updates live weekly aggregated PayrollCalculation', async () => {
      // Edit session to finish at 23:26 (rounds to 23:30 = 540m elapsed, 30m unpaid break = 510m paid)
      const editRes = await app.inject({
        method: 'PATCH',
        url: `/api/work/${sessionId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          rawFinish: new Date('2026-08-24T23:26:00').toISOString(),
        },
      });

      expect(editRes.statusCode).toBe(200);

      // Verify aggregated calculation updated to 510 paid minutes (540m elapsed - 30m break)
      const weekRecord = await prisma.payrollWeek.findFirst({
        where: { userId, year: 2026, weekNumber: 35 },
        include: { calculation: true },
      });

      expect(weekRecord?.calculation?.paidMinutes).toBe(510);
    });
  });

  describe('3. Dynamic Expense Categories & Validation', () => {
    it('GET /api/finance/categories retrieves default system categories', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/finance/categories',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.categories.length).toBeGreaterThanOrEqual(2);
      expect(json.categories.some((c: any) => c.name === 'Food & Groceries')).toBe(true);
    });

    it('POST /api/finance/expenses succeeds with valid selected category', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/expenses',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          categoryId: foodCatId,
          amount: 28.95,
          date: '2026-08-25T12:00:00Z',
          description: 'Lunch at cafeteria',
          merchant: 'AH To Go',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.expense.amount).toBe('28.95');
      expect(json.expense.category.name).toBe('Food & Groceries');
    });

    it('rejects expense creation with invalid or non-existent categoryId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/expenses',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          categoryId: 'non-existent-cat-id',
          amount: 50.0,
          date: '2026-08-25T12:00:00Z',
          description: 'Invalid test',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toContain('Invalid or unauthorized expense category');
    });
  });
});
