import { getDatabase } from '../db';
import { userRepository } from './userRepository';
import { workRepository } from './workRepository';
import { dbEvents } from '../events';

function generateId(prefix = 'ps'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export const payslipRepository = {
  async listPayslips() {
    const db = getDatabase();
    return db.query('SELECT * FROM payslips ORDER BY periodStart DESC;');
  },

  async getPayslipById(id: string) {
    const db = getDatabase();
    const payslip = await db.queryFirst('SELECT * FROM payslips WHERE id = ?;', [id]);
    if (!payslip) return null;

    const components = await db.query('SELECT * FROM payslip_components WHERE payslipId = ? ORDER BY category ASC, amount DESC;', [id]);
    return {
      ...payslip,
      components,
      extractedData: JSON.parse(payslip.extractedDataJson || '{}'),
    };
  },

  async savePayslip(input: {
    fileName: string;
    localFileUri?: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    totalGross: number;
    totalNet: number;
    bankPayment: number;
    extractedData: any;
    components?: any[];
  }) {
    const db = getDatabase();
    const employment = await userRepository.getActiveEmployment();
    if (!employment) throw new Error('No active employment found.');

    const id = generateId('ps');
    const startStr = typeof input.periodStart === 'string' ? input.periodStart : input.periodStart.toISOString();
    const endStr = typeof input.periodEnd === 'string' ? input.periodEnd : input.periodEnd.toISOString();
    const now = new Date().toISOString();

    const created = await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO payslips (
           id, employmentId, fileName, localFileUri, periodStart, periodEnd, totalGross, totalNet, bankPayment,
           parsingStatus, extractedDataJson, createdAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?);`,
        [
          id,
          employment.id,
          input.fileName,
          input.localFileUri ?? null,
          startStr,
          endStr,
          input.totalGross,
          input.totalNet,
          input.bankPayment,
          JSON.stringify(input.extractedData),
          now,
          now,
        ]
      );

      for (const comp of input.components || []) {
        const compId = generateId('cmp');
        await tx.execute(
          `INSERT INTO payslip_components (
             id, payslipId, code, name, category, amount, percentage, hourlyRate, hours, createdAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            compId,
            id,
            comp.code || 'CODE',
            comp.name,
            comp.category || 'EARNING',
            comp.amount,
            comp.percentage ?? null,
            comp.hourlyRate ?? null,
            comp.hours ?? null,
            now,
          ]
        );
      }

      return payslipRepository.getPayslipById(id);
    });

    dbEvents.emit('payslips_changed');
    dbEvents.emit('finance_changed');
    return created;
  },

  async deletePayslip(id: string) {
    const db = getDatabase();
    await db.execute('DELETE FROM payslips WHERE id = ?;', [id]);
    dbEvents.emit('payslips_changed');
    dbEvents.emit('finance_changed');
    return { success: true };
  },

  async reconcilePayslip(id: string) {
    const payslip = await this.getPayslipById(id);
    if (!payslip) throw new Error('Payslip not found');

    const startDate = new Date(payslip.periodStart);
    const weeklyData = await workRepository.getWeeklyCalculation(startDate);
    const calc = weeklyData?.calculation;
    const extracted = payslip.extractedData?.wageDetails || {};

    const actualHourlyRate = extracted.hourlyRate || (weeklyData?.calculation?.baseHourlyRate ?? 14.99);
    const estHourlyRate = calc?.baseHourlyRate ?? actualHourlyRate;

    const estAdv = calc?.advAllowance ?? 0;
    const actualAdv = extracted.advAllowance ?? (payslip.components?.find((c: any) => c.code === '1050')?.amount ?? 0);

    const estHoliday = calc?.holidayAllowance ?? 0;
    const actualHoliday = extracted.holidayAllowance ?? (payslip.components?.find((c: any) => c.code === '1080')?.amount ?? 0);

    const estAllowances = Number((estAdv + estHoliday).toFixed(2));
    const actualAllowances = Number((actualAdv + actualHoliday).toFixed(2));

    const estDeductions = calc ? Number(((calc.totalGross - calc.estimatedBankPayment) - (calc.advAllowance + calc.holidayAllowance)).toFixed(2)) : 0;
    const actualDeductions = Number((payslip.totalGross - payslip.bankPayment).toFixed(2));

    const lineItems = [
      {
        name: 'Total Gross Wage',
        estimatedAmount: calc?.totalGross ?? 0,
        actualAmount: payslip.totalGross,
        difference: Number(((calc?.totalGross ?? 0) - payslip.totalGross).toFixed(2)),
      },
      {
        name: 'Base Hourly Rate',
        estimatedAmount: estHourlyRate,
        actualAmount: actualHourlyRate,
        difference: Number((estHourlyRate - actualHourlyRate).toFixed(2)),
      },
      {
        name: 'Allowances (ADV + Holiday)',
        estimatedAmount: estAllowances,
        actualAmount: actualAllowances,
        difference: Number((estAllowances - actualAllowances).toFixed(2)),
      },
      {
        name: 'Total Deductions & Taxes',
        estimatedAmount: estDeductions,
        actualAmount: actualDeductions,
        difference: Number((estDeductions - actualDeductions).toFixed(2)),
      },
      {
        name: 'Total Net Pay',
        estimatedAmount: calc?.estimatedNet ?? 0,
        actualAmount: payslip.totalNet,
        difference: Number(((calc?.estimatedNet ?? 0) - payslip.totalNet).toFixed(2)),
      },
      {
        name: 'Actual Bank Payment',
        estimatedAmount: calc?.estimatedBankPayment ?? 0,
        actualAmount: payslip.bankPayment,
        difference: Number(((calc?.estimatedBankPayment ?? 0) - payslip.bankPayment).toFixed(2)),
      },
    ];

    const variances = {
      grossVariance: Number(((calc?.totalGross ?? 0) - payslip.totalGross).toFixed(2)),
      netVariance: Number(((calc?.estimatedNet ?? 0) - payslip.totalNet).toFixed(2)),
      bankPayoutVariance: Number(((calc?.estimatedBankPayment ?? 0) - payslip.bankPayment).toFixed(2)),
      hourlyRateVariance: Number((estHourlyRate - actualHourlyRate).toFixed(2)),
      allowanceVariance: Number((estAllowances - actualAllowances).toFixed(2)),
      deductionVariance: Number((estDeductions - actualDeductions).toFixed(2)),
    };

    const isMatch = Math.abs(variances.bankPayoutVariance) < 0.5;

    return {
      payslip,
      variances,
      reconciliation: {
        matchStatus: isMatch ? 'EXACT_MATCH' : 'MATCHED_WITH_VARIANCES',
        lineItems,
      },
    };
  },

  /**
   * Deterministic Calibration System:
   * Compares multiple confirmed payslips against current payroll configuration,
   * detects persistent parameter drift across >= 2 payslips, and suggests verified adjustments.
   */
  async generateCalibrationSuggestions(employmentId?: string) {
    const db = getDatabase();
    const targetEmploymentId = employmentId || (await userRepository.getActiveEmployment())?.id;
    if (!targetEmploymentId) return [];

    const activeConfig = await db.queryFirst(
      'SELECT * FROM payroll_configurations WHERE employmentId = ? AND isDefault = 1 LIMIT 1;',
      [targetEmploymentId]
    );
    if (!activeConfig) return [];

    const payslips = await db.query(
      'SELECT * FROM payslips WHERE employmentId = ? ORDER BY periodStart DESC LIMIT 10;',
      [targetEmploymentId]
    );
    if (payslips.length < 2) return [];

    const suggestions: any[] = [];
    const sampleCount = payslips.length;

    // 1. Check Hourly Rate Consistency
    const actualRates: number[] = [];
    const advDiscrepancies: number[] = [];
    const grossDiscrepancies: number[] = [];

    for (const p of payslips) {
      const parsed = JSON.parse(p.extractedDataJson || '{}');
      const details = parsed.wageDetails || {};
      if (details.hourlyRate && details.hourlyRate > 0) {
        actualRates.push(details.hourlyRate);
      }

      // Check weekly calculation
      const startDate = new Date(p.periodStart);
      const weeklyData = await workRepository.getWeeklyCalculation(startDate);
      const calc = weeklyData?.calculation;
      if (calc) {
        grossDiscrepancies.push(Number((p.totalGross - calc.totalGross).toFixed(2)));
        if (details.advAllowance && calc.advAllowance) {
          advDiscrepancies.push(Number((details.advAllowance - calc.advAllowance).toFixed(2)));
        }
      }
    }

    // A. Check Base Hourly Rate Calibration
    if (actualRates.length >= 2) {
      const avgActualRate = Number((actualRates.reduce((a, b) => a + b, 0) / actualRates.length).toFixed(2));
      const currentRate = activeConfig.baseHourlyRate;
      if (Math.abs(avgActualRate - currentRate) >= 0.05) {
        suggestions.push({
          id: `calib_rate_${Date.now()}`,
          employmentId: targetEmploymentId,
          parameterName: 'baseHourlyRate',
          oldValue: currentRate,
          suggestedValue: avgActualRate,
          sampleCount: actualRates.length,
          reason: `Payslip actual hourly rate is consistently €${avgActualRate.toFixed(2)} across ${actualRates.length} confirmed payslips (current config: €${currentRate.toFixed(2)}).`,
          status: 'PENDING',
        });
      }
    }

    // B. Check ADV Allowance Consistency
    if (advDiscrepancies.length >= 2) {
      const avgAdvDiff = Number((advDiscrepancies.reduce((a, b) => a + b, 0) / advDiscrepancies.length).toFixed(2));
      if (Math.abs(avgAdvDiff) >= 1.0) {
        // Average drift in ADV
        const currentAdvRate = activeConfig.advHourlyRate || 1.35;
        const suggestedAdv = Number((currentAdvRate + (avgAdvDiff / 36)).toFixed(2));
        suggestions.push({
          id: `calib_adv_${Date.now()}`,
          employmentId: targetEmploymentId,
          parameterName: 'advHourlyRate',
          oldValue: currentAdvRate,
          suggestedValue: Math.max(0.5, suggestedAdv),
          sampleCount: advDiscrepancies.length,
          reason: `Payroll ADV estimate differs by average €${Math.abs(avgAdvDiff).toFixed(2)} across ${advDiscrepancies.length} confirmed payslips.`,
          status: 'PENDING',
        });
      }
    }

    // Save pending suggestions to DB
    const now = new Date().toISOString();
    for (const s of suggestions) {
      const existing = await db.queryFirst(
        `SELECT id FROM payroll_calibrations WHERE employmentId = ? AND parameterName = ? AND status = 'PENDING';`,
        [s.employmentId, s.parameterName]
      );
      if (!existing) {
        await db.execute(
          `INSERT INTO payroll_calibrations (id, employmentId, parameterName, oldValue, suggestedValue, sampleCount, reason, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?);`,
          [s.id, s.employmentId, s.parameterName, s.oldValue, s.suggestedValue, s.sampleCount, s.reason, now, now]
        );
      }
    }

    return db.query(
      `SELECT * FROM payroll_calibrations WHERE employmentId = ? AND status = 'PENDING' ORDER BY createdAt DESC;`,
      [targetEmploymentId]
    );
  },

  async applyCalibration(calibrationId: string) {
    const db = getDatabase();
    const calib = await db.queryFirst('SELECT * FROM payroll_calibrations WHERE id = ?;', [calibrationId]);
    if (!calib) throw new Error('Calibration suggestion not found.');

    const now = new Date().toISOString();

    return db.transaction(async (tx) => {
      // 1. Update payroll configuration
      if (calib.parameterName === 'baseHourlyRate') {
        await tx.execute(
          `UPDATE payroll_configurations SET baseHourlyRate = ?, updatedAt = ? WHERE employmentId = ? AND isDefault = 1;`,
          [calib.suggestedValue, now, calib.employmentId]
        );
      } else if (calib.parameterName === 'advHourlyRate') {
        await tx.execute(
          `UPDATE payroll_configurations SET advHourlyRate = ?, updatedAt = ? WHERE employmentId = ? AND isDefault = 1;`,
          [calib.suggestedValue, now, calib.employmentId]
        );
      } else if (calib.parameterName === 'holidayAllowancePercentage') {
        await tx.execute(
          `UPDATE payroll_configurations SET holidayAllowancePercentage = ?, updatedAt = ? WHERE employmentId = ? AND isDefault = 1;`,
          [calib.suggestedValue, now, calib.employmentId]
        );
      }

      // 2. Mark calibration as APPLIED
      await tx.execute(
        `UPDATE payroll_calibrations SET status = 'APPLIED', appliedAt = ?, updatedAt = ? WHERE id = ?;`,
        [now, now, calibrationId]
      );

      dbEvents.emit('settings_changed');
      dbEvents.emit('work_changed');
      return { success: true, updatedParameter: calib.parameterName, newValue: calib.suggestedValue };
    });
  },

  async listCalibrations(employmentId?: string) {
    const db = getDatabase();
    const empId = employmentId || (await userRepository.getActiveEmployment())?.id;
    if (!empId) return [];
    return db.query(
      'SELECT * FROM payroll_calibrations WHERE employmentId = ? ORDER BY createdAt DESC;',
      [empId]
    );
  },
};

