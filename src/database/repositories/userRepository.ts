import { getDatabase } from '../db';
import { dbEvents } from '../events';

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
      initialSavings: data.initialSavings ?? current.initialSavings,
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
};
