import { describe, it, expect, beforeEach } from 'vitest';
import { setupTestDatabase } from '../local-db/test-db-setup';
import { initializeDatabase } from '../../src/database/init';
import { payslipRepository } from '../../src/database/repositories/payslipRepository';
import { userRepository } from '../../src/database/repositories/userRepository';
import { getDatabase } from '../../src/database/db';

describe('Payslip Reconciliation & Deterministic Calibration', () => {
  beforeEach(async () => {
    setupTestDatabase();
    await initializeDatabase();
  });

  it('should compute exact variances across gross, net, bank, allowances, and deductions', async () => {
    const payslip = await payslipRepository.savePayslip({
      fileName: 'loon_w33.pdf',
      periodStart: '2026-08-10',
      periodEnd: '2026-08-16',
      totalGross: 556.54,
      totalNet: 485.75,
      bankPayment: 453.23,
      extractedData: {
        wageDetails: {
          hourlyRate: 14.99,
          advAllowance: 42.53,
          holidayAllowance: 41.82,
        },
      },
      components: [],
    });

    const reconciliation = await payslipRepository.reconcilePayslip(payslip.id);

    expect(reconciliation).toBeDefined();
    expect(reconciliation.variances).toBeDefined();
    expect(reconciliation.variances.bankPayoutVariance).toBeDefined();
    expect(reconciliation.reconciliation.lineItems.length).toBeGreaterThanOrEqual(5);
  });

  it('should generate calibration suggestions when multiple payslips have consistent rate differences and apply adjustment', async () => {
    const emp = await userRepository.getActiveEmployment();
    expect(emp).toBeDefined();

    // Insert 2 payslips with a higher actual hourly rate: 15.50 (current config is 14.99)
    await payslipRepository.savePayslip({
      fileName: 'p1.pdf',
      periodStart: '2026-08-03',
      periodEnd: '2026-08-09',
      totalGross: 620.0,
      totalNet: 510.0,
      bankPayment: 480.0,
      extractedData: {
        wageDetails: {
          hourlyRate: 15.50,
          advAllowance: 45.0,
        },
      },
    });

    await payslipRepository.savePayslip({
      fileName: 'p2.pdf',
      periodStart: '2026-08-10',
      periodEnd: '2026-08-16',
      totalGross: 620.0,
      totalNet: 510.0,
      bankPayment: 480.0,
      extractedData: {
        wageDetails: {
          hourlyRate: 15.50,
          advAllowance: 45.0,
        },
      },
    });

    const suggestions = await payslipRepository.generateCalibrationSuggestions(emp!.id);
    expect(suggestions.length).toBeGreaterThanOrEqual(1);

    const rateSuggestion = suggestions.find((s: any) => s.parameterName === 'baseHourlyRate');
    expect(rateSuggestion).toBeDefined();
    expect(rateSuggestion.suggestedValue).toBe(15.50);
    expect(rateSuggestion.oldValue).toBe(14.99);
    expect(rateSuggestion.sampleCount).toBe(2);
    expect(rateSuggestion.status).toBe('PENDING');

    // Apply adjustment
    const applyResult = await payslipRepository.applyCalibration(rateSuggestion.id);
    expect(applyResult.success).toBe(true);
    expect(applyResult.newValue).toBe(15.50);

    // Verify payroll configuration was calibrated in DB
    const db = getDatabase();
    const config = await db.queryFirst('SELECT * FROM payroll_configurations WHERE employmentId = ? AND isDefault = 1;', [emp!.id]);
    expect(config.baseHourlyRate).toBe(15.50);

    // Verify calibration status is now APPLIED
    const calibrations = await payslipRepository.listCalibrations(emp!.id);
    const updated = calibrations.find((c: any) => c.id === rateSuggestion.id);
    expect(updated.status).toBe('APPLIED');
    expect(updated.appliedAt).toBeDefined();
  });
});
