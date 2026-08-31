import { getDatabase } from './db';

export interface PayTrackBackup {
  version: number;
  exportedAt: string;
  userProfile: any[];
  appSettings: any[];
  employments: any[];
  payrollConfigurations: any[];
  shifts: any[];
  workSessions: any[];
  workBreaks: any[];
  payrollWeeks: any[];
  payrollCalculations: any[];
  payslips: any[];
  payslipComponents: any[];
  expenseCategories: any[];
  expenses: any[];
  recurringExpenses: any[];
  savingsGoals: any[];
}

/**
 * Exports the complete SQLite database to a structured JSON backup.
 */
export async function exportDatabaseToJson(): Promise<PayTrackBackup> {
  const db = getDatabase();

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    userProfile: await db.query('SELECT * FROM user_profile;'),
    appSettings: await db.query('SELECT * FROM app_settings;'),
    employments: await db.query('SELECT * FROM employments;'),
    payrollConfigurations: await db.query('SELECT * FROM payroll_configurations;'),
    shifts: await db.query('SELECT * FROM shifts;'),
    workSessions: await db.query('SELECT * FROM work_sessions;'),
    workBreaks: await db.query('SELECT * FROM work_breaks;'),
    payrollWeeks: await db.query('SELECT * FROM payroll_weeks;'),
    payrollCalculations: await db.query('SELECT * FROM payroll_calculations;'),
    payslips: await db.query('SELECT * FROM payslips;'),
    payslipComponents: await db.query('SELECT * FROM payslip_components;'),
    expenseCategories: await db.query('SELECT * FROM expense_categories;'),
    expenses: await db.query('SELECT * FROM expenses;'),
    recurringExpenses: await db.query('SELECT * FROM recurring_expenses;'),
    savingsGoals: await db.query('SELECT * FROM savings_goals;'),
  };
}

/**
 * Restores the complete SQLite database from JSON backup inside a single atomic transaction.
 */
export async function importDatabaseFromJson(backup: PayTrackBackup): Promise<{ success: boolean }> {
  if (!backup || (backup.version !== 1 && backup.version !== 2)) {
    throw new Error('Invalid or unsupported backup format');
  }

  const db = getDatabase();

  return db.transaction(async (tx) => {
    // 1. Clean existing records in reverse foreign-key order
    await tx.execute('DELETE FROM work_breaks;');
    await tx.execute('DELETE FROM work_sessions;');
    await tx.execute('DELETE FROM shifts;');
    await tx.execute('DELETE FROM payroll_calculations;');
    await tx.execute('DELETE FROM payroll_weeks;');
    await tx.execute('DELETE FROM payslip_components;');
    await tx.execute('DELETE FROM payslips;');
    await tx.execute('DELETE FROM expenses;');
    await tx.execute('DELETE FROM recurring_expenses;');
    await tx.execute('DELETE FROM savings_goals;');
    await tx.execute('DELETE FROM payroll_configurations;');
    await tx.execute('DELETE FROM employments;');
    await tx.execute('DELETE FROM expense_categories;');
    await tx.execute('DELETE FROM user_profile;');
    await tx.execute('DELETE FROM app_settings;');

    // 2. Restore User Profile & Settings
    for (const u of backup.userProfile || []) {
      await tx.execute(
        'INSERT INTO user_profile VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
        [u.id, u.name, u.email, u.timezone, u.currency, u.initialSavings, u.createdAt, u.updatedAt]
      );
    }
    for (const s of backup.appSettings || []) {
      await tx.execute('INSERT INTO app_settings VALUES (?, ?, ?);', [s.key, s.value, s.updatedAt]);
    }

    // 3. Employments & Configs
    for (const e of backup.employments || []) {
      await tx.execute(
        'INSERT INTO employments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [e.id, e.employerName, e.agencyName, e.country, e.startDate, e.endDate, e.isActive, e.createdAt, e.updatedAt]
      );
    }
    for (const c of backup.payrollConfigurations || []) {
      await tx.execute(
        `INSERT INTO payroll_configurations VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        );`,
        [
          c.id, c.employmentId, c.name, c.effectiveFromDate, c.effectiveUntilDate,
          c.effectiveFromWeek, c.effectiveUntilWeek, c.baseHourlyRate, c.advHourlyRate,
          c.advPercentage, c.holidayAllowancePercentage, c.holidayEntitlementPercentage,
          c.pawwRatePercentage, c.azvRatePercentage, c.stippRatePercentage, c.wgaRatePercentage,
          c.healthInsuranceWeekly, c.additionalInsuranceWeekly, c.taxEstimationMode,
          c.estimatedTaxRatePercentage, c.isDefault, c.createdAt, c.updatedAt
        ]
      );
    }

    // 4. Shifts & Work
    for (const s of backup.shifts || []) {
      await tx.execute(
        'INSERT INTO shifts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [
          s.id,
          s.employmentId,
          s.date,
          s.shiftType,
          s.plannedStart,
          s.plannedEnd,
          s.startAdjustmentMinutes ?? 0,
          s.expectedActualStart ?? s.plannedStart,
          s.isDayOff ?? 0,
          s.notes ?? null,
          s.createdAt,
          s.updatedAt,
        ]
      );
    }
    for (const w of backup.workSessions || []) {
      await tx.execute(
        'INSERT INTO work_sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [w.id, w.shiftId, w.actualStart, w.rawFinish, w.roundedFinish, w.elapsedMinutes, w.paidMinutes, w.status, w.isManualEntry, w.notes, w.createdAt, w.updatedAt]
      );
    }
    for (const b of backup.workBreaks || []) {
      await tx.execute(
        'INSERT INTO work_breaks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [
          b.id,
          b.workSessionId,
          b.type,
          b.durationMinutes,
          b.isPaid,
          b.name ?? null,
          b.startTime ?? null,
          b.endTime ?? null,
          b.createdAt,
        ]
      );
    }

    // 5. Payroll
    for (const pw of backup.payrollWeeks || []) {
      await tx.execute(
        'INSERT INTO payroll_weeks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [pw.id, pw.employmentId, pw.year, pw.weekNumber, pw.startDate, pw.endDate, pw.status, pw.createdAt, pw.updatedAt]
      );
    }
    for (const pc of backup.payrollCalculations || []) {
      await tx.execute(
        `INSERT INTO payroll_calculations VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        );`,
        [
          pc.id, pc.payrollWeekId, pc.configSnapshotJson, pc.paidMinutes, pc.paidHours, pc.baseHourlyRate,
          pc.baseGross, pc.advAllowance, pc.holidayAllowance, pc.holidayEntitlementAccrual,
          pc.holidayDaysExchange, pc.etExchangeDeduction, pc.totalGross, pc.pawwDeduction,
          pc.azvDeduction, pc.stippDeduction, pc.wgaDeduction, pc.totalPayrollDeductions,
          pc.loonSv, pc.estimatedTax, pc.taxAccuracy, pc.netBeforeAdjustments,
          pc.etExchangeReimbursement, pc.healthInsurance, pc.additionalInsurance,
          pc.estimatedNet, pc.estimatedBankPayment, pc.createdAt, pc.updatedAt
        ]
      );
    }

    // 6. Finance
    for (const cat of backup.expenseCategories || []) {
      await tx.execute(
        'INSERT INTO expense_categories VALUES (?, ?, ?, ?, ?, ?);',
        [cat.id, cat.name, cat.icon, cat.color, cat.isDefault, cat.createdAt]
      );
    }
    for (const exp of backup.expenses || []) {
      await tx.execute(
        'INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [exp.id, exp.categoryId, exp.amount, exp.date, exp.description, exp.merchant, exp.isRecurring, exp.createdAt, exp.updatedAt]
      );
    }
    for (const g of backup.savingsGoals || []) {
      await tx.execute(
        'INSERT INTO savings_goals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
        [g.id, g.name, g.targetAmount, g.currentAmount, g.targetDate, g.color, g.icon, g.createdAt, g.updatedAt]
      );
    }

    return { success: true };
  });
}
