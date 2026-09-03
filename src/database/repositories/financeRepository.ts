import { getDatabase } from '../db';
import { userRepository } from './userRepository';
import { getISOWeekBounds } from './workRepository';
import { dbEvents } from '../events';

function generateId(prefix = 'fin'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export interface FixedBill {
  id: string;
  categoryId: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
  name: string;
  amount: number;
  frequency: string;
  dayOfMonth: number;
  dayOfWeek?: number;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  note?: string | null;
  occurrences?: number;
  monthAmount?: number;
  isRent?: boolean;
  createdAt: string;
  updatedAt: string;
}

export function isRentBill(bill: { name?: string; categoryId?: string; categoryName?: string }): boolean {
  const name = (bill.name || '').toLowerCase();
  const catName = (bill.categoryName || '').toLowerCase();
  return (
    name.includes('rent') ||
    name.includes('kira') ||
    catName.includes('housing') ||
    catName.includes('rent') ||
    bill.categoryId === 'cat_housing'
  );
}

export function calculateBillOccurrencesInMonth(
  bill: {
    frequency?: string;
    dayOfMonth?: number;
    dayOfWeek?: number;
    startDate?: string;
    endDate?: string | null;
  },
  year: number,
  month: number // 1-12
): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const freq = (bill.frequency || 'MONTHLY').toUpperCase();

  if (freq === 'WEEKLY') {
    // 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
    const targetDayOfWeek = bill.dayOfWeek ?? 1;
    // In JS getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const jsTargetDay = targetDayOfWeek === 7 ? 0 : targetDayOfWeek;

    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      if (date.getDay() === jsTargetDay) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (bill.startDate && bill.startDate > dateStr) continue;
        if (bill.endDate && bill.endDate < dateStr) continue;
        count++;
      }
    }
    return count;
  }

  // Monthly
  const targetDay = Math.min(bill.dayOfMonth ?? 1, daysInMonth);
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
  if (bill.startDate && bill.startDate > dateStr) return 0;
  if (bill.endDate && bill.endDate < dateStr) return 0;
  return 1;
}

export const financeRepository = {
  // 1. Categories
  async listCategories(includeInactive = false) {
    const db = getDatabase();
    if (includeInactive) {
      return db.query('SELECT * FROM expense_categories ORDER BY sortOrder ASC, name ASC;');
    }
    return db.query('SELECT * FROM expense_categories WHERE isActive = 1 ORDER BY sortOrder ASC, name ASC;');
  },

  async createCategory(input: { name: string; icon?: string; color?: string; isActive?: boolean }) {
    const db = getDatabase();
    const id = generateId('cat');
    const now = new Date().toISOString();
    const maxRow = await db.queryFirst<{ maxOrder: number }>('SELECT MAX(sortOrder) as maxOrder FROM expense_categories;');
    const nextOrder = (maxRow?.maxOrder ?? 0) + 1;

    await db.execute(
      `INSERT INTO expense_categories (id, name, icon, color, isDefault, isActive, sortOrder, createdAt)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?);`,
      [id, input.name.trim(), input.icon ?? 'tag', input.color ?? '#3B82F6', input.isActive !== false ? 1 : 0, nextOrder, now]
    );
    dbEvents.emit('finance_changed');
    return db.queryFirst('SELECT * FROM expense_categories WHERE id = ?;', [id]);
  },

  async updateCategory(id: string, input: { name?: string; icon?: string; color?: string; isActive?: boolean; sortOrder?: number }) {
    const db = getDatabase();
    const current = await db.queryFirst('SELECT * FROM expense_categories WHERE id = ?;', [id]);
    if (!current) throw new Error('Category not found');

    await db.execute(
      `UPDATE expense_categories SET
         name = ?, icon = ?, color = ?, isActive = ?, sortOrder = ?
       WHERE id = ?;`,
      [
        input.name !== undefined ? input.name.trim() : current.name,
        input.icon ?? current.icon,
        input.color ?? current.color,
        input.isActive !== undefined ? (input.isActive ? 1 : 0) : current.isActive,
        input.sortOrder !== undefined ? input.sortOrder : current.sortOrder,
        id,
      ]
    );
    dbEvents.emit('finance_changed');
    return db.queryFirst('SELECT * FROM expense_categories WHERE id = ?;', [id]);
  },

  async deleteCategory(id: string) {
    const db = getDatabase();
    // Check if expenses exist - preserve historical financial records
    const used = await db.queryFirst<{ cnt: number }>('SELECT COUNT(*) as cnt FROM expenses WHERE categoryId = ?;', [id]);
    const recurringUsed = await db.queryFirst<{ cnt: number }>('SELECT COUNT(*) as cnt FROM recurring_expenses WHERE categoryId = ?;', [id]);

    if ((used && used.cnt > 0) || (recurringUsed && recurringUsed.cnt > 0)) {
      // Soft-delete to keep historical data intact
      await db.execute('UPDATE expense_categories SET isActive = 0 WHERE id = ?;', [id]);
      dbEvents.emit('finance_changed');
      return { success: true, softDeleted: true, message: 'Category set to inactive because historical expenses are linked to it.' };
    }

    await db.execute('DELETE FROM expense_categories WHERE id = ?;', [id]);
    dbEvents.emit('finance_changed');
    return { success: true, softDeleted: false };
  },

  async reorderCategories(orderedIds: string[]) {
    const db = getDatabase();
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.execute('UPDATE expense_categories SET sortOrder = ? WHERE id = ?;', [i + 1, orderedIds[i]]);
      }
    });
    dbEvents.emit('finance_changed');
    return { success: true };
  },

  // 2. Fixed Bills (Recurring Expenses)
  async listFixedBills(targetYear?: number, targetMonth?: number): Promise<FixedBill[]> {
    const db = getDatabase();
    const now = new Date();
    const year = targetYear ?? now.getFullYear();
    const month = targetMonth ?? (now.getMonth() + 1);

    const rows = await db.query(`
      SELECT r.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
      FROM recurring_expenses r
      LEFT JOIN expense_categories c ON c.id = r.categoryId
      ORDER BY r.isActive DESC, r.dayOfMonth ASC, r.name ASC;
    `);
    return rows.map((r) => {
      const occurrences = calculateBillOccurrencesInMonth(r, year, month);
      const monthAmount = Number(((r.amount || 0) * occurrences).toFixed(2));
      return {
        ...r,
        isActive: Boolean(r.isActive),
        occurrences,
        monthAmount,
        isRent: isRentBill(r),
      };
    });
  },

  async ensureDefaultRentConfig(): Promise<FixedBill> {
    const db = getDatabase();
    // Ensure 'cat_housing' or 'Rent / Housing' category exists
    let housingCat = await db.queryFirst<{ id: string; name: string }>(
      "SELECT id, name FROM expense_categories WHERE id = 'cat_housing' OR name LIKE '%Housing%' OR name LIKE '%Rent%' LIMIT 1;"
    );
    if (!housingCat) {
      const created: any = await this.createCategory({ name: 'Rent / Housing', icon: 'home', color: '#3B82F6' });
      housingCat = { id: created.id, name: created.name };
    } else if (housingCat.name === 'Housing') {
      await db.execute("UPDATE expense_categories SET name = 'Rent / Housing' WHERE id = ?;", [housingCat.id]);
    }

    // Check if rent recurring bill exists
    const existingRent = await db.queryFirst<any>(
      "SELECT * FROM recurring_expenses WHERE name LIKE '%Rent%' OR name LIKE '%Kira%' LIMIT 1;"
    );
    if (!existingRent) {
      const created = await this.createFixedBill({
        categoryId: housingCat.id,
        name: 'Rent / Kira',
        amount: 160.0,
        frequency: 'WEEKLY',
        dayOfWeek: 1, // Monday
        startDate: '2026-01-01',
        isActive: true,
        note: 'Weekly Monday rent payment (€160/week)',
      });
      return created as FixedBill;
    }

    return {
      ...existingRent,
      isActive: Boolean(existingRent.isActive),
      isRent: true,
    } as FixedBill;
  },

  async createFixedBill(input: {
    categoryId: string;
    name: string;
    amount: number;
    frequency?: 'MONTHLY' | 'WEEKLY' | string;
    dayOfMonth?: number;
    dayOfWeek?: number;
    startDate?: Date | string;
    endDate?: Date | string | null;
    isActive?: boolean;
    note?: string | null;
  }) {
    const db = getDatabase();
    const id = generateId('fix');
    const now = new Date().toISOString();
    const startStr = input.startDate
      ? (typeof input.startDate === 'string' ? input.startDate : input.startDate.toISOString())
      : now.substring(0, 10);
    const endStr = input.endDate
      ? (typeof input.endDate === 'string' ? input.endDate : input.endDate.toISOString())
      : null;
    const frequency = (input.frequency || 'MONTHLY').toUpperCase();
    const dayOfWeek = input.dayOfWeek ?? (frequency === 'WEEKLY' ? 1 : 1);

    await db.execute(
      `INSERT INTO recurring_expenses (
         id, categoryId, name, amount, frequency, dayOfMonth, dayOfWeek, startDate, endDate, isActive, note, createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        input.categoryId,
        input.name.trim(),
        input.amount,
        frequency,
        input.dayOfMonth ?? 1,
        dayOfWeek,
        startStr,
        endStr,
        input.isActive !== false ? 1 : 0,
        input.note ?? null,
        now,
        now,
      ]
    );

    dbEvents.emit('finance_changed');
    const created = await db.queryFirst('SELECT * FROM recurring_expenses WHERE id = ?;', [id]);
    return { ...created, isActive: Boolean(created?.isActive), isRent: isRentBill(created) };
  },

  async updateFixedBill(
    id: string,
    input: {
      categoryId?: string;
      name?: string;
      amount?: number;
      frequency?: string;
      dayOfMonth?: number;
      dayOfWeek?: number;
      isActive?: boolean;
      note?: string | null;
    }
  ) {
    const db = getDatabase();
    const current = await db.queryFirst('SELECT * FROM recurring_expenses WHERE id = ?;', [id]);
    if (!current) throw new Error('Fixed bill not found');

    const now = new Date().toISOString();
    await db.execute(
      `UPDATE recurring_expenses SET
         categoryId = ?, name = ?, amount = ?, frequency = ?, dayOfMonth = ?, dayOfWeek = ?, isActive = ?, note = ?, updatedAt = ?
       WHERE id = ?;`,
      [
        input.categoryId ?? current.categoryId,
        input.name ?? current.name,
        input.amount ?? current.amount,
        input.frequency ? input.frequency.toUpperCase() : current.frequency,
        input.dayOfMonth ?? current.dayOfMonth,
        input.dayOfWeek ?? current.dayOfWeek ?? 1,
        input.isActive !== undefined ? (input.isActive ? 1 : 0) : current.isActive,
        input.note !== undefined ? input.note : current.note,
        now,
        id,
      ]
    );

    dbEvents.emit('finance_changed');
    const updated = await db.queryFirst('SELECT * FROM recurring_expenses WHERE id = ?;', [id]);
    return { ...updated, isActive: Boolean(updated?.isActive), isRent: isRentBill(updated) };
  },

  async deleteFixedBill(id: string) {
    const db = getDatabase();
    await db.execute('DELETE FROM recurring_expenses WHERE id = ?;', [id]);
    dbEvents.emit('finance_changed');
    return { success: true };
  },

  // 3. Manual Expenses
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

  // 4. Savings Goals & Sequential Allocation
  async computeAvailableSavings(): Promise<{ totalIncome: number; totalExpenses: number; availableSavings: number }> {
    const db = getDatabase();
    const profile = await userRepository.getProfile();
    const initialSavings = profile?.initialSavings ?? 0;

    // Confirmed payslip payouts
    const payslips = await db.query<{ bankPayment: number }>('SELECT bankPayment FROM payslips;');
    const payslipIncome = payslips.reduce((sum, p) => sum + (p.bankPayment || 0), 0);

    // If no payslips, check payroll calculations
    let payrollIncome = 0;
    if (payslips.length === 0) {
      const calcs = await db.query<{ estimatedBankPayment: number }>('SELECT estimatedBankPayment FROM payroll_calculations;');
      payrollIncome = calcs.reduce((sum, c) => sum + (c.estimatedBankPayment || 0), 0);
    }

    const totalIncome = Number((initialSavings + (payslipIncome > 0 ? payslipIncome : payrollIncome)).toFixed(2));

    // Variable expenses
    const expRows = await db.query<{ amount: number }>('SELECT amount FROM expenses;');
    const totalVar = expRows.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Active fixed recurring bills
    const billRows = await db.query<any>('SELECT * FROM recurring_expenses WHERE isActive = 1;');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const totalFixed = billRows.reduce((sum, b) => {
      const occ = calculateBillOccurrencesInMonth(b, currentYear, currentMonth);
      return sum + ((b.amount || 0) * occ);
    }, 0);

    const totalExpenses = Number((totalVar + totalFixed).toFixed(2));
    const availableSavings = Number(Math.max(0, totalIncome - totalExpenses).toFixed(2));

    return { totalIncome, totalExpenses, availableSavings };
  },

  async listSavingsGoals() {
    const db = getDatabase();
    const { availableSavings } = await this.computeAvailableSavings();

    const goals = await db.query<any>(
      `SELECT * FROM savings_goals ORDER BY priorityOrder ASC, createdAt ASC;`
    );

    let remainingSavings = availableSavings;
    let foundActiveTarget = false;
    const now = new Date().toISOString();

    const resultGoals = [];

    for (let i = 0; i < goals.length; i++) {
      const g = goals[i];
      let allocated = 0;
      let status = 'ACTIVE';

      if (remainingSavings >= g.targetAmount) {
        allocated = g.targetAmount;
        remainingSavings = Number((remainingSavings - g.targetAmount).toFixed(2));
        status = 'COMPLETED';
      } else {
        allocated = remainingSavings;
        remainingSavings = 0;
        status = 'ACTIVE';
      }

      const isCurrentTarget = !foundActiveTarget && status === 'ACTIVE';
      if (isCurrentTarget) {
        foundActiveTarget = true;
      }

      // Persist allocated amount and status if changed
      if (Math.abs(g.currentAmount - allocated) > 0.01 || g.status !== status) {
        await db.execute(
          'UPDATE savings_goals SET currentAmount = ?, status = ?, updatedAt = ? WHERE id = ?;',
          [allocated, status, now, g.id]
        );
      }

      const progressPercentage = g.targetAmount > 0 ? Math.min(100, Math.round((allocated / g.targetAmount) * 100)) : 0;
      const remainingAmount = Number(Math.max(0, g.targetAmount - allocated).toFixed(2));

      resultGoals.push({
        ...g,
        currentAmount: allocated,
        status,
        progressPercentage,
        remainingAmount,
        isCurrentTarget,
      });
    }

    return resultGoals;
  },

  async createSavingsGoal(input: {
    name: string;
    targetAmount: number;
    monthlyTarget?: number;
    notes?: string;
    priorityOrder?: number;
    targetDate?: Date | string;
    color?: string;
    icon?: string;
  }) {
    const db = getDatabase();
    const id = generateId('goal');
    const now = new Date().toISOString();
    const targetDateStr = input.targetDate
      ? (typeof input.targetDate === 'string' ? input.targetDate : input.targetDate.toISOString())
      : null;

    let priority = input.priorityOrder;
    if (priority === undefined) {
      const maxRow = await db.queryFirst<{ maxOrder: number }>('SELECT MAX(priorityOrder) as maxOrder FROM savings_goals;');
      priority = (maxRow?.maxOrder ?? 0) + 1;
    }

    await db.execute(
      `INSERT INTO savings_goals (
         id, name, targetAmount, currentAmount, priorityOrder, status, monthlyTarget, notes, targetDate, color, icon, createdAt, updatedAt
       ) VALUES (?, ?, ?, 0.0, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        input.name.trim(),
        input.targetAmount,
        priority,
        input.monthlyTarget ?? null,
        input.notes ?? null,
        targetDateStr,
        input.color ?? '#10B981',
        input.icon ?? 'target',
        now,
        now,
      ]
    );

    dbEvents.emit('finance_changed');
    const all = await this.listSavingsGoals();
    return all.find((g: any) => g.id === id) || all[all.length - 1];
  },

  async updateSavingsGoal(
    id: string,
    input: {
      name?: string;
      targetAmount?: number;
      priorityOrder?: number;
      monthlyTarget?: number;
      notes?: string;
      targetDate?: Date | string | null;
      color?: string;
      icon?: string;
    }
  ) {
    const db = getDatabase();
    const current = await db.queryFirst('SELECT * FROM savings_goals WHERE id = ?;', [id]);
    if (!current) throw new Error('Goal not found');

    const now = new Date().toISOString();
    const targetDateStr = input.targetDate !== undefined
      ? (input.targetDate ? (typeof input.targetDate === 'string' ? input.targetDate : input.targetDate.toISOString()) : null)
      : current.targetDate;

    await db.execute(
      `UPDATE savings_goals SET
         name = ?, targetAmount = ?, priorityOrder = ?, monthlyTarget = ?, notes = ?, targetDate = ?, color = ?, icon = ?, updatedAt = ?
       WHERE id = ?;`,
      [
        input.name !== undefined ? input.name.trim() : current.name,
        input.targetAmount !== undefined ? input.targetAmount : current.targetAmount,
        input.priorityOrder !== undefined ? input.priorityOrder : current.priorityOrder,
        input.monthlyTarget !== undefined ? input.monthlyTarget : current.monthlyTarget,
        input.notes !== undefined ? input.notes : current.notes,
        targetDateStr,
        input.color ?? current.color,
        input.icon ?? current.icon,
        now,
        id,
      ]
    );

    dbEvents.emit('finance_changed');
    const all = await this.listSavingsGoals();
    return all.find((g: any) => g.id === id);
  },

  async reorderSavingsGoals(orderedIds: string[]) {
    const db = getDatabase();
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.execute('UPDATE savings_goals SET priorityOrder = ? WHERE id = ?;', [i + 1, orderedIds[i]]);
      }
    });
    dbEvents.emit('finance_changed');
    return this.listSavingsGoals();
  },

  async deleteSavingsGoal(id: string) {
    const db = getDatabase();
    await db.execute('DELETE FROM savings_goals WHERE id = ?;', [id]);
    dbEvents.emit('finance_changed');
    return { success: true };
  },

  // 5. Complete Monthly Overview with Income, Fixed Bills, Variable Expenses & Weekly Breakdown
  async getMonthlyOverview(targetYear?: number, targetMonth?: number) {
    const db = getDatabase();
    const now = new Date();
    const year = targetYear ?? now.getFullYear();
    const month = targetMonth ?? (now.getMonth() + 1);

    // Month boundary dates in local time
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`;

    // 1. Payslips for this month
    const payslips = await db.query(
      `SELECT * FROM payslips WHERE periodStart >= ? AND periodStart <= ? ORDER BY periodStart DESC;`,
      [monthStart.toISOString(), monthEnd.toISOString()]
    );
    const totalPayslipBank = payslips.reduce((sum, p) => sum + (p.bankPayment || 0), 0);
    const totalPayslipGross = payslips.reduce((sum, p) => sum + (p.totalGross || 0), 0);
    const totalPayslipNet = payslips.reduce((sum, p) => sum + (p.totalNet || 0), 0);

    // 2. Weekly Payroll Calculations for ISO weeks overlapping this month
    const weeklyCalcs = await db.query(
      `SELECT pc.*, pw.weekNumber, pw.year, pw.startDate, pw.endDate
       FROM payroll_calculations pc
       JOIN payroll_weeks pw ON pw.id = pc.payrollWeekId
       WHERE pw.startDate <= ? AND pw.endDate >= ?
       ORDER BY pw.weekNumber ASC;`,
      [monthEnd.toISOString(), monthStart.toISOString()]
    );

    const totalEstBank = weeklyCalcs.reduce((sum, c) => sum + (c.estimatedBankPayment || 0), 0);
    const totalEstGross = weeklyCalcs.reduce((sum, c) => sum + (c.totalGross || 0), 0);
    const totalEstNet = weeklyCalcs.reduce((sum, c) => sum + (c.estimatedNet || 0), 0);
    const totalBaseGross = weeklyCalcs.reduce((sum, c) => sum + (c.baseGross || 0), 0);
    const totalAdv = weeklyCalcs.reduce((sum, c) => sum + (c.advAllowance || 0), 0);
    const totalHolidayAllowance = weeklyCalcs.reduce((sum, c) => sum + (c.holidayAllowance || 0), 0);
    const totalPaidMinutes = weeklyCalcs.reduce((sum, c) => sum + (c.paidMinutes || 0), 0);

    // Weekly income breakdown items
    const weeklyIncomeList = weeklyCalcs.map((c) => ({
      year: c.year,
      weekNumber: c.weekNumber,
      startDate: c.startDate,
      endDate: c.endDate,
      paidMinutes: c.paidMinutes,
      estimatedGross: Number((c.totalGross || 0).toFixed(2)),
      estimatedNet: Number((c.estimatedNet || 0).toFixed(2)),
      estimatedBankPayment: Number((c.estimatedBankPayment || 0).toFixed(2)),
    }));

    // If no weekly calculations exist in DB yet, compute directly from work sessions in this month
    let dynamicWorkMinutes = totalPaidMinutes;
    if (weeklyCalcs.length === 0) {
      const monthSessions = await db.query(
        `SELECT SUM(paidMinutes) as sumPaid FROM work_sessions
         WHERE actualStart >= ? AND actualStart <= ? AND status IN ('COMPLETED', 'EDITED');`,
        [monthStart.toISOString(), monthEnd.toISOString()]
      );
      dynamicWorkMinutes = monthSessions[0]?.sumPaid || 0;
    }

    const fallbackEstGross = (dynamicWorkMinutes / 60) * 16.34;
    const fallbackEstNet = (dynamicWorkMinutes / 60) * 13.50;

    const actualIncome = totalPayslipBank > 0 ? totalPayslipBank : (totalEstBank > 0 ? totalEstBank : fallbackEstNet);
    const totalGross = totalPayslipGross > 0 ? totalPayslipGross : (totalEstGross > 0 ? totalEstGross : fallbackEstGross);
    const totalNet = totalPayslipNet > 0 ? totalPayslipNet : (totalEstNet > 0 ? totalEstNet : fallbackEstNet);

    const paidHours = dynamicWorkMinutes / 60;
    const avgHourlyEarnings = paidHours > 0 ? (actualIncome / paidHours) : 0;

    // 3. Fixed Bills (Recurring monthly expenses)
    const fixedBillsList = await db.query(`
      SELECT r.*, c.name as categoryName, c.icon as categoryIcon, c.color as categoryColor
      FROM recurring_expenses r
      LEFT JOIN expense_categories c ON c.id = r.categoryId
      WHERE r.isActive = 1;
    `);

    let rentTotal = 0;
    let otherFixedTotal = 0;

    const projectedBills = fixedBillsList.map((b) => {
      const occurrences = calculateBillOccurrencesInMonth(b, year, month);
      const monthAmount = Number(((b.amount || 0) * occurrences).toFixed(2));
      const rent = isRentBill(b);
      if (rent) {
        rentTotal += monthAmount;
      } else {
        otherFixedTotal += monthAmount;
      }
      return {
        ...b,
        isActive: Boolean(b.isActive),
        occurrences,
        monthAmount,
        isRent: rent,
      };
    });

    const monthlyFixedBills = Number((rentTotal + otherFixedTotal).toFixed(2));

    // 4. Variable Expenses in this month
    const variableExpensesRows = await db.query(
      `SELECT SUM(amount) as totalVar FROM expenses WHERE date >= ? AND date <= ?;`,
      [startStr, endStr + 'T23:59:59.999Z']
    );
    const variableExpenses = variableExpensesRows[0]?.totalVar || 0;

    // Total expenses = Variable expenses + Fixed monthly bills
    const totalExpenses = variableExpenses + monthlyFixedBills;

    // Net Savings & Rate
    const monthlySavings = actualIncome - totalExpenses;
    const savingsRatePercentage = actualIncome > 0 ? Math.max(-100, Math.min(100, Math.round((monthlySavings / actualIncome) * 100))) : 0;

    return {
      period: {
        year,
        month,
        startDate: startStr,
        endDate: endStr,
      },
      income: {
        actual: Number(actualIncome.toFixed(2)),
        totalGross: Number(totalGross.toFixed(2)),
        totalNet: Number(totalNet.toFixed(2)),
        payslipNet: totalPayslipNet > 0 ? Number(totalPayslipNet.toFixed(2)) : null,
        payslipBank: totalPayslipBank > 0 ? Number(totalPayslipBank.toFixed(2)) : null,
        workIncome: Number(totalBaseGross.toFixed(2)),
        advAllowance: Number(totalAdv.toFixed(2)),
        holidayAllowance: Number(totalHolidayAllowance.toFixed(2)),
        hoursWorkedMinutes: dynamicWorkMinutes,
        avgHourlyEarnings: Number(avgHourlyEarnings.toFixed(2)),
        weeklyBreakdown: weeklyIncomeList,
      },
      expenses: {
        total: Number(totalExpenses.toFixed(2)),
        variable: Number(variableExpenses.toFixed(2)),
        fixedBills: Number(monthlyFixedBills.toFixed(2)),
        rent: Number(rentTotal.toFixed(2)),
        otherFixed: Number(otherFixedTotal.toFixed(2)),
        fixedBillsList: projectedBills,
      },
      savings: {
        monthlySavings: Number(monthlySavings.toFixed(2)),
        savingsRatePercentage,
      },
      projection: {
        monthlyFixedBills: Number(monthlyFixedBills.toFixed(2)),
        rent: Number(rentTotal.toFixed(2)),
        otherFixed: Number(otherFixedTotal.toFixed(2)),
        variableExpenses: Number(variableExpenses.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        expectedSavings: Number(monthlySavings.toFixed(2)),
      },
    };
  },

  // 6. Comprehensive Financial Analytics (YTD, Averages, Goal Projections)
  async getFinancialAnalytics(targetYear?: number, targetMonth?: number) {
    const db = getDatabase();
    const now = new Date();
    const year = targetYear ?? now.getFullYear();
    const month = targetMonth ?? (now.getMonth() + 1);

    const monthOverview = await this.getMonthlyOverview(year, month);
    const goals = await this.listSavingsGoals();
    const activeGoal = goals.find((g: any) => g.isCurrentTarget) || goals.find((g: any) => g.status === 'ACTIVE') || goals[0];

    // YTD boundaries: Jan 1 of year to end of targetMonth
    const ytdStartStr = `${year}-01-01`;
    const ytdEndStr = `${year}-${String(month).padStart(2, '0')}-31T23:59:59.999Z`;

    // 1. YTD Confirmed Payslips
    const ytdPayslips = await db.query<{ bankPayment: number; totalGross: number; totalNet: number }>(
      'SELECT bankPayment, totalGross, totalNet FROM payslips WHERE periodStart >= ? AND periodStart <= ?;',
      [ytdStartStr, ytdEndStr]
    );
    const ytdPayslipIncome = ytdPayslips.reduce((sum, p) => sum + (p.bankPayment || 0), 0);

    // 2. YTD Payroll calculations fallback
    let ytdIncome = ytdPayslipIncome;
    if (ytdIncome === 0) {
      const ytdCalcs = await db.query<{ estimatedBankPayment: number }>(
        `SELECT pc.estimatedBankPayment FROM payroll_calculations pc
         JOIN payroll_weeks pw ON pw.id = pc.payrollWeekId
         WHERE pw.startDate >= ? AND pw.startDate <= ?;`,
        [ytdStartStr, ytdEndStr]
      );
      ytdIncome = ytdCalcs.reduce((sum, c) => sum + (c.estimatedBankPayment || 0), 0);
    }

    // 3. YTD Expenses
    const ytdExpensesRows = await db.query<{ amount: number }>(
      'SELECT amount FROM expenses WHERE date >= ? AND date <= ?;',
      [ytdStartStr, ytdEndStr]
    );
    const ytdVariableExpenses = ytdExpensesRows.reduce((sum, e) => sum + (e.amount || 0), 0);

    // YTD Fixed Bills (computed accurately month by month)
    const fixedBills = await db.query<any>('SELECT * FROM recurring_expenses WHERE isActive = 1;');
    const elapsedMonths = Math.max(1, month);
    let ytdFixedExpenses = 0;
    for (let m = 1; m <= elapsedMonths; m++) {
      for (const b of fixedBills) {
        const occ = calculateBillOccurrencesInMonth(b, year, m);
        ytdFixedExpenses += ((b.amount || 0) * occ);
      }
    }

    const ytdTotalExpenses = Number((ytdVariableExpenses + ytdFixedExpenses).toFixed(2));
    const ytdSavings = Number((ytdIncome - ytdTotalExpenses).toFixed(2));

    // Averages
    const avgMonthlyIncome = Number((ytdIncome / elapsedMonths).toFixed(2));
    const avgMonthlyExpenses = Number((ytdTotalExpenses / elapsedMonths).toFixed(2));
    const avgMonthlySavings = Number((ytdSavings / elapsedMonths).toFixed(2));

    // ETA Calculation for current goal
    let goalEtaMonths: number | null = null;
    let goalEtaDate: string | null = null;
    if (activeGoal && activeGoal.remainingAmount > 0) {
      const rate = monthOverview.savings.monthlySavings > 0 ? monthOverview.savings.monthlySavings : (avgMonthlySavings > 0 ? avgMonthlySavings : 0);
      if (rate > 0) {
        goalEtaMonths = Number((activeGoal.remainingAmount / rate).toFixed(1));
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + Math.ceil(goalEtaMonths));
        goalEtaDate = futureDate.toISOString().substring(0, 7);
      }
    }

    return {
      currentMonth: {
        year,
        month,
        income: monthOverview.income.actual,
        expenses: monthOverview.expenses.total,
        fixedBills: monthOverview.expenses.fixedBills,
        variableExpenses: monthOverview.expenses.variable,
        availableSavings: monthOverview.savings.monthlySavings,
        savingsRate: monthOverview.savings.savingsRatePercentage,
      },
      yearToDate: {
        income: Number(ytdIncome.toFixed(2)),
        expenses: ytdTotalExpenses,
        savings: ytdSavings,
        elapsedMonths,
      },
      averages: {
        monthlyIncome: avgMonthlyIncome,
        monthlyExpenses: avgMonthlyExpenses,
        monthlySavings: avgMonthlySavings,
      },
      currentGoal: activeGoal ? {
        id: activeGoal.id,
        name: activeGoal.name,
        targetAmount: activeGoal.targetAmount,
        currentAmount: activeGoal.currentAmount,
        remainingAmount: activeGoal.remainingAmount,
        progressPercentage: activeGoal.progressPercentage,
        status: activeGoal.status,
        etaMonths: goalEtaMonths,
        etaDate: goalEtaDate,
      } : null,
      monthlyOverview: monthOverview,
    };
  },

  // 6. 6-Month Wealth Forecast
  async getForecast(horizonMonths = 6) {
    const overview = await this.getMonthlyOverview();
    const profile = await userRepository.getProfile();
    let currentSavings = profile?.initialSavings ?? 1500;

    // Use current monthly net savings, or default to reasonable fallback
    const expectedMonthlyNet = overview.savings.monthlySavings !== 0 ? overview.savings.monthlySavings : 800;

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();

    const projections = [];
    for (let i = 1; i <= horizonMonths; i++) {
      currentSavings += expectedMonthlyNet;
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = `${MONTH_NAMES[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

      projections.push({
        monthIndex: i,
        monthLabel,
        projectedSavings: Number(currentSavings.toFixed(2)),
      });
    }

    return {
      horizonMonths,
      currentSavings: profile?.initialSavings ?? 1500,
      expectedMonthlySavings: Number(expectedMonthlyNet.toFixed(2)),
      avgMonthlyNetSavings: Number(expectedMonthlyNet.toFixed(2)),
      projections,
    };
  },
};
