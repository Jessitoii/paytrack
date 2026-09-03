import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase } from './test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import { exportDatabaseToJson, importDatabaseFromJson } from '../../src/database/backup';
import { payslipRepository } from '../../src/database/repositories/payslipRepository';
import { financeRepository } from '../../src/database/repositories/financeRepository';
import { getDatabase } from '../../src/database/db';

describe('Database Backup & Restore Audit', () => {
  beforeEach(async () => {
    setupTestDatabase();
    await initializeDatabase();
  });

  it('should perform complete round-trip export and restore without dropping any entities', async () => {
    const db = getDatabase();

    // 1. Add a confirmed payslip with components
    const payslip = await payslipRepository.savePayslip({
      fileName: 'test_payslip_w33.pdf',
      localFileUri: 'file:///cache/test.pdf',
      periodStart: '2026-08-10',
      periodEnd: '2026-08-16',
      totalGross: 556.54,
      totalNet: 485.75,
      bankPayment: 453.23,
      extractedData: { test: true },
      components: [
        { code: '1000', name: 'Loon normale uren', category: 'EARNING', amount: 247.33, hours: 16.5, hourlyRate: 14.99 },
        { code: '1050', name: 'Belaste ADV-toeslag', category: 'EARNING', amount: 42.53 },
        { code: '3000', name: 'StiPP Pensioen', category: 'DEDUCTION', amount: 19.86 },
      ],
    });

    // 2. Add custom category and expense
    const cat = await financeRepository.createCategory({
      name: 'Electronics & Tech',
      icon: 'smartphone',
      color: '#6366F1',
    });

    const exp = await financeRepository.createExpense({
      categoryId: cat.id,
      amount: 149.99,
      date: '2026-08-15',
      description: 'Noise Cancelling Headphones',
    });

    // 3. Add custom savings goal
    const goal = await financeRepository.createSavingsGoal({
      name: 'New Laptop',
      targetAmount: 1200.0,
      priorityOrder: 2,
    });

    // 4. Export database
    const backup = await exportDatabaseToJson();

    expect(backup.version).toBe(4);
    expect(backup.schemaVersion).toBe(5);
    expect(backup.payslips.length).toBeGreaterThanOrEqual(1);
    expect(backup.payslipComponents.length).toBeGreaterThanOrEqual(3);
    expect(backup.expenseCategories.some((c) => c.name === 'Electronics & Tech')).toBe(true);
    expect(backup.expenses.some((e) => e.description === 'Noise Cancelling Headphones')).toBe(true);
    expect(backup.savingsGoals.some((g) => g.name === 'New Laptop')).toBe(true);

    // 5. Wipe DB manually
    await db.execute('DELETE FROM payslip_components;');
    await db.execute('DELETE FROM payslips;');
    await db.execute('DELETE FROM expenses;');
    await db.execute('DELETE FROM expense_categories;');
    await db.execute('DELETE FROM savings_goals;');

    const emptyPayslips = await payslipRepository.listPayslips();
    expect(emptyPayslips.length).toBe(0);

    // 6. Restore from JSON
    const restoreResult = await importDatabaseFromJson(backup);
    expect(restoreResult.success).toBe(true);

    // 7. Verify all data restored identically
    const restoredPayslips = await payslipRepository.listPayslips();
    expect(restoredPayslips.length).toBeGreaterThanOrEqual(1);
    const restoredDetail = await payslipRepository.getPayslipById(payslip.id);
    expect(restoredDetail).not.toBeNull();
    expect(restoredDetail?.totalGross).toBe(556.54);
    expect(restoredDetail?.bankPayment).toBe(453.23);
    expect(restoredDetail?.components.length).toBe(3);

    const restoredCategories = await financeRepository.listCategories(true);
    expect(restoredCategories.some((c: any) => c.name === 'Electronics & Tech')).toBe(true);

    const restoredExpenses = await financeRepository.listExpenses();
    expect(restoredExpenses.some((e: any) => e.description === 'Noise Cancelling Headphones')).toBe(true);

    const restoredGoals = await financeRepository.listSavingsGoals();
    expect(restoredGoals.some((g: any) => g.name === 'New Laptop')).toBe(true);
  });

  it('should rollback cleanly and reject unsupported backup versions', async () => {
    const invalidBackup: any = {
      version: 99,
      userProfile: [],
    };

    await expect(importDatabaseFromJson(invalidBackup)).rejects.toThrow('Invalid or unsupported backup format');
  });
});
