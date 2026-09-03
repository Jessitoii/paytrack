import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase } from '../local-db/test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import { financeRepository, calculateBillOccurrencesInMonth } from '../../src/database/repositories/financeRepository';
import { payslipRepository } from '../../src/database/repositories/payslipRepository';
import { exportDatabaseToJson, importDatabaseFromJson } from '../../src/database/backup';
import { getDatabase } from '../../src/database/db';

describe('Rent Management & Finance Expense Separation', () => {
  beforeEach(async () => {
    setupTestDatabase();
    await initializeDatabase();
  });

  // 1. €160 weekly Monday rent configuration oluşturma
  it('1. should create and ensure €160 weekly Monday rent configuration', async () => {
    const rentBill = await financeRepository.ensureDefaultRentConfig();
    expect(rentBill).toBeDefined();
    expect(rentBill.name).toBe('Rent / Kira');
    expect(rentBill.amount).toBe(160.0);
    expect(rentBill.frequency).toBe('WEEKLY');
    expect(rentBill.dayOfWeek).toBe(1); // Monday
    expect(rentBill.isActive).toBe(true);

    const categories = await financeRepository.listCategories();
    const housingCat = categories.find((c: any) => c.name === 'Rent / Housing' || c.id === 'cat_housing');
    expect(housingCat).toBeDefined();
    expect(rentBill.categoryId).toBe(housingCat.id);
  });

  // 2. 4 Pazartesili ay -> €640
  it('2. should calculate €640 for a month with 4 Mondays (September 2026)', async () => {
    await financeRepository.ensureDefaultRentConfig();

    // September 2026: Mondays on 7, 14, 21, 28 = 4 Mondays
    const occurrences = calculateBillOccurrencesInMonth(
      { frequency: 'WEEKLY', dayOfWeek: 1, startDate: '2026-01-01' },
      2026,
      9
    );
    expect(occurrences).toBe(4);

    const overview = await financeRepository.getMonthlyOverview(2026, 9);
    expect(overview.expenses.rent).toBe(640.0);
    expect(overview.expenses.fixedBills).toBe(640.0);

    const bills = await financeRepository.listFixedBills(2026, 9);
    const rent = bills.find((b) => b.isRent);
    expect(rent).toBeDefined();
    expect(rent?.occurrences).toBe(4);
    expect(rent?.monthAmount).toBe(640.0);
  });

  // 3. 5 Pazartesili ay -> €800
  it('3. should calculate €800 for a month with 5 Mondays (August 2026)', async () => {
    await financeRepository.ensureDefaultRentConfig();

    // August 2026: Mondays on 3, 10, 17, 24, 31 = 5 Mondays
    const occurrences = calculateBillOccurrencesInMonth(
      { frequency: 'WEEKLY', dayOfWeek: 1, startDate: '2026-01-01' },
      2026,
      8
    );
    expect(occurrences).toBe(5);

    const overview = await financeRepository.getMonthlyOverview(2026, 8);
    expect(overview.expenses.rent).toBe(800.0);
    expect(overview.expenses.fixedBills).toBe(800.0);

    const bills = await financeRepository.listFixedBills(2026, 8);
    const rent = bills.find((b) => b.isRent);
    expect(rent).toBeDefined();
    expect(rent?.occurrences).toBe(5);
    expect(rent?.monthAmount).toBe(800.0);
  });

  // 4. Ay sınırında Pazartesi doğru aya atanıyor
  it('4. should attribute boundary Mondays strictly to their calendar month', async () => {
    // August 31, 2026 is a Monday (belongs strictly to August)
    // September 1, 2026 is Tuesday (first Monday in September is September 7)
    const augMondays = calculateBillOccurrencesInMonth(
      { frequency: 'WEEKLY', dayOfWeek: 1, startDate: '2026-01-01' },
      2026,
      8
    );
    const septMondays = calculateBillOccurrencesInMonth(
      { frequency: 'WEEKLY', dayOfWeek: 1, startDate: '2026-01-01' },
      2026,
      9
    );

    expect(augMondays).toBe(5); // Aug 3, 10, 17, 24, 31
    expect(septMondays).toBe(4); // Sept 7, 14, 21, 28
    // Together they have 9 Mondays in the 2-month span, none overlapping
    expect(augMondays + septMondays).toBe(9);
  });

  // 5. Rent recurring expense normal variable Expenses listesinde görünmüyor
  it('5. should NOT include recurring rent in variable expenses list', async () => {
    await financeRepository.ensureDefaultRentConfig();

    const expensesList = await financeRepository.listExpenses();
    const hasRentInExpenses = expensesList.some(
      (e: any) => e.description.toLowerCase().includes('rent') || e.description.toLowerCase().includes('kira')
    );
    expect(hasRentInExpenses).toBe(false);
  });

  // 6. Manual €25 supermarket expense normal Expenses listesinde görünüyor
  it('6. should display manual €25 supermarket expense in normal variable Expenses list', async () => {
    await financeRepository.ensureDefaultRentConfig();

    const categories = await financeRepository.listCategories();
    const foodCat = categories.find((c: any) => c.name === 'Food') || categories[0];

    const manualExp = await financeRepository.createExpense({
      categoryId: foodCat.id,
      amount: 25.0,
      date: '2026-09-05',
      description: 'Supermarket Groceries',
      merchant: 'Albert Heijn',
    });

    expect(manualExp).toBeDefined();
    expect(manualExp.amount).toBe(25.0);

    const expenses = await financeRepository.listExpenses({ startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(expenses.some((e: any) => e.id === manualExp.id && e.description === 'Supermarket Groceries')).toBe(true);

    // Rent recurring expense is still not in this list
    expect(expenses.some((e: any) => e.description.includes('Rent'))).toBe(false);
  });

  // 7. Fixed + Variable + Income hesaplaması doğru
  it('7. should accurately compute Remaining = Income - Fixed - Variable', async () => {
    await financeRepository.ensureDefaultRentConfig();

    // 1. Payslip income in September 2026: €2000.00
    await payslipRepository.savePayslip({
      fileName: 'payslip_sept_2026.pdf',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-07',
      totalGross: 2400.0,
      totalNet: 2100.0,
      bankPayment: 2000.0,
      extractedData: {},
    });

    // 2. Variable expenses: €25 supermarket + €75 utility = €100
    const cat = (await financeRepository.listCategories())[0];
    await financeRepository.createExpense({
      categoryId: cat.id,
      amount: 25.0,
      date: '2026-09-05',
      description: 'Supermarket AH',
    });
    await financeRepository.createExpense({
      categoryId: cat.id,
      amount: 75.0,
      date: '2026-09-12',
      description: 'Dining out',
    });

    // Overview for September 2026 (4 Mondays -> €640 rent)
    const overview = await financeRepository.getMonthlyOverview(2026, 9);
    expect(overview.income.actual).toBe(2000.0);
    expect(overview.expenses.fixedBills).toBe(640.0);
    expect(overview.expenses.rent).toBe(640.0);
    expect(overview.expenses.variable).toBe(100.0);
    expect(overview.expenses.total).toBe(740.0); // 640 + 100
    expect(overview.savings.monthlySavings).toBe(1260.0); // 2000 - 740
  });

  // 8. Finance month navigation değişince recurring rent projection doğru değişiyor
  it('8. should dynamically adjust recurring rent projection on month navigation', async () => {
    await financeRepository.ensureDefaultRentConfig();

    // August 2026 -> 5 Mondays -> €800
    const augOverview = await financeRepository.getMonthlyOverview(2026, 8);
    expect(augOverview.expenses.rent).toBe(800.0);

    // September 2026 -> 4 Mondays -> €640
    const septOverview = await financeRepository.getMonthlyOverview(2026, 9);
    expect(septOverview.expenses.rent).toBe(640.0);

    // October 2026 -> 4 Mondays (Oct 5, 12, 19, 26) -> €640
    const octOverview = await financeRepository.getMonthlyOverview(2026, 10);
    expect(octOverview.expenses.rent).toBe(640.0);

    // November 2026 -> 5 Mondays (Nov 2, 9, 16, 23, 30) -> €800
    const novOverview = await financeRepository.getMonthlyOverview(2026, 11);
    expect(novOverview.expenses.rent).toBe(800.0);
  });

  // 9. Backup -> restore sonrasında rent configuration korunuyor
  it('9. should retain full rent configuration through JSON export and restore', async () => {
    const db = getDatabase();
    await financeRepository.ensureDefaultRentConfig();

    // Export database
    const backup = await exportDatabaseToJson();
    const rentExported = backup.recurringExpenses.find(
      (r: any) => r.name === 'Rent / Kira' || r.name.includes('Rent')
    );
    expect(rentExported).toBeDefined();
    expect(rentExported.amount).toBe(160.0);
    expect(rentExported.frequency).toBe('WEEKLY');
    expect(rentExported.dayOfWeek).toBe(1);
    expect(rentExported.isActive).toBe(1);

    // Wipe recurring_expenses table
    await db.execute('DELETE FROM recurring_expenses;');
    expect((await financeRepository.listFixedBills()).length).toBe(0);

    // Restore from backup
    const restoreRes = await importDatabaseFromJson(backup);
    expect(restoreRes.success).toBe(true);

    // Verify restored rent bill
    const restoredBills = await financeRepository.listFixedBills();
    const restoredRent = restoredBills.find((b) => b.name === 'Rent / Kira');
    expect(restoredRent).toBeDefined();
    expect(restoredRent?.amount).toBe(160.0);
    expect(restoredRent?.frequency).toBe('WEEKLY');
    expect(restoredRent?.dayOfWeek).toBe(1);
    expect(restoredRent?.isActive).toBe(true);
  });
});
