import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../server/src/app.js';
import { prisma } from '../../server/src/db/prisma.js';
import type { FastifyInstance } from 'fastify';

describe('Personal Finance & Forecasting Integration Tests', () => {
  let app: FastifyInstance;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let foodCategoryId: string;
  let housingCategoryId: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Clean up
    await prisma.expense.deleteMany();
    await prisma.recurringExpense.deleteMany();
    await prisma.savingsGoal.deleteMany();
    await prisma.expenseCategory.deleteMany();
    await prisma.user.deleteMany();

    // Create User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'finA@paytrack.app', password: 'password123', name: 'Alper Ozer' },
    });
    const dataA = JSON.parse(resA.body);
    userAToken = dataA.token;
    userAId = dataA.user.id;

    // Create User B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'finB@paytrack.app', password: 'password123', name: 'Other User' },
    });
    userBToken = JSON.parse(resB.body).token;
    userBId = JSON.parse(resB.body).user.id;

    // Create Categories
    const foodCat = await prisma.expenseCategory.create({
      data: { name: 'Food', icon: 'utensils', color: '#10B981', isDefault: true },
    });
    foodCategoryId = foodCat.id;

    const housingCat = await prisma.expenseCategory.create({
      data: { name: 'Housing', icon: 'home', color: '#3B82F6', isDefault: true },
    });
    housingCategoryId = housingCat.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('1. Expense Management (CRUD)', () => {
    let createdExpenseId: string;

    it('POST /api/finance/expenses creates a new expense', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/expenses',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          categoryId: foodCategoryId,
          amount: 35.40,
          date: '2026-08-20T12:00:00Z',
          description: 'Groceries at Albert Heijn',
          merchant: 'Albert Heijn',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.expense.amount).toBe('35.4');
      expect(json.expense.category.name).toBe('Food');
      createdExpenseId = json.expense.id;
    });

    it('GET /api/finance/expenses lists expenses for user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/finance/expenses',
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.expenses.length).toBe(1);
    });

    it('PATCH /api/finance/expenses/:id updates expense amount and description', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/finance/expenses/${createdExpenseId}`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          amount: 42.50,
          description: 'Updated Groceries at Albert Heijn',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.expense.amount).toBe('42.5');
      expect(json.expense.description).toBe('Updated Groceries at Albert Heijn');
    });

    it('DELETE /api/finance/expenses/:id deletes expense', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/finance/expenses/${createdExpenseId}`,
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe('2. Recurring Expenses', () => {
    let recurringId: string;

    it('POST /api/finance/recurring-expenses creates a recurring bill', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/recurring-expenses',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          categoryId: housingCategoryId,
          name: 'Apartment Rent',
          amount: 800.00,
          frequency: 'MONTHLY',
          dayOfMonth: 1,
          startDate: '2026-01-01T00:00:00Z',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.recurringExpense.name).toBe('Apartment Rent');
      recurringId = json.recurringExpense.id;
    });

    it('GET /api/finance/recurring-expenses lists active recurring expenses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/finance/recurring-expenses',
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.recurringExpenses.length).toBe(1);
    });
  });

  describe('3. Savings Goals', () => {
    let goalId: string;

    it('POST /api/finance/savings-goals creates goal and computes progress', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/finance/savings-goals',
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          name: 'Emergency Fund',
          targetAmount: 5000.0,
          currentAmount: 2000.0,
          color: '#10B981',
          icon: 'shield',
        },
      });

      expect(res.statusCode).toBe(201);
      const json = JSON.parse(res.body);
      expect(json.goal.name).toBe('Emergency Fund');
      goalId = json.goal.id;
    });

    it('GET /api/finance/savings-goals returns goals with computed progress percentage', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/finance/savings-goals',
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.goals[0].progressPercentage).toBe(40); // 2000 / 5000 * 100
    });
  });

  describe('4. Monthly Financial Overview (GET /api/finance/overview)', () => {
    beforeAll(async () => {
      // Add expenses in August 2026
      await prisma.expense.createMany({
        data: [
          { userId: userAId, categoryId: foodCategoryId, amount: 250.0, date: new Date('2026-08-10'), description: 'Groceries' },
          { userId: userAId, categoryId: housingCategoryId, amount: 800.0, date: new Date('2026-08-01'), description: 'Rent' },
        ],
      });
    });

    it('calculates monthly income, expenses, savings and savings rate', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/finance/overview?year=2026&month=8',
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(res.statusCode).toBe(200);
      const { overview } = JSON.parse(res.body);
      expect(overview.year).toBe(2026);
      expect(overview.month).toBe(8);
      expect(overview.expenses.total).toBe(1050); // 250 + 800
      expect(overview.expenses.byCategory.length).toBe(2);
    });
  });

  describe('5. Deterministic Financial Forecasting (GET /api/finance/forecast)', () => {
    it('returns deterministic 3-, 6-, and 12-month projections and goal completion estimates', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/finance/forecast?horizonMonths=6',
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(res.statusCode).toBe(200);
      const { forecast } = JSON.parse(res.body);
      expect(forecast.horizonMonths).toBe(6);
      expect(forecast.projections.length).toBe(6);
      expect(forecast.projectedMonthlySavings).toBeGreaterThan(0);
      expect(forecast.goalsForecast[0].estimatedMonthsToReach).toBeDefined();
    });
  });

  describe('6. Finance User Isolation', () => {
    it('User B cannot access or modify User A expenses or savings goals', async () => {
      // User B lists expenses
      const expRes = await app.inject({
        method: 'GET',
        url: '/api/finance/expenses',
        headers: { authorization: `Bearer ${userBToken}` },
      });
      expect(JSON.parse(expRes.body).expenses.length).toBe(0);

      // User B lists goals
      const goalRes = await app.inject({
        method: 'GET',
        url: '/api/finance/savings-goals',
        headers: { authorization: `Bearer ${userBToken}` },
      });
      expect(JSON.parse(goalRes.body).goals.length).toBe(0);
    });
  });
});
