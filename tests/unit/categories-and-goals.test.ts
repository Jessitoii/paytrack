import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase } from '../local-db/test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import { financeRepository } from '../../src/database/repositories/financeRepository';
import { payslipRepository } from '../../src/database/repositories/payslipRepository';

describe('Expense Categories & Sequential Savings Goals', () => {
  beforeEach(async () => {
    setupTestDatabase();
    await initializeDatabase();
  });

  describe('Expense Categories Management', () => {
    it('should create, list, and reorder categories with sortOrder', async () => {
      const cat1 = await financeRepository.createCategory({ name: 'Alpha', icon: 'tag', color: '#111' });
      const cat2 = await financeRepository.createCategory({ name: 'Beta', icon: 'tag', color: '#222' });

      expect(cat1.sortOrder).toBeDefined();
      expect(cat2.sortOrder).toBeGreaterThan(cat1.sortOrder);

      // Reorder
      await financeRepository.reorderCategories([cat2.id, cat1.id]);
      const reordered = await financeRepository.listCategories(true);
      const betaIdx = reordered.findIndex((c: any) => c.id === cat2.id);
      const alphaIdx = reordered.findIndex((c: any) => c.id === cat1.id);
      expect(betaIdx).toBeLessThan(alphaIdx);
    });

    it('should soft-delete category if historical expenses are linked, preserving past data', async () => {
      const cat = await financeRepository.createCategory({ name: 'Groceries', icon: 'cart', color: '#10B981' });
      await financeRepository.createExpense({
        categoryId: cat.id,
        amount: 54.30,
        date: '2026-08-20',
        description: 'Supermarket shopping',
      });

      // Attempt delete
      const delResult = await financeRepository.deleteCategory(cat.id);
      expect(delResult.success).toBe(true);
      expect(delResult.softDeleted).toBe(true);

      // Should not be in active list
      const activeCats = await financeRepository.listCategories(false);
      expect(activeCats.some((c: any) => c.id === cat.id)).toBe(false);

      // But should remain in full list with isActive = 0
      const allCats = await financeRepository.listCategories(true);
      const found = allCats.find((c: any) => c.id === cat.id);
      expect(found).toBeDefined();
      expect(found.isActive).toBe(0);

      // Expense still exists
      const expenses = await financeRepository.listExpenses();
      expect(expenses.some((e: any) => e.description === 'Supermarket shopping')).toBe(true);
    });
  });

  describe('Sequential Savings Goals Allocation', () => {
    it('should sequentially allocate available savings in priority order', async () => {
      // Clear seeded goal and set initial savings to 0 for test isolation
      const db = setupTestDatabase();
      await initializeDatabase();
      await db.execute('UPDATE user_profile SET initialSavings = 0.0;');
      const existing = await financeRepository.listSavingsGoals();
      for (const g of existing) {
        await financeRepository.deleteSavingsGoal(g.id);
      }

      // Create Goal 1: Emergency Fund €1000 (Priority 1)
      const g1 = await financeRepository.createSavingsGoal({
        name: 'Emergency Fund',
        targetAmount: 1000.0,
        priorityOrder: 1,
      });

      // Create Goal 2: New Phone €800 (Priority 2)
      const g2 = await financeRepository.createSavingsGoal({
        name: 'New Phone',
        targetAmount: 800.0,
        priorityOrder: 2,
      });

      // Create Goal 3: Vacation €1500 (Priority 3)
      const g3 = await financeRepository.createSavingsGoal({
        name: 'Vacation',
        targetAmount: 1500.0,
        priorityOrder: 3,
      });

      // Scenario A: Payslip arrives with €450 payout, expense is €150 -> Available = €300
      await payslipRepository.savePayslip({
        fileName: 'w33.pdf',
        periodStart: '2026-08-10',
        periodEnd: '2026-08-16',
        totalGross: 556.54,
        totalNet: 485.75,
        bankPayment: 450.0,
        extractedData: {},
      });

      const cat = (await financeRepository.listCategories())[0];
      await financeRepository.createExpense({
        categoryId: cat.id,
        amount: 150.0,
        date: '2026-08-12',
        description: 'Rent/Bill',
      });

      // Available savings = 450 - 150 = 300
      let goals = await financeRepository.listSavingsGoals();
      expect(goals[0].currentAmount).toBe(300.0);
      expect(goals[0].status).toBe('ACTIVE');
      expect(goals[0].isCurrentTarget).toBe(true);
      expect(goals[1].currentAmount).toBe(0.0);
      expect(goals[2].currentAmount).toBe(0.0);

      // Scenario B: Second payslip arrives with €900 -> Total income = 1350, expenses = 150 -> Available = 1200
      await payslipRepository.savePayslip({
        fileName: 'w34.pdf',
        periodStart: '2026-08-17',
        periodEnd: '2026-08-23',
        totalGross: 950.0,
        totalNet: 920.0,
        bankPayment: 900.0,
        extractedData: {},
      });

      goals = await financeRepository.listSavingsGoals();
      // Goal 1 should be fully satisfied (€1000) and COMPLETED
      expect(goals[0].currentAmount).toBe(1000.0);
      expect(goals[0].status).toBe('COMPLETED');
      expect(goals[0].progressPercentage).toBe(100);

      // Remainder (€200) rolls over to Goal 2
      expect(goals[1].currentAmount).toBe(200.0);
      expect(goals[1].status).toBe('ACTIVE');
      expect(goals[1].isCurrentTarget).toBe(true);
      expect(goals[1].progressPercentage).toBe(25); // 200 / 800

      // Goal 3 receives 0
      expect(goals[2].currentAmount).toBe(0.0);
    });

    it('should allow user to reorder goals and adapt allocation sequentially', async () => {
      const existing = await financeRepository.listSavingsGoals();
      for (const g of existing) {
        await financeRepository.deleteSavingsGoal(g.id);
      }

      const g1 = await financeRepository.createSavingsGoal({ name: 'Low Priority', targetAmount: 500, priorityOrder: 1 });
      const g2 = await financeRepository.createSavingsGoal({ name: 'Urgent Target', targetAmount: 300, priorityOrder: 2 });

      // Reorder so Urgent Target is Priority 1
      await financeRepository.reorderSavingsGoals([g2.id, g1.id]);

      const reordered = await financeRepository.listSavingsGoals();
      expect(reordered[0].id).toBe(g2.id);
      expect(reordered[0].name).toBe('Urgent Target');
      expect(reordered[1].id).toBe(g1.id);
      expect(reordered[1].name).toBe('Low Priority');
    });
  });
});
