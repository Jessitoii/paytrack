import { prisma } from '../../db/prisma.js';
import { z } from 'zod';
import { Decimal, roundCurrency, toDecimal } from '../../../../shared/money/decimal.js';

export const createExpenseSchema = z.object({
  categoryId: z.string(),
  amount: z.number().positive(),
  date: z.coerce.date(),
  description: z.string().min(1),
  merchant: z.string().optional(),
  recurringExpenseId: z.string().optional(),
  notes: z.string().optional(),
});

export const updateExpenseSchema = z.object({
  categoryId: z.string().optional(),
  amount: z.number().positive().optional(),
  date: z.coerce.date().optional(),
  description: z.string().min(1).optional(),
  merchant: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const createRecurringExpenseSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  amount: z.number().positive(),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'YEARLY']),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  isActive: z.boolean().default(true),
});

export const createSavingsGoalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).default(0),
  targetDate: z.coerce.date().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateSavingsGoalSchema = z.object({
  name: z.string().min(1).optional(),
  targetAmount: z.number().positive().optional(),
  currentAmount: z.number().min(0).optional(),
  targetDate: z.coerce.date().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
});

export class FinanceService {
  /**
   * 1. Expenses Management
   */
  static async createExpense(userId: string, input: z.infer<typeof createExpenseSchema>) {
    const expense = await prisma.expense.create({
      data: {
        userId,
        categoryId: input.categoryId,
        amount: input.amount,
        date: input.date,
        description: input.description,
        merchant: input.merchant,
        recurringExpenseId: input.recurringExpenseId,
        isRecurringInstance: !!input.recurringExpenseId,
        notes: input.notes,
      },
      include: { category: true },
    });
    return expense;
  }

  static async listExpenses(
    userId: string,
    filters?: { startDate?: Date; endDate?: Date; categoryId?: string }
  ) {
    const where: any = { userId };
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = filters.startDate;
      if (filters.endDate) where.date.lte = filters.endDate;
    }
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    return prisma.expense.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'desc' },
    });
  }

  static async updateExpense(userId: string, expenseId: string, input: z.infer<typeof updateExpenseSchema>) {
    const existing = await prisma.expense.findFirst({ where: { id: expenseId, userId } });
    if (!existing) throw new Error('Expense not found or unauthorized');

    return prisma.expense.update({
      where: { id: expenseId },
      data: {
        categoryId: input.categoryId ?? existing.categoryId,
        amount: input.amount ?? existing.amount,
        date: input.date ?? existing.date,
        description: input.description ?? existing.description,
        merchant: input.merchant !== undefined ? input.merchant : existing.merchant,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      },
      include: { category: true },
    });
  }

  static async deleteExpense(userId: string, expenseId: string) {
    const existing = await prisma.expense.findFirst({ where: { id: expenseId, userId } });
    if (!existing) throw new Error('Expense not found or unauthorized');
    await prisma.expense.delete({ where: { id: expenseId } });
    return { success: true };
  }

  /**
   * 2. Recurring Expenses
   */
  static async createRecurringExpense(userId: string, input: z.infer<typeof createRecurringExpenseSchema>) {
    return prisma.recurringExpense.create({
      data: {
        userId,
        categoryId: input.categoryId,
        name: input.name,
        amount: input.amount,
        frequency: input.frequency,
        dayOfMonth: input.dayOfMonth,
        dayOfWeek: input.dayOfWeek,
        startDate: input.startDate,
        endDate: input.endDate,
        isActive: input.isActive,
      },
      include: { category: true },
    });
  }

  static async listRecurringExpenses(userId: string) {
    return prisma.recurringExpense.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async deleteRecurringExpense(userId: string, id: string) {
    const existing = await prisma.recurringExpense.findFirst({ where: { id, userId } });
    if (!existing) throw new Error('Recurring expense not found or unauthorized');
    await prisma.recurringExpense.delete({ where: { id } });
    return { success: true };
  }

  /**
   * 3. Savings Goals
   */
  static async createSavingsGoal(userId: string, input: z.infer<typeof createSavingsGoalSchema>) {
    return prisma.savingsGoal.create({
      data: {
        userId,
        name: input.name,
        targetAmount: input.targetAmount,
        currentAmount: input.currentAmount,
        targetDate: input.targetDate,
        color: input.color,
        icon: input.icon,
      },
    });
  }

  static async listSavingsGoals(userId: string) {
    const goals = await prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return goals.map((g) => {
      const target = toDecimal(g.targetAmount.toString());
      const current = toDecimal(g.currentAmount.toString());
      const progressPercentage = target.gt(0)
        ? roundCurrency(current.dividedBy(target).times(100)).toNumber()
        : 0;

      return {
        ...g,
        progressPercentage: Math.min(100, progressPercentage),
      };
    });
  }

  static async updateSavingsGoal(userId: string, goalId: string, input: z.infer<typeof updateSavingsGoalSchema>) {
    const existing = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId } });
    if (!existing) throw new Error('Savings goal not found or unauthorized');

    return prisma.savingsGoal.update({
      where: { id: goalId },
      data: {
        name: input.name ?? existing.name,
        targetAmount: input.targetAmount ?? existing.targetAmount,
        currentAmount: input.currentAmount ?? existing.currentAmount,
        targetDate: input.targetDate !== undefined ? input.targetDate : existing.targetDate,
        color: input.color ?? existing.color,
        icon: input.icon ?? existing.icon,
        isActive: input.isActive ?? existing.isActive,
      },
    });
  }

  static async deleteSavingsGoal(userId: string, goalId: string) {
    const existing = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId } });
    if (!existing) throw new Error('Savings goal not found or unauthorized');
    await prisma.savingsGoal.delete({ where: { id: goalId } });
    return { success: true };
  }

  /**
   * 4. Monthly Financial Overview (Deterministic Income - Expenses = Savings)
   */
  static async getMonthlyOverview(userId: string, year: number, month: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    // 1. Confirmed Payslips in this month (Actual Income)
    const payslips = await prisma.payslip.findMany({
      where: {
        userId,
        parsingStatus: 'CONFIRMED',
        periodStart: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const actualIncome = payslips.reduce(
      (sum, p) => sum.plus(toDecimal(p.bankPayment.toString())),
      new Decimal(0)
    );

    // 2. Open/Estimated Payroll Weeks in this month (Estimated Income)
    const estimatedWeeks = await prisma.payrollWeek.findMany({
      where: {
        userId,
        startDate: { gte: startOfMonth, lte: endOfMonth },
        status: 'ESTIMATED',
      },
      include: { calculation: true },
    });

    const estimatedRemainingIncome = estimatedWeeks.reduce((sum, w) => {
      if (w.calculation) {
        return sum.plus(toDecimal(w.calculation.estimatedBankPayment.toString()));
      }
      return sum;
    }, new Decimal(0));

    const totalProjectedIncome = actualIncome.plus(estimatedRemainingIncome);

    // 3. Expenses in this month
    const expenses = await prisma.expense.findMany({
      where: {
        userId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      include: { category: true },
    });

    const totalExpenses = expenses.reduce(
      (sum, e) => sum.plus(toDecimal(e.amount.toString())),
      new Decimal(0)
    );

    // 4. Expenses by Category
    const categoryMap = new Map<string, { name: string; icon?: string | null; color?: string | null; total: Decimal }>();
    for (const exp of expenses) {
      const catId = exp.categoryId;
      const existing = categoryMap.get(catId);
      const amount = toDecimal(exp.amount.toString());
      if (existing) {
        existing.total = existing.total.plus(amount);
      } else {
        categoryMap.set(catId, {
          name: exp.category.name,
          icon: exp.category.icon,
          color: exp.category.color,
          total: amount,
        });
      }
    }

    const expensesByCategory = Array.from(categoryMap.values()).map((c) => ({
      name: c.name,
      icon: c.icon,
      color: c.color,
      total: roundCurrency(c.total).toNumber(),
    }));

    // 5. Savings & Savings Rate
    const monthlySavings = actualIncome.minus(totalExpenses);
    const savingsRate = actualIncome.gt(0)
      ? roundCurrency(monthlySavings.dividedBy(actualIncome).times(100)).toNumber()
      : 0;

    // 6. User Current Savings Baseline
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const initialSavings = toDecimal(user?.initialSavings.toString() ?? 0);

    return {
      year,
      month,
      income: {
        actual: roundCurrency(actualIncome).toNumber(),
        estimatedRemaining: roundCurrency(estimatedRemainingIncome).toNumber(),
        totalProjected: roundCurrency(totalProjectedIncome).toNumber(),
      },
      expenses: {
        total: roundCurrency(totalExpenses).toNumber(),
        byCategory: expensesByCategory,
        itemCount: expenses.length,
      },
      savings: {
        monthlySavings: roundCurrency(monthlySavings).toNumber(),
        savingsRatePercentage: savingsRate,
      },
      balance: {
        initialSavings: roundCurrency(initialSavings).toNumber(),
        estimatedCurrentSavings: roundCurrency(initialSavings.plus(monthlySavings)).toNumber(),
      },
    };
  }

  /**
   * 5. Deterministic Financial Forecasting (3, 6, 12 Months Projection)
   */
  static async getFinancialForecast(userId: string, horizonMonths = 6) {
    const now = new Date();
    const currentMonthOverview = await this.getMonthlyOverview(
      userId,
      now.getFullYear(),
      now.getMonth() + 1
    );

    // Recurring expenses monthly total
    const recurring = await prisma.recurringExpense.findMany({
      where: { userId, isActive: true },
    });

    const monthlyRecurringExpenseTotal = recurring.reduce((sum, r) => {
      const amt = toDecimal(r.amount.toString());
      if (r.frequency === 'WEEKLY') return sum.plus(amt.times(4.333));
      if (r.frequency === 'YEARLY') return sum.plus(amt.dividedBy(12));
      return sum.plus(amt);
    }, new Decimal(0));

    // Baseline projected monthly savings (using current month or baseline €1000)
    const baseMonthlyIncome = currentMonthOverview.income.totalProjected > 0
      ? toDecimal(currentMonthOverview.income.totalProjected)
      : new Decimal(2600.0);

    const baseMonthlyExpenses = currentMonthOverview.expenses.total > 0
      ? toDecimal(currentMonthOverview.expenses.total)
      : monthlyRecurringExpenseTotal.gt(0) ? monthlyRecurringExpenseTotal : new Decimal(1500.0);

    const projectedMonthlySavings = roundCurrency(baseMonthlyIncome.minus(baseMonthlyExpenses));
    const currentSavings = toDecimal(currentMonthOverview.balance.estimatedCurrentSavings);

    const projections: Array<{ monthIndex: number; projectedSavings: number }> = [];
    for (let m = 1; m <= horizonMonths; m++) {
      const projected = roundCurrency(currentSavings.plus(projectedMonthlySavings.times(m)));
      projections.push({
        monthIndex: m,
        projectedSavings: projected.toNumber(),
      });
    }

    // Savings Goals estimated completion months
    const activeGoals = await prisma.savingsGoal.findMany({
      where: { userId, isActive: true },
    });

    const goalsWithForecast = activeGoals.map((g) => {
      const target = toDecimal(g.targetAmount.toString());
      const current = toDecimal(g.currentAmount.toString());
      const remaining = target.minus(current);

      let estimatedMonthsToReach: number | null = null;
      if (projectedMonthlySavings.gt(0) && remaining.gt(0)) {
        estimatedMonthsToReach = Math.ceil(remaining.dividedBy(projectedMonthlySavings).toNumber());
      } else if (remaining.lte(0)) {
        estimatedMonthsToReach = 0;
      }

      return {
        id: g.id,
        name: g.name,
        targetAmount: target.toNumber(),
        currentAmount: current.toNumber(),
        estimatedMonthsToReach,
      };
    });

    return {
      horizonMonths,
      projectedMonthlyIncome: roundCurrency(baseMonthlyIncome).toNumber(),
      projectedMonthlyExpenses: roundCurrency(baseMonthlyExpenses).toNumber(),
      projectedMonthlySavings: projectedMonthlySavings.toNumber(),
      currentSavings: currentSavings.toNumber(),
      projections,
      goalsForecast: goalsWithForecast,
      disclaimer: 'Projections are deterministic estimates based on current rates and recurring expenses.',
    };
  }
}
