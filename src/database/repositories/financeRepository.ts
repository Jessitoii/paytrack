import { getDatabase } from '../db';
import { userRepository } from './userRepository';
import { dbEvents } from '../events';

function generateId(prefix = 'fin'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export const financeRepository = {
  async listCategories() {
    const db = getDatabase();
    return db.query('SELECT * FROM expense_categories ORDER BY name ASC;');
  },

  async listExpenses(filters?: { categoryId?: string; startDate?: string | Date; endDate?: string | Date }) {
    const db = getDatabase();
    let sql = `
      SELECT e.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
      FROM expenses e
      LEFT JOIN expense_categories c ON c.id = e.categoryId
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.categoryId) {
      sql += ' AND e.categoryId = ?';
      params.push(filters.categoryId);
    }
    if (filters?.startDate) {
      const s = typeof filters.startDate === 'string' ? filters.startDate : filters.startDate.toISOString();
      sql += ' AND e.date >= ?';
      params.push(s);
    }
    if (filters?.endDate) {
      const e = typeof filters.endDate === 'string' ? filters.endDate : filters.endDate.toISOString();
      sql += ' AND e.date <= ?';
      params.push(e);
    }

    sql += ' ORDER BY e.date DESC, e.createdAt DESC;';
    return db.query(sql, params);
  },

  async createExpense(input: {
    categoryId: string;
    amount: number;
    date: Date | string;
    description: string;
    merchant?: string;
    isRecurring?: boolean;
  }) {
    const db = getDatabase();
    const id = generateId('exp');
    const dStr = typeof input.date === 'string' ? input.date : input.date.toISOString();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO expenses (id, categoryId, amount, date, description, merchant, isRecurring, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [id, input.categoryId, input.amount, dStr, input.description, input.merchant ?? null, input.isRecurring ? 1 : 0, now, now]
    );

    const created = await db.queryFirst('SELECT * FROM expenses WHERE id = ?;', [id]);
    dbEvents.emit('finance_changed');
    return created;
  },

  async deleteExpense(id: string) {
    const db = getDatabase();
    await db.execute('DELETE FROM expenses WHERE id = ?;', [id]);
    dbEvents.emit('finance_changed');
    return { success: true };
  },

  async listSavingsGoals() {
    const db = getDatabase();
    const goals = await db.query('SELECT * FROM savings_goals ORDER BY targetAmount ASC;');
    return goals.map((g) => ({
      ...g,
      progressPercentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
    }));
  },

  async createSavingsGoal(input: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    targetDate?: Date | string;
    color?: string;
    icon?: string;
  }) {
    const db = getDatabase();
    const id = generateId('goal');
    const now = new Date().toISOString();
    const targetDateStr = input.targetDate ? (typeof input.targetDate === 'string' ? input.targetDate : input.targetDate.toISOString()) : null;

    await db.execute(
      `INSERT INTO savings_goals (id, name, targetAmount, currentAmount, targetDate, color, icon, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [id, input.name, input.targetAmount, input.currentAmount ?? 0, targetDateStr, input.color ?? '#10B981', input.icon ?? 'target', now, now]
    );

    const created = await db.queryFirst('SELECT * FROM savings_goals WHERE id = ?;', [id]);
    dbEvents.emit('finance_changed');
    return {
      ...created,
      progressPercentage: created.targetAmount > 0 ? Math.min(100, Math.round((created.currentAmount / created.targetAmount) * 100)) : 0,
    };
  },

  async updateSavingsGoal(id: string, input: { currentAmount?: number; targetAmount?: number; name?: string }) {
    const db = getDatabase();
    const current = await db.queryFirst('SELECT * FROM savings_goals WHERE id = ?;', [id]);
    if (!current) throw new Error('Goal not found');

    const now = new Date().toISOString();
    await db.execute(
      `UPDATE savings_goals SET
         name = ?, targetAmount = ?, currentAmount = ?, updatedAt = ?
       WHERE id = ?;`,
      [input.name ?? current.name, input.targetAmount ?? current.targetAmount, input.currentAmount ?? current.currentAmount, now, id]
    );

    const updated = await db.queryFirst('SELECT * FROM savings_goals WHERE id = ?;', [id]);
    dbEvents.emit('finance_changed');
    return {
      ...updated,
      progressPercentage: updated.targetAmount > 0 ? Math.min(100, Math.round((updated.currentAmount / updated.targetAmount) * 100)) : 0,
    };
  },

  /**
   * Get Monthly Financial Overview.
   */
  async getMonthlyOverview(targetYear?: number, targetMonth?: number) {
    const db = getDatabase();
    const now = new Date();
    const year = targetYear ?? now.getFullYear();
    const month = targetMonth ?? (now.getMonth() + 1);

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const startStr = monthStart.toISOString();
    const endStr = monthEnd.toISOString();

    // 1. Calculate Monthly Income from confirmed payslips or estimated payroll calculations
    const payslips = await db.query(
      'SELECT SUM(bankPayment) as totalBank, SUM(totalNet) as totalNet, SUM(totalGross) as totalGross FROM payslips WHERE periodStart >= ? AND periodStart <= ?;',
      [startStr, endStr]
    );
    const payslipIncome = payslips[0]?.totalBank ?? 0;

    const calculations = await db.query(
      `SELECT SUM(estimatedBankPayment) as totalBank, SUM(estimatedNet) as totalNet, SUM(totalGross) as totalGross
       FROM payroll_calculations pc
       JOIN payroll_weeks pw ON pw.id = pc.payrollWeekId
       WHERE pw.startDate >= ? AND pw.startDate <= ?;`,
      [startStr, endStr]
    );
    const estimatedIncome = calculations[0]?.totalBank ?? 0;

    const actualIncome = payslipIncome > 0 ? payslipIncome : estimatedIncome;

    // 2. Calculate Monthly Expenses
    const expenses = await db.query(
      'SELECT SUM(amount) as totalExpenses FROM expenses WHERE date >= ? AND date <= ?;',
      [startStr, endStr]
    );
    const totalExpenses = expenses[0]?.totalExpenses ?? 0;

    const monthlySavings = actualIncome - totalExpenses;
    const savingsRatePercentage = actualIncome > 0 ? Math.max(0, Math.min(100, Math.round((monthlySavings / actualIncome) * 100))) : 0;

    return {
      period: { year, month },
      income: {
        actual: Number(actualIncome.toFixed(2)),
        payslipTotal: Number((payslips[0]?.totalBank ?? 0).toFixed(2)),
        estimatedTotal: Number((calculations[0]?.totalBank ?? 0).toFixed(2)),
      },
      expenses: {
        total: Number(totalExpenses.toFixed(2)),
      },
      savings: {
        monthlySavings: Number(monthlySavings.toFixed(2)),
        savingsRatePercentage,
      },
    };
  },

  /**
   * 3, 6, 12 Months Wealth Projection Forecast.
   */
  async getForecast(horizonMonths = 6) {
    const overview = await this.getMonthlyOverview();
    const profile = await userRepository.getProfile();
    let currentSavings = profile?.initialSavings ?? 1500;

    const avgNetMonthly = overview.savings.monthlySavings > 0 ? overview.savings.monthlySavings : 800;

    const projections = [];
    for (let i = 1; i <= horizonMonths; i++) {
      currentSavings += avgNetMonthly;
      projections.push({
        monthIndex: i,
        projectedSavings: Number(currentSavings.toFixed(2)),
      });
    }

    return {
      horizonMonths,
      avgMonthlyNetSavings: Number(avgNetMonthly.toFixed(2)),
      projections,
    };
  },
};
