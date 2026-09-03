import { getDatabase } from './db';
import { SCHEMA_VERSION } from './schema';

export interface PayTrackBackup {
  version: number;
  schemaVersion?: number;
  appVersion?: string;
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
  payrollCalibrations?: any[];
}

/**
 * Exports the complete SQLite database to a structured JSON backup.
 */
export async function exportDatabaseToJson(): Promise<PayTrackBackup> {
  const db = getDatabase();

  return {
    version: 4,
    schemaVersion: SCHEMA_VERSION,
    appVersion: '1.0.0',
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
    payrollCalibrations: await db.query('SELECT * FROM payroll_calibrations;'),
  };
}

/**
 * Restores the complete SQLite database from JSON backup inside a single atomic transaction.
 */
export async function importDatabaseFromJson(backup: PayTrackBackup): Promise<{ success: boolean }> {
  if (!backup || (backup.version !== 1 && backup.version !== 2 && backup.version !== 3 && backup.version !== 4)) {
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
    await tx.execute('DELETE FROM payroll_calibrations;');
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
        `INSERT INTO user_profile (id, name, email, timezone, currency, initialSavings, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [u.id, u.name, u.email, u.timezone ?? 'Europe/Amsterdam', u.currency ?? 'EUR', u.initialSavings ?? 0.0, u.createdAt, u.updatedAt]
      );
    }
    for (const s of backup.appSettings || []) {
      await tx.execute('INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, ?);', [s.key, s.value, s.updatedAt]);
    }

    // 3. Employments & Configs
    for (const e of backup.employments || []) {
      await tx.execute(
        `INSERT INTO employments (id, employerName, agencyName, role, location, country, startDate, endDate, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [e.id, e.employerName, e.agencyName ?? null, e.role ?? 'Order Picker', e.location ?? 'Bleiswijk', e.country ?? 'NL', e.startDate, e.endDate ?? null, e.isActive ?? 1, e.createdAt, e.updatedAt]
      );
    }
    for (const c of backup.payrollConfigurations || []) {
      await tx.execute(
        `INSERT INTO payroll_configurations (
           id, employmentId, name, effectiveFromDate, effectiveUntilDate,
           effectiveFromWeek, effectiveUntilWeek, baseHourlyRate, advHourlyRate,
           advPercentage, holidayAllowancePercentage, holidayEntitlementPercentage,
           pawwRatePercentage, azvRatePercentage, stippRatePercentage, wgaRatePercentage,
           healthInsuranceWeekly, additionalInsuranceWeekly, taxEstimationMode,
           estimatedTaxRatePercentage, isDefault, createdAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          c.id, c.employmentId, c.name, c.effectiveFromDate, c.effectiveUntilDate ?? null,
          c.effectiveFromWeek, c.effectiveUntilWeek ?? null, c.baseHourlyRate, c.advHourlyRate ?? null,
          c.advPercentage ?? null, c.holidayAllowancePercentage ?? 8.0, c.holidayEntitlementPercentage ?? 10.49777,
          c.pawwRatePercentage ?? 0.1, c.azvRatePercentage ?? 0.7, c.stippRatePercentage ?? 7.5, c.wgaRatePercentage ?? 0.405,
          c.healthInsuranceWeekly ?? 38.01, c.additionalInsuranceWeekly ?? 2.76, c.taxEstimationMode ?? 'CONFIGURABLE_RATE',
          c.estimatedTaxRatePercentage ?? 18.0, c.isDefault ?? 0, c.createdAt, c.updatedAt,
        ]
      );
    }

    // 4. Shifts & Work
    for (const s of backup.shifts || []) {
      await tx.execute(
        `INSERT INTO shifts (id, employmentId, date, shiftType, plannedStart, plannedEnd, startAdjustmentMinutes, expectedActualStart, isDayOff, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          s.id,
          s.employmentId,
          s.date,
          s.shiftType,
          s.plannedStart ?? null,
          s.plannedEnd ?? null,
          s.startAdjustmentMinutes ?? 0,
          s.expectedActualStart ?? s.plannedStart ?? null,
          s.isDayOff ?? 0,
          s.notes ?? null,
          s.createdAt,
          s.updatedAt,
        ]
      );
    }
    for (const w of backup.workSessions || []) {
      await tx.execute(
        `INSERT INTO work_sessions (id, shiftId, actualStart, rawFinish, roundedFinish, elapsedMinutes, paidMinutes, status, isManualEntry, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [w.id, w.shiftId ?? null, w.actualStart, w.rawFinish ?? null, w.roundedFinish ?? null, w.elapsedMinutes ?? 0, w.paidMinutes ?? 0, w.status ?? 'COMPLETED', w.isManualEntry ?? 0, w.notes ?? null, w.createdAt, w.updatedAt]
      );
    }
    for (const b of backup.workBreaks || []) {
      await tx.execute(
        `INSERT INTO work_breaks (id, workSessionId, type, durationMinutes, isPaid, name, startTime, endTime, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
        `INSERT INTO payroll_weeks (id, employmentId, year, weekNumber, startDate, endDate, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [pw.id, pw.employmentId, pw.year, pw.weekNumber, pw.startDate, pw.endDate, pw.status ?? 'ESTIMATED', pw.createdAt, pw.updatedAt]
      );
    }
    for (const pc of backup.payrollCalculations || []) {
      await tx.execute(
        `INSERT INTO payroll_calculations (
           id, payrollWeekId, configSnapshotJson, paidMinutes, paidHours, baseHourlyRate,
           baseGross, advAllowance, holidayAllowance, holidayEntitlementAccrual,
           holidayDaysExchange, etExchangeDeduction, totalGross, pawwDeduction,
           azvDeduction, stippDeduction, wgaDeduction, totalPayrollDeductions,
           loonSv, estimatedTax, taxAccuracy, netBeforeAdjustments,
           etExchangeReimbursement, healthInsurance, additionalInsurance,
           estimatedNet, estimatedBankPayment, createdAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          pc.id, pc.payrollWeekId, pc.configSnapshotJson, pc.paidMinutes, pc.paidHours, pc.baseHourlyRate,
          pc.baseGross, pc.advAllowance, pc.holidayAllowance, pc.holidayEntitlementAccrual,
          pc.holidayDaysExchange, pc.etExchangeDeduction, pc.totalGross, pc.pawwDeduction,
          pc.azvDeduction, pc.stippDeduction, pc.wgaDeduction, pc.totalPayrollDeductions,
          pc.loonSv, pc.estimatedTax, pc.taxAccuracy, pc.netBeforeAdjustments,
          pc.etExchangeReimbursement, pc.healthInsurance, pc.additionalInsurance,
          pc.estimatedNet, pc.estimatedBankPayment, pc.createdAt, pc.updatedAt,
        ]
      );
    }

    // 6. Payslips & Components (Audited & Restored)
    for (const ps of backup.payslips || []) {
      await tx.execute(
        `INSERT INTO payslips (
           id, employmentId, fileName, localFileUri, periodStart, periodEnd,
           totalGross, totalNet, bankPayment, parsingStatus, extractedDataJson,
           createdAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          ps.id,
          ps.employmentId,
          ps.fileName,
          ps.localFileUri ?? null,
          ps.periodStart,
          ps.periodEnd,
          ps.totalGross,
          ps.totalNet,
          ps.bankPayment,
          ps.parsingStatus ?? 'CONFIRMED',
          ps.extractedDataJson,
          ps.createdAt,
          ps.updatedAt,
        ]
      );
    }
    for (const cmp of backup.payslipComponents || []) {
      await tx.execute(
        `INSERT INTO payslip_components (
           id, payslipId, code, name, category, amount, percentage, hourlyRate, hours, createdAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          cmp.id,
          cmp.payslipId,
          cmp.code,
          cmp.name,
          cmp.category,
          cmp.amount,
          cmp.percentage ?? null,
          cmp.hourlyRate ?? null,
          cmp.hours ?? null,
          cmp.createdAt,
        ]
      );
    }

    // 7. Finance & Categories
    for (const cat of backup.expenseCategories || []) {
      await tx.execute(
        `INSERT INTO expense_categories (id, name, icon, color, isDefault, isActive, sortOrder, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          cat.id,
          cat.name,
          cat.icon,
          cat.color,
          cat.isDefault ?? 0,
          cat.isActive ?? 1,
          cat.sortOrder ?? 0,
          cat.createdAt,
        ]
      );
    }
    for (const exp of backup.expenses || []) {
      await tx.execute(
        `INSERT INTO expenses (id, categoryId, amount, date, description, merchant, isRecurring, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [exp.id, exp.categoryId, exp.amount, exp.date, exp.description, exp.merchant ?? null, exp.isRecurring ?? 0, exp.createdAt, exp.updatedAt]
      );
    }
    for (const rex of backup.recurringExpenses || []) {
      await tx.execute(
        `INSERT INTO recurring_expenses (id, categoryId, name, amount, frequency, dayOfMonth, dayOfWeek, startDate, endDate, isActive, note, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          rex.id,
          rex.categoryId,
          rex.name,
          rex.amount,
          rex.frequency ?? 'MONTHLY',
          rex.dayOfMonth ?? 1,
          rex.dayOfWeek ?? (rex.frequency === 'WEEKLY' ? 1 : null),
          rex.startDate,
          rex.endDate ?? null,
          rex.isActive ?? 1,
          rex.note ?? null,
          rex.createdAt,
          rex.updatedAt,
        ]
      );
    }
    for (const g of backup.savingsGoals || []) {
      await tx.execute(
        `INSERT INTO savings_goals (id, name, targetAmount, currentAmount, priorityOrder, status, monthlyTarget, notes, targetDate, color, icon, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          g.id,
          g.name,
          g.targetAmount,
          g.currentAmount ?? 0,
          g.priorityOrder ?? 0,
          g.status ?? 'ACTIVE',
          g.monthlyTarget ?? null,
          g.notes ?? null,
          g.targetDate ?? null,
          g.color ?? '#10B981',
          g.icon ?? 'target',
          g.createdAt,
          g.updatedAt,
        ]
      );
    }

    // 8. Payroll Calibrations
    for (const cal of backup.payrollCalibrations || []) {
      await tx.execute(
        `INSERT INTO payroll_calibrations (id, employmentId, parameterName, oldValue, suggestedValue, sampleCount, reason, status, appliedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          cal.id,
          cal.employmentId,
          cal.parameterName,
          cal.oldValue,
          cal.suggestedValue,
          cal.sampleCount,
          cal.reason,
          cal.status ?? 'PENDING',
          cal.appliedAt ?? null,
          cal.createdAt,
          cal.updatedAt,
        ]
      );
    }

    return { success: true };
  });
}
