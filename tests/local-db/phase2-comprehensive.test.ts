import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase } from './test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import {
  workRepository,
  shiftRepository,
  financeRepository,
  payslipRepository,
  userRepository,
  exportDatabaseToJson,
  importDatabaseFromJson,
} from '../../src/database';

describe('Phase 2 Production Timesheet, Real Personal Finance, Payslips & Settings Tests', () => {
  beforeEach(async () => {
    setupTestDatabase();
    await initializeDatabase();
  });

  describe('1. Timesheet Engine & 7-Day Detail', () => {
    it('groups work sessions by ISO week and computes summary statistics', async () => {
      const weeks = await workRepository.listISOWeeksWithSummary();
      expect(weeks).toBeDefined();
      expect(Array.isArray(weeks)).toBe(true);

      if (weeks.length > 0) {
        const firstWeek = weeks[0];
        expect(firstWeek.year).toBeGreaterThanOrEqual(2025);
        expect(firstWeek.weekNumber).toBeGreaterThanOrEqual(1);
        expect(firstWeek.totalPaidMinutes).toBeGreaterThan(0);
        expect(firstWeek.estimatedGross).toBeGreaterThan(0);
        expect(firstWeek.estimatedNet).toBeGreaterThan(0);
      }
    });

    it('returns a full 7-day timesheet from Monday to Sunday with planned vs actual time', async () => {
      const timesheet = await workRepository.getWeekTimesheetDetail(2026, 36);
      expect(timesheet).toBeDefined();
      expect(timesheet.summary.year).toBe(2026);
      expect(timesheet.summary.weekNumber).toBe(36);
      expect(timesheet.days.length).toBe(7);

      // Verify Monday through Sunday
      expect(timesheet.days[0].dayName).toBe('MONDAY');
      expect(timesheet.days[1].dayName).toBe('TUESDAY');
      expect(timesheet.days[2].dayName).toBe('WEDNESDAY');
      expect(timesheet.days[3].dayName).toBe('THURSDAY');
      expect(timesheet.days[4].dayName).toBe('FRIDAY');
      expect(timesheet.days[5].dayName).toBe('SATURDAY');
      expect(timesheet.days[6].dayName).toBe('SUNDAY');

      // Verify date formatting
      expect(timesheet.days[0].dateStr).toBe('2026-08-31');
      expect(timesheet.days[6].dateStr).toBe('2026-09-06');
    });

    it('allows adding manual work session to an empty historical day and recalculates weekly payroll', async () => {
      const newSession = await workRepository.createManualWork({
        actualStart: '2026-09-02T14:30:00.000Z',
        rawFinish: '2026-09-02T23:17:00.000Z', // will round to 23:20
        breaks: [
          { type: 'PAID_15', name: '15m Coffee', durationMinutes: 15, isPaid: true },
          { type: 'UNPAID_30', name: '30m Dinner', durationMinutes: 30, isPaid: false },
        ],
      });

      expect(newSession).toBeDefined();
      expect(newSession.session.paidMinutes).toBe(500); // 530 rounded (14:30 -> 23:20) - 30 unpaid = 500

      const timesheet = await workRepository.getWeekTimesheetDetail(2026, 36);
      const wednesday = timesheet.days.find((d: any) => d.dayName === 'WEDNESDAY');
      expect(wednesday?.hasWork).toBe(true);
      expect(wednesday?.paidMinutes).toBe(500);
    });
  });

  describe('2. Real Personal Finance, Fixed Bills & Forecast Engine', () => {
    it('creates, lists, updates, and deletes fixed recurring bills', async () => {
      const categories = await financeRepository.listCategories();
      const rentCat = categories.find((c: any) => c.name === 'Housing') || categories[0];

      // 1. Create
      const bill = await financeRepository.createFixedBill({
        categoryId: rentCat.id,
        name: 'Apartment Rent Bleiswijk',
        amount: 550,
        dayOfMonth: 1,
        note: 'Auto-debited from Dutch bank account',
      });
      expect(bill).toBeDefined();
      expect(bill.name).toBe('Apartment Rent Bleiswijk');
      expect(bill.amount).toBe(550);
      expect(bill.isActive).toBe(true);

      // 2. List
      const allBills = await financeRepository.listFixedBills();
      expect(allBills.some((b) => b.id === bill.id)).toBe(true);

      // 3. Update
      const updated = await financeRepository.updateFixedBill(bill.id, {
        amount: 575,
        isActive: false,
      });
      expect(updated.amount).toBe(575);
      expect(updated.isActive).toBe(false);

      // 4. Delete
      const delRes = await financeRepository.deleteFixedBill(bill.id);
      expect(delRes.success).toBe(true);
    });

    it('computes monthly overview with income breakdown, fixed bills, variable expenses and savings rate', async () => {
      const overview = await financeRepository.getMonthlyOverview(2026, 8);
      expect(overview).toBeDefined();
      expect(overview.period.year).toBe(2026);
      expect(overview.period.month).toBe(8);
      expect(overview.income).toBeDefined();
      expect(overview.expenses).toBeDefined();
      expect(overview.savings).toBeDefined();
      expect(overview.projection).toBeDefined();
      expect(typeof overview.savings.savingsRatePercentage).toBe('number');
    });

    it('computes 6-month wealth accumulation projection based on initial savings', async () => {
      const forecast = await financeRepository.getForecast(6);
      expect(forecast.horizonMonths).toBe(6);
      expect(forecast.currentSavings).toBeGreaterThan(0);
      expect(forecast.projections.length).toBe(6);
      expect(forecast.projections[5].projectedSavings).toBeGreaterThan(forecast.currentSavings);
    });
  });

  describe('3. Payslips Document Storage & Line Reconciliation Engine', () => {
    it('saves official payslip with components and performs line-by-line reconciliation against timesheet', async () => {
      const payslip = await payslipRepository.savePayslip({
        fileName: 'Salarisspecificatie_2026_W36.pdf',
        periodStart: '2026-08-31',
        periodEnd: '2026-09-06',
        totalGross: 653.60,
        totalNet: 520.40,
        bankPayment: 485.00,
        extractedData: {
          employer: 'Carrière Personeelsdiensten',
          periodWeek: 36,
        },
        components: [
          { code: '1000', name: 'Base Wage', category: 'EARNING', amount: 535.14 },
          { code: '1050', name: 'ADV Compensation', category: 'EARNING', amount: 44.21 },
          { code: '1080', name: 'Holiday Allowance', category: 'EARNING', amount: 44.57 },
          { code: '3010', name: 'Wage Tax', category: 'DEDUCTION', amount: 97.80 },
          { code: '3050', name: 'Health Insurance', category: 'DEDUCTION', amount: 35.40 },
        ],
      });

      expect(payslip).toBeDefined();
      expect(payslip.fileName).toBe('Salarisspecificatie_2026_W36.pdf');
      expect(payslip.components.length).toBe(5);

      // Perform Reconciliation
      const rec = await payslipRepository.reconcilePayslip(payslip.id);
      expect(rec).toBeDefined();
      expect(rec.reconciliation.lineItems.length).toBeGreaterThanOrEqual(3);
      expect(rec.reconciliation.matchStatus).toBeDefined();

      // Clean up
      const del = await payslipRepository.deletePayslip(payslip.id);
      expect(del.success).toBe(true);
    });
  });

  describe('4. Settings, Employment, Payroll Configuration & Protected Reset', () => {
    it('updates worker profile and initial savings balance', async () => {
      const updated = await userRepository.updateProfile({
        name: 'Alper Ozer Senior',
        initialSavings: 2500,
      });
      expect(updated.name).toBe('Alper Ozer Senior');
      expect(updated.initialSavings).toBe(2500);
    });

    it('updates employment info including role and location', async () => {
      const emp = await userRepository.getActiveEmployment();
      expect(emp).toBeDefined();

      const updated = await userRepository.updateEmployment(emp.id, {
        role: 'Senior Order Picker & Reach Truck',
        location: 'Bleiswijk Distribution Center',
      });
      expect(updated.role).toBe('Senior Order Picker & Reach Truck');
      expect(updated.location).toBe('Bleiswijk Distribution Center');
    });

    it('updates payroll CAO configuration parameters', async () => {
      const config = await userRepository.getEffectivePayrollConfig();
      expect(config).toBeDefined();

      const updated = await userRepository.updatePayrollConfiguration(config.id, {
        baseHourlyRate: 15.50,
        advHourlyRate: 1.45,
      });
      expect(updated.baseHourlyRate).toBe(15.50);
      expect(updated.advHourlyRate).toBe(1.45);
    });

    it('performs JSON export and atomically restores database', async () => {
      const backup = await exportDatabaseToJson();
      expect(backup.version).toBe(4);
      expect(backup.userProfile.length).toBe(1);

      const restore = await importDatabaseFromJson(backup);
      expect(restore.success).toBe(true);
    });

    it('resets all local database tables back to fresh seeded defaults cleanly', async () => {
      const reset = await userRepository.resetAllData();
      expect(reset.success).toBe(true);

      const profile = await userRepository.getProfile();
      expect(profile).toBeDefined();
      expect(profile.name).toBe('Alper Ozer');

      const employment = await userRepository.getActiveEmployment();
      expect(employment).toBeDefined();
      expect(employment.employerName).toBe('Albert Heijn B.V. Bleiswijk');
    });
  });
});
