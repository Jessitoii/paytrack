import { getDatabase } from '../db';
import { dbEvents } from '../events';
import { initializeDatabase } from '../init';

export const userRepository = {
  async getProfile() {
    const db = getDatabase();
    return db.queryFirst('SELECT * FROM user_profile LIMIT 1;');
  },

  async updateProfile(data: { name?: string; email?: string; timezone?: string; currency?: string; initialSavings?: number }) {
    const db = getDatabase();
    const current = await this.getProfile();
    if (!current) throw new Error('Profile not found');

    const updated = {
      name: data.name ?? current.name,
      email: data.email ?? current.email,
      timezone: data.timezone ?? current.timezone,
      currency: data.currency ?? current.currency,
      initialSavings: data.initialSavings !== undefined ? data.initialSavings : current.initialSavings,
      updatedAt: new Date().toISOString(),
    };

    await db.execute(
      `UPDATE user_profile SET name = ?, email = ?, timezone = ?, currency = ?, initialSavings = ?, updatedAt = ? WHERE id = ?;`,
      [updated.name, updated.email, updated.timezone, updated.currency, updated.initialSavings, updated.updatedAt, current.id]
    );

    dbEvents.emit('settings_changed');
    return this.getProfile();
  },

  async getActiveEmployment() {
    const db = getDatabase();
    return db.queryFirst('SELECT * FROM employments WHERE isActive = 1 LIMIT 1;');
  },

  async updateEmployment(id: string, data: { employerName?: string; agencyName?: string; role?: string; location?: string }) {
    const db = getDatabase();
    const current = await db.queryFirst('SELECT * FROM employments WHERE id = ?;', [id]);
    if (!current) throw new Error('Employment not found');

    const now = new Date().toISOString();
    await db.execute(
      `UPDATE employments SET
         employerName = ?, agencyName = ?, role = ?, location = ?, updatedAt = ?
       WHERE id = ?;`,
      [
        data.employerName ?? current.employerName,
        data.agencyName ?? current.agencyName,
        data.role ?? current.role,
        data.location ?? current.location,
        now,
        id,
      ]
    );

    dbEvents.emit('settings_changed');
    return db.queryFirst('SELECT * FROM employments WHERE id = ?;', [id]);
  },

  async listPayrollConfigurations() {
    const db = getDatabase();
    return db.query('SELECT * FROM payroll_configurations ORDER BY effectiveFromWeek ASC;');
  },

  async getEffectivePayrollConfig(targetDate: Date = new Date()) {
    const db = getDatabase();
    const dStr = targetDate.toISOString().substring(0, 10);
    const config = await db.queryFirst(
      `SELECT * FROM payroll_configurations
       WHERE effectiveFromDate <= ? AND (effectiveUntilDate IS NULL OR effectiveUntilDate >= ?)
       ORDER BY effectiveFromDate DESC LIMIT 1;`,
      [dStr, dStr]
    );
    if (config) return config;
    return db.queryFirst('SELECT * FROM payroll_configurations WHERE isDefault = 1 LIMIT 1;');
  },

  async updatePayrollConfiguration(
    id: string,
    data: {
      baseHourlyRate?: number;
      advHourlyRate?: number;
      holidayAllowancePercentage?: number;
      healthInsuranceWeekly?: number;
      additionalInsuranceWeekly?: number;
      estimatedTaxRatePercentage?: number;
    }
  ) {
    const db = getDatabase();
    const current = await db.queryFirst('SELECT * FROM payroll_configurations WHERE id = ?;', [id]);
    if (!current) throw new Error('Payroll configuration not found');

    const now = new Date().toISOString();
    await db.execute(
      `UPDATE payroll_configurations SET
         baseHourlyRate = ?, advHourlyRate = ?, holidayAllowancePercentage = ?,
         healthInsuranceWeekly = ?, additionalInsuranceWeekly = ?, estimatedTaxRatePercentage = ?,
         updatedAt = ?
       WHERE id = ?;`,
      [
        data.baseHourlyRate ?? current.baseHourlyRate,
        data.advHourlyRate ?? current.advHourlyRate,
        data.holidayAllowancePercentage ?? current.holidayAllowancePercentage,
        data.healthInsuranceWeekly ?? current.healthInsuranceWeekly,
        data.additionalInsuranceWeekly ?? current.additionalInsuranceWeekly,
        data.estimatedTaxRatePercentage ?? current.estimatedTaxRatePercentage,
        now,
        id,
      ]
    );
    dbEvents.emit('settings_changed');
    return db.queryFirst('SELECT * FROM payroll_configurations WHERE id = ?;', [id]);
  },

  async getSetting(key: string, defaultValue = ''): Promise<string> {
    const db = getDatabase();
    const row = await db.queryFirst<{ value: string }>('SELECT value FROM app_settings WHERE key = ?;', [key]);
    return row?.value ?? defaultValue;
  },

  async setSetting(key: string, value: string): Promise<void> {
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt;`,
      [key, value, now]
    );
    dbEvents.emit('settings_changed');
  },

  async resetAllData() {
    const db = getDatabase();
    await db.transaction(async (tx) => {
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
    });

    await initializeDatabase();

    dbEvents.emit('work_changed');
    dbEvents.emit('shifts_changed');
    dbEvents.emit('finance_changed');
    dbEvents.emit('payslips_changed');
    dbEvents.emit('settings_changed');

    return { success: true };
  },
};
