import type { FastifyPluginAsync } from 'fastify';
import {
  FinanceService,
  createExpenseSchema,
  updateExpenseSchema,
  createRecurringExpenseSchema,
  createSavingsGoalSchema,
  updateSavingsGoalSchema,
} from './finance.service.js';
import { authenticate } from '../../middleware/auth.js';

export const financeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);

  // Categories
  fastify.get('/categories', async (request, reply) => {
    try {
      const categories = await FinanceService.listCategories(request.userPayload!.userId);
      return reply.send({ categories });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  // 1. Expenses
  fastify.post('/expenses', async (request, reply) => {
    try {
      const body = createExpenseSchema.parse(request.body);
      const expense = await FinanceService.createExpense(request.userPayload!.userId, body);
      return reply.status(201).send({ expense });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  fastify.get<{
    Querystring: { startDate?: string; endDate?: string; categoryId?: string };
  }>('/expenses', async (request, reply) => {
    try {
      const filters = {
        startDate: request.query.startDate ? new Date(request.query.startDate) : undefined,
        endDate: request.query.endDate ? new Date(request.query.endDate) : undefined,
        categoryId: request.query.categoryId,
      };
      const expenses = await FinanceService.listExpenses(request.userPayload!.userId, filters);
      return reply.send({ expenses });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  fastify.patch<{ Params: { id: string } }>('/expenses/:id', async (request, reply) => {
    try {
      const body = updateExpenseSchema.parse(request.body ?? {});
      const expense = await FinanceService.updateExpense(request.userPayload!.userId, request.params.id, body);
      return reply.send({ expense });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/expenses/:id', async (request, reply) => {
    try {
      const result = await FinanceService.deleteExpense(request.userPayload!.userId, request.params.id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
    }
  });

  // 2. Recurring Expenses
  fastify.post('/recurring-expenses', async (request, reply) => {
    try {
      const body = createRecurringExpenseSchema.parse(request.body);
      const recurring = await FinanceService.createRecurringExpense(request.userPayload!.userId, body);
      return reply.status(201).send({ recurringExpense: recurring });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  fastify.get('/recurring-expenses', async (request, reply) => {
    try {
      const recurringExpenses = await FinanceService.listRecurringExpenses(request.userPayload!.userId);
      return reply.send({ recurringExpenses });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/recurring-expenses/:id', async (request, reply) => {
    try {
      const result = await FinanceService.deleteRecurringExpense(request.userPayload!.userId, request.params.id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
    }
  });

  // 3. Savings Goals
  fastify.post('/savings-goals', async (request, reply) => {
    try {
      const body = createSavingsGoalSchema.parse(request.body);
      const goal = await FinanceService.createSavingsGoal(request.userPayload!.userId, body);
      return reply.status(201).send({ goal });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  fastify.get('/savings-goals', async (request, reply) => {
    try {
      const goals = await FinanceService.listSavingsGoals(request.userPayload!.userId);
      return reply.send({ goals });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  fastify.patch<{ Params: { id: string } }>('/savings-goals/:id', async (request, reply) => {
    try {
      const body = updateSavingsGoalSchema.parse(request.body ?? {});
      const goal = await FinanceService.updateSavingsGoal(request.userPayload!.userId, request.params.id, body);
      return reply.send({ goal });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/savings-goals/:id', async (request, reply) => {
    try {
      const result = await FinanceService.deleteSavingsGoal(request.userPayload!.userId, request.params.id);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
    }
  });

  // 4. Financial Overview (GET /api/finance/overview?year=2026&month=8)
  fastify.get<{
    Querystring: { year?: string; month?: string };
  }>('/overview', async (request, reply) => {
    try {
      const now = new Date();
      const year = request.query.year ? parseInt(request.query.year, 10) : now.getFullYear();
      const month = request.query.month ? parseInt(request.query.month, 10) : now.getMonth() + 1;

      const overview = await FinanceService.getMonthlyOverview(request.userPayload!.userId, year, month);
      return reply.send({ overview });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });

  // 5. Forecast (GET /api/finance/forecast?horizonMonths=6)
  fastify.get<{
    Querystring: { horizonMonths?: string };
  }>('/forecast', async (request, reply) => {
    try {
      const horizon = request.query.horizonMonths ? parseInt(request.query.horizonMonths, 10) : 6;
      const forecast = await FinanceService.getFinancialForecast(request.userPayload!.userId, horizon);
      return reply.send({ forecast });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: err.message });
    }
  });
};
