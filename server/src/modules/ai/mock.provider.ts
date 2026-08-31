import type { IAiParserProvider } from './types.js';
import { parsedPayslipSchema, type ParsedPayslipData } from '../../../../shared/schemas/payslip.schema.js';

export class MockAiProvider implements IAiParserProvider {
  name = 'MockAiProvider';

  async parsePayslipText(text: string): Promise<ParsedPayslipData> {
    const isWeek34 = text.includes('Week 34') || text.includes('17-08-2026 t/m 23-08-2026');
    const isWeek33 = text.includes('Week 33') || text.includes('10-08-2026 t/m 16-08-2026');

    if (isWeek34) {
      const data: ParsedPayslipData = {
        payrollPeriod: {
          year: 2026,
          weekNumber: 34,
          startDate: '2026-08-17',
          endDate: '2026-08-23',
        },
        employer: {
          employerName: 'Albert Heijn B.V. Bleiswijk',
          agencyName: 'Carriere Personeelsdiensten B.V.',
          employeeNumber: '7695425',
        },
        hours: {
          normalHours: 43.9167,
          trainingHours: 0,
          overtimeHours: 0,
          totalHours: 43.9167,
        },
        earnings: [
          { name: 'Loon normale uren', hours: 43.9167, rate: 14.99, amount: 658.31, category: 'BASE_SALARY' },
          { name: 'Belaste ADV-toeslag Albert Heijn', hours: 43.9167, rate: 1.35, amount: 59.29, category: 'ADV' },
          { name: 'Vakantiegeld', amount: 58.30, category: 'HOLIDAY_ALLOWANCE' },
          { name: 'Vakantiedagen', amount: 11.52, category: 'HOLIDAY_DAYS' },
          { name: 'ET-uitruil huisvesting', amount: -11.52, category: 'OTHER' },
        ],
        deductions: [
          { name: 'PAWW bijdrage', code: 'PAWW', baseAmount: 775.90, ratePercentage: 0.10, amount: 0.78, category: 'PAWW' },
          { name: 'Premie AZV', code: 'AZV', baseAmount: 658.31, ratePercentage: 0.70, amount: 4.61, category: 'AZV' },
          { name: 'StiPP Pensioen', code: 'STIPP', baseAmount: 369.18, ratePercentage: 7.50, amount: 27.69, category: 'PENSION' },
          { name: 'Gediff. premie Whk (WGA)', code: 'WGA', baseAmount: 742.82, ratePercentage: 0.405, amount: 3.01, category: 'WGA' },
          { name: 'Loonheffingen (Week wit)', code: 'TAX_TABLE', baseAmount: 686.06, amount: 98.67, category: 'TAX' },
          { name: 'Loonheffingen (bijz. beloningen wit)', code: 'TAX_SPECIAL', baseAmount: 56.76, amount: 21.99, category: 'TAX' },
        ],
        adjustments: [
          { name: 'Vergoeding ET-uitruil huisvesting', amount: 11.52, isTaxFree: true, category: 'ET_EXCHANGE' },
          { name: 'Inhoudinge aanvullende verzekeringen', amount: -2.76, isTaxFree: false, category: 'ADDITIONAL_INSURANCE' },
          { name: 'Inhouding verzekeringen Z&Z', amount: -38.01, isTaxFree: false, category: 'HEALTH_INSURANCE' },
        ],
        totals: {
          totalGross: 775.90,
          loonSv: 742.82,
          taxableWage: 742.82,
          totalTax: 120.66,
          totalNet: 619.15,
          bankPayment: 589.90,
        },
        accruals: {
          holidayHoursAccrued: 4.63,
          holidayHoursBalance: 6.6,
          holidayMoneyBalance: 0.0,
        },
        confidence: 0.99,
        rawSummary: 'Extracted Week 34 payslip from Carrière',
      };
      return parsedPayslipSchema.parse(data);
    }

    if (isWeek33) {
      const data: ParsedPayslipData = {
        payrollPeriod: {
          year: 2026,
          weekNumber: 33,
          startDate: '2026-08-10',
          endDate: '2026-08-16',
        },
        employer: {
          employerName: 'Albert Heijn B.V. Bleiswijk',
          agencyName: 'Carriere Personeelsdiensten B.V.',
          employeeNumber: '7695425',
        },
        hours: {
          normalHours: 16.5,
          trainingHours: 15.0,
          overtimeHours: 0,
          totalHours: 31.5,
        },
        earnings: [
          { name: 'Loon normale uren', hours: 16.5, rate: 14.99, amount: 247.33, category: 'BASE_SALARY' },
          { name: 'Leeruren', hours: 15.0, rate: 14.99, amount: 224.86, category: 'TRAINING' },
          { name: 'Belaste ADV-toeslag Albert Heijn', hours: 31.5, rate: 1.35, amount: 42.53, category: 'ADV' },
          { name: 'Vakantiegeld', amount: 41.82, category: 'HOLIDAY_ALLOWANCE' },
          { name: 'Vakantiedagen', amount: 8.25, category: 'HOLIDAY_DAYS' },
          { name: 'ET-uitruil huisvesting', amount: -8.25, category: 'OTHER' },
        ],
        deductions: [
          { name: 'PAWW bijdrage', code: 'PAWW', baseAmount: 556.54, ratePercentage: 0.10, amount: 0.56, category: 'PAWW' },
          { name: 'Premie AZV', code: 'AZV', baseAmount: 472.19, ratePercentage: 0.70, amount: 3.31, category: 'AZV' },
          { name: 'StiPP Pensioen', code: 'STIPP', baseAmount: 264.78, ratePercentage: 7.50, amount: 19.86, category: 'PENSION' },
          { name: 'Gediff. premie Whk (WGA)', code: 'WGA', baseAmount: 532.81, ratePercentage: 0.405, amount: 2.16, category: 'WGA' },
          { name: 'Loonheffingen (Week wit)', code: 'TAX_TABLE', baseAmount: 492.09, amount: 29.12, category: 'TAX' },
          { name: 'Loonheffingen (bijz. beloningen wit)', code: 'TAX_SPECIAL', baseAmount: 40.72, amount: 15.78, category: 'TAX' },
        ],
        adjustments: [
          { name: 'Vergoeding ET-uitruil huisvesting', amount: 8.25, isTaxFree: true, category: 'ET_EXCHANGE' },
          { name: 'Inhoudinge aanvullende verzekeringen', amount: -2.76, isTaxFree: false, category: 'ADDITIONAL_INSURANCE' },
          { name: 'Inhouding verzekeringen Z&Z', amount: -38.01, isTaxFree: false, category: 'HEALTH_INSURANCE' },
        ],
        totals: {
          totalGross: 556.54,
          loonSv: 532.81,
          taxableWage: 532.81,
          totalTax: 44.90,
          totalNet: 485.75,
          bankPayment: 453.23,
        },
        accruals: {
          holidayHoursAccrued: 3.28,
          holidayHoursBalance: 2.73,
          holidayMoneyBalance: 0.0,
        },
        confidence: 0.98,
        rawSummary: 'Extracted Week 33 payslip from Carrière',
      };
      return parsedPayslipSchema.parse(data);
    }

    const fallbackData: ParsedPayslipData = {
      payrollPeriod: {
        year: 2026,
        weekNumber: 1,
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      },
      hours: {
        normalHours: 40.0,
        trainingHours: 0,
        overtimeHours: 0,
        totalHours: 40.0,
      },
      earnings: [
        { name: 'Base wage', hours: 40.0, rate: 14.99, amount: 599.60, category: 'BASE_SALARY' },
      ],
      deductions: [],
      adjustments: [],
      totals: {
        totalGross: 599.60,
        totalNet: 500.00,
        bankPayment: 500.00,
      },
      confidence: 0.85,
    };

    return parsedPayslipSchema.parse(fallbackData);
  }
}
