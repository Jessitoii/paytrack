import { getDatabase } from './db';
import { CREATE_TABLES_SQL, SCHEMA_VERSION } from './schema';

/**
 * Initializes the SQLite database, runs migrations, and seeds default profiles if empty.
 */
export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();

  // 1. Create tables
  await db.execRaw(CREATE_TABLES_SQL);

  // 2. Check and update schema version
  const versionRow = await db.queryFirst<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < SCHEMA_VERSION) {
    await db.execRaw(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }

  // 3. Seed Default User Profile (if not existing)
  const existingUser = await db.queryFirst('SELECT id FROM user_profile LIMIT 1;');
  if (!existingUser) {
    const now = new Date().toISOString();
    const userId = 'user_personal_default';
    await db.execute(
      `INSERT INTO user_profile (id, name, email, timezone, currency, initialSavings, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [userId, 'Alper Ozer', 'alper@paytrack.app', 'Europe/Amsterdam', 'EUR', 1500.0, now, now]
    );

    // Seed Employer & Employment
    const employmentId = 'employment_carriere_ah';
    await db.execute(
      `INSERT INTO employments (id, employerName, agencyName, country, startDate, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [employmentId, 'Albert Heijn B.V. Bleiswijk', 'Carrière Personeelsdiensten B.V.', 'NL', '2026-01-01', 1, now, now]
    );

    // Seed Versioned Payroll Configurations (2026 W1-W12 & W13+)
    await db.execute(
      `INSERT INTO payroll_configurations (
         id, employmentId, name, effectiveFromDate, effectiveUntilDate, effectiveFromWeek, effectiveUntilWeek,
         baseHourlyRate, advHourlyRate, advPercentage, holidayAllowancePercentage, holidayEntitlementPercentage,
         pawwRatePercentage, azvRatePercentage, stippRatePercentage, wgaRatePercentage,
         healthInsuranceWeekly, additionalInsuranceWeekly, taxEstimationMode, estimatedTaxRatePercentage, isDefault,
         createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        'config_carriere_2026_w1_w12',
        employmentId,
        'Carrière - Albert Heijn (2026 W1-W12)',
        '2026-01-01',
        '2026-03-22',
        1,
        12,
        14.99,
        1.35,
        9.005,
        8.00,
        10.49777,
        0.1000,
        0.7000,
        7.5000,
        0.4050,
        38.01,
        2.76,
        'CONFIGURABLE_RATE',
        18.0,
        1,
        now,
        now,
      ]
    );

    await db.execute(
      `INSERT INTO payroll_configurations (
         id, employmentId, name, effectiveFromDate, effectiveUntilDate, effectiveFromWeek, effectiveUntilWeek,
         baseHourlyRate, advHourlyRate, advPercentage, holidayAllowancePercentage, holidayEntitlementPercentage,
         pawwRatePercentage, azvRatePercentage, stippRatePercentage, wgaRatePercentage,
         healthInsuranceWeekly, additionalInsuranceWeekly, taxEstimationMode, estimatedTaxRatePercentage, isDefault,
         createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        'config_carriere_2026_w13_plus',
        employmentId,
        'Carrière - Albert Heijn (2026 W13+)',
        '2026-03-23',
        null,
        13,
        52,
        15.13,
        1.36,
        9.005,
        8.00,
        10.49777,
        0.1000,
        0.7000,
        7.5000,
        0.4050,
        38.01,
        2.76,
        'CONFIGURABLE_RATE',
        18.0,
        0,
        now,
        now,
      ]
    );

    // Seed Savings Goal
    await db.execute(
      `INSERT INTO savings_goals (id, name, targetAmount, currentAmount, targetDate, color, icon, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      ['goal_emergency', 'Emergency Fund', 5000.0, 1500.0, '2027-01-01', '#10B981', 'shield', now, now]
    );
  }

  // 4. Seed Default Expense Categories (if empty)
  const existingCat = await db.queryFirst('SELECT id FROM expense_categories LIMIT 1;');
  if (!existingCat) {
    const now = new Date().toISOString();
    const categories = [
      { id: 'cat_housing', name: 'Housing', icon: 'home', color: '#3B82F6' },
      { id: 'cat_food', name: 'Food', icon: 'utensils', color: '#10B981' },
      { id: 'cat_transp', name: 'Transportation', icon: 'bus', color: '#F59E0B' },
      { id: 'cat_health', name: 'Health', icon: 'heart', color: '#EF4444' },
      { id: 'cat_shopping', name: 'Shopping', icon: 'shopping-bag', color: '#8B5CF6' },
      { id: 'cat_bills', name: 'Bills', icon: 'file-text', color: '#6B7280' },
      { id: 'cat_ent', name: 'Entertainment', icon: 'film', color: '#EC4899' },
      { id: 'cat_sub', name: 'Subscriptions', icon: 'credit-card', color: '#06B6D4' },
      { id: 'cat_travel', name: 'Travel', icon: 'plane', color: '#14B8A6' },
      { id: 'cat_other', name: 'Other', icon: 'tag', color: '#9CA3AF' },
    ];

    for (const c of categories) {
      await db.execute(
        `INSERT INTO expense_categories (id, name, icon, color, isDefault, createdAt)
         VALUES (?, ?, ?, ?, 1, ?);`,
        [c.id, c.name, c.icon, c.color, now]
      );
    }
  }
}
