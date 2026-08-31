import { getDatabase } from '../db';
import { userRepository } from './userRepository';
import { workRepository, getISOWeekBounds } from './workRepository';

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

    const components = await db.query('SELECT * FROM payslip_components WHERE payslipId = ?;', [id]);
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

    return db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO payslips (
           id, employmentId, fileName, localFileUri, periodStart, periodEnd, totalGross, totalNet, bankPayment,
           parsingStatus, extractedDataJson, createdAt, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?);`,
        [
          id, employment.id, input.fileName, input.localFileUri ?? null, startStr, endStr,
          input.totalGross, input.totalNet, input.bankPayment, JSON.stringify(input.extractedData), now, now
        ]
      );

      for (const comp of input.components || []) {
        const compId = generateId('cmp');
        await tx.execute(
          `INSERT INTO payslip_components (
             id, payslipId, code, name, category, amount, percentage, hourlyRate, hours, createdAt
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            compId, id, comp.code || 'CODE', comp.name, comp.category || 'EARNING',
            comp.amount, comp.percentage ?? null, comp.hourlyRate ?? null, comp.hours ?? null, now
          ]
        );
      }

      const created = await payslipRepository.getPayslipById(id);
      return created;
    });
  },

  async reconcilePayslip(id: string) {
    const payslip = await this.getPayslipById(id);
    if (!payslip) throw new Error('Payslip not found');

    const startDate = new Date(payslip.periodStart);
    const weeklyData = await workRepository.getWeeklyCalculation(startDate);
    const calc = weeklyData?.calculation;

    const lineItems = [
      {
        name: 'Total Gross Wage',
        estimatedAmount: calc?.totalGross ?? 0,
        actualAmount: payslip.totalGross,
        difference: Number(((calc?.totalGross ?? 0) - payslip.totalGross).toFixed(2)),
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

    const isMatch = Math.abs((calc?.estimatedBankPayment ?? 0) - payslip.bankPayment) < 0.5;

    return {
      payslip,
      reconciliation: {
        matchStatus: isMatch ? 'EXACT_MATCH' : 'MATCHED_WITH_VARIANCES',
        lineItems,
      },
    };
  },
};
