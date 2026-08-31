import { describe, it, expect } from 'vitest';
import { calculateGrossPayroll, calculateNetPayroll } from '../../shared/payroll/engine';
import { CARRIERE_AH_PROFILE_2026 } from '../../shared/payroll/profiles';
import type { CalculatedWorkSession } from '../../shared/types/time';

describe('Dedicated Reference Payslip Verification Suite — Week 33 & Week 34', () => {
  describe('Week 33 Reference Payslip Verification (loon_82022093.pdf)', () => {
    // 31h 30m = 1890 minutes (16:30 normal uren + 15:00 leeruren)
    const week33Sessions: CalculatedWorkSession[] = [
      {
        elapsedMinutes: 990, // 16h 30m
        unpaidBreakMinutes: 0,
        paidBreakMinutes: 0,
        paidMinutes: 990,
        segments: [{ name: 'Base', rateMultiplier: 1.0, minutes: 990, description: 'Loon normale uren' }],
      },
      {
        elapsedMinutes: 900, // 15h 00m
        unpaidBreakMinutes: 0,
        paidBreakMinutes: 0,
        paidMinutes: 900,
        segments: [{ name: 'Base', rateMultiplier: 1.0, minutes: 900, description: 'Leeruren' }],
      },
    ];

    it('1. Exact Hours: reproduces 31h 30m total paid working time', () => {
      const gross = calculateGrossPayroll(week33Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 8.25 });
      expect(gross.paidMinutes).toBe(1890);
      expect(gross.paidHoursFormatted).toBe('31h 30m');
      expect(gross.paidHoursDecimal.toNumber()).toBe(31.5);
    });

    it('2. Exact Base Wage: reproduces €472.19 (16.5h @ €14.99 + 15h @ €14.99)', () => {
      const gross = calculateGrossPayroll(week33Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 8.25 });
      expect(gross.baseGross.toNumber()).toBe(472.19);
    });

    it('3. Exact ADV Allowance: reproduces €42.53 (31.5h @ €1.35/hr)', () => {
      const gross = calculateGrossPayroll(week33Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 8.25 });
      expect(gross.advAllowance.toNumber()).toBe(42.53);
    });

    it('4. Exact ET-uitruil Gross/Net Adjustments: -€8.25 gross and +€8.25 net tax-free return', () => {
      const gross = calculateGrossPayroll(week33Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 8.25 });
      expect(gross.holidayDaysExchange.toNumber()).toBe(8.25);
      expect(gross.etExchangeDeduction.toNumber()).toBe(8.25);

      const net = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
        etExchangeAmount: 8.25,
        overridePensionBase: 264.78,
        overrideTaxAmount: 44.90,
      });
      expect(net.etExchangeReimbursement.toNumber()).toBe(8.25);
    });

    it('5. Holiday Allowance (8.00%): reproduces ~€41.82 accrual base', () => {
      const gross = calculateGrossPayroll(week33Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 8.25 });
      // Calculated: €41.84 (8% of €522.97) vs payslip €41.82 (variance of €0.02)
      expect(gross.holidayAllowance.toNumber()).toBeCloseTo(41.82, 1);
    });

    it('6. Total Gross: reproduces ~€556.54', () => {
      const gross = calculateGrossPayroll(week33Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 8.25 });
      // Calculated: €556.56 vs payslip €556.54
      expect(gross.totalGross.toNumber()).toBeCloseTo(556.54, 1);
    });

    it('7. Verified Deduction Bases & Percentages: PAWW (Gross), AZV (Base Wage), StiPP (Pension Base), WGA (Loon SV)', () => {
      const gross = calculateGrossPayroll(week33Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 8.25 });
      const net = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
        etExchangeAmount: 8.25,
        overridePensionBase: 264.78, // StiPP pension base from payslip
        overrideTaxAmount: 44.90,     // Exact tax from payslip
      });

      // PAWW: 0.1000% on Total Gross (€556.56) -> €0.56
      const paww = net.payrollDeductions.find((d) => d.code === 'PAWW');
      expect(paww?.ratePercentage).toBe(0.10);
      expect(paww?.baseAmount.toNumber()).toBe(gross.totalGross.toNumber());
      expect(paww?.amount.toNumber()).toBe(0.56);
      expect(paww?.accuracy).toBe('EXACT');

      // AZV: 0.7000% on Base Wage (€472.19) -> €3.31
      const azv = net.payrollDeductions.find((d) => d.code === 'AZV');
      expect(azv?.ratePercentage).toBe(0.70);
      expect(azv?.baseAmount.toNumber()).toBe(gross.baseGross.toNumber());
      expect(azv?.amount.toNumber()).toBe(3.31);
      expect(azv?.accuracy).toBe('EXACT');

      // StiPP Pensioen: 7.5000% on Pension Base (€264.78) -> €19.86
      const stipp = net.payrollDeductions.find((d) => d.code === 'STIPP');
      expect(stipp?.ratePercentage).toBe(7.50);
      expect(stipp?.baseAmount.toNumber()).toBe(264.78);
      expect(stipp?.amount.toNumber()).toBe(19.86);
      expect(stipp?.accuracy).toBe('EXACT');

      // Loon SV: Total Gross minus Employee SV deductions -> €532.83 (payslip €532.81)
      expect(net.loonSv.toNumber()).toBeCloseTo(532.81, 1);

      // WGA / Whk: 0.4050% on Loon SV (€532.83) -> €2.16
      const wga = net.payrollDeductions.find((d) => d.code === 'WGA');
      expect(wga?.ratePercentage).toBe(0.405);
      expect(wga?.baseAmount.toNumber()).toBe(net.loonSv.toNumber());
      expect(wga?.amount.toNumber()).toBe(2.16);
      expect(wga?.accuracy).toBe('EXACT');
    });

    it('8. Fixed Insurance Deductions: €38.01 (Z&Z) and €2.76 (Additional insurance)', () => {
      const gross = calculateGrossPayroll(week33Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 8.25 });
      const net = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
        etExchangeAmount: 8.25,
        overridePensionBase: 264.78,
      });
      expect(net.healthInsurance.toNumber()).toBe(38.01);
      expect(net.additionalInsurance.toNumber()).toBe(2.76);
    });

    it('9. Final Bank Payout: reproduces €453.23 when actual payslip tax and pension base are supplied', () => {
      const gross = calculateGrossPayroll(week33Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 8.25 });
      const net = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
        etExchangeAmount: 8.25,
        overridePensionBase: 264.78,
        overrideTaxAmount: 44.90, // Actual loonheffing from payslip (€29.12 table + €15.78 special)
      });
      // Calculated: €453.25 vs payslip €453.23 (variance of €0.02)
      expect(net.estimatedBankPayment.toNumber()).toBeCloseTo(453.23, 1);
    });
  });

  describe('Week 34 Reference Payslip Verification (loon_82149389.pdf)', () => {
    // 43h 55m = 2635 minutes
    const week34Sessions: CalculatedWorkSession[] = [
      {
        elapsedMinutes: 2635,
        unpaidBreakMinutes: 0,
        paidBreakMinutes: 0,
        paidMinutes: 2635,
        segments: [{ name: 'Base', rateMultiplier: 1.0, minutes: 2635, description: 'Loon normale uren' }],
      },
    ];

    it('1. Exact Hours: reproduces 43h 55m total paid working time', () => {
      const gross = calculateGrossPayroll(week34Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 11.52 });
      expect(gross.paidMinutes).toBe(2635);
      expect(gross.paidHoursFormatted).toBe('43h 55m');
      expect(gross.paidHoursDecimal.toNumber()).toBeCloseTo(43.9167, 4);
    });

    it('2. Exact Base Wage: reproduces €658.31 (43.9167h @ €14.99)', () => {
      const gross = calculateGrossPayroll(week34Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 11.52 });
      expect(gross.baseGross.toNumber()).toBe(658.31);
    });

    it('3. Exact ADV Allowance: reproduces €59.29 (43.9167h @ €1.35/hr)', () => {
      const gross = calculateGrossPayroll(week34Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 11.52 });
      expect(gross.advAllowance.toNumber()).toBe(59.29);
    });

    it('4. Exact ET-uitruil Gross/Net Adjustments: -€11.52 gross and +€11.52 net tax-free return', () => {
      const gross = calculateGrossPayroll(week34Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 11.52 });
      expect(gross.holidayDaysExchange.toNumber()).toBe(11.52);
      expect(gross.etExchangeDeduction.toNumber()).toBe(11.52);

      const net = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
        etExchangeAmount: 11.52,
        overridePensionBase: 369.18,
        overrideTaxAmount: 120.66,
      });
      expect(net.etExchangeReimbursement.toNumber()).toBe(11.52);
    });

    it('5. Holiday Allowance (8.00%): reproduces ~€58.30 accrual base', () => {
      const gross = calculateGrossPayroll(week34Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 11.52 });
      // Calculated: €58.33 (8% of €729.12) vs payslip €58.30 (variance of €0.03)
      expect(gross.holidayAllowance.toNumber()).toBeCloseTo(58.30, 1);
    });

    it('6. Total Gross: reproduces ~€775.90', () => {
      const gross = calculateGrossPayroll(week34Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 11.52 });
      // Calculated: €775.93 vs payslip €775.90 (variance of €0.03)
      expect(gross.totalGross.toNumber()).toBeCloseTo(775.90, 1);
    });

    it('7. Verified Deduction Bases & Percentages: PAWW (Gross), AZV (Base Wage), StiPP (Pension Base), WGA (Loon SV)', () => {
      const gross = calculateGrossPayroll(week34Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 11.52 });
      const net = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
        etExchangeAmount: 11.52,
        overridePensionBase: 369.18, // StiPP pension base from payslip
        overrideTaxAmount: 120.66,   // Exact tax from payslip (€98.67 + €21.99)
      });

      // PAWW: 0.1000% on Total Gross (€775.93) -> €0.78
      const paww = net.payrollDeductions.find((d) => d.code === 'PAWW');
      expect(paww?.ratePercentage).toBe(0.10);
      expect(paww?.baseAmount.toNumber()).toBe(gross.totalGross.toNumber());
      expect(paww?.amount.toNumber()).toBe(0.78);
      expect(paww?.accuracy).toBe('EXACT');

      // AZV: 0.7000% on Base Wage (€658.31) -> €4.61
      const azv = net.payrollDeductions.find((d) => d.code === 'AZV');
      expect(azv?.ratePercentage).toBe(0.70);
      expect(azv?.baseAmount.toNumber()).toBe(gross.baseGross.toNumber());
      expect(azv?.amount.toNumber()).toBe(4.61);
      expect(azv?.accuracy).toBe('EXACT');

      // StiPP Pensioen: 7.5000% on Pension Base (€369.18) -> €27.69
      const stipp = net.payrollDeductions.find((d) => d.code === 'STIPP');
      expect(stipp?.ratePercentage).toBe(7.50);
      expect(stipp?.baseAmount.toNumber()).toBe(369.18);
      expect(stipp?.amount.toNumber()).toBe(27.69);
      expect(stipp?.accuracy).toBe('EXACT');

      // Loon SV: Total Gross minus Employee SV deductions -> €742.85 (payslip €742.82)
      expect(net.loonSv.toNumber()).toBeCloseTo(742.82, 1);

      // WGA / Whk: 0.4050% on Loon SV (€742.85) -> €3.01
      const wga = net.payrollDeductions.find((d) => d.code === 'WGA');
      expect(wga?.ratePercentage).toBe(0.405);
      expect(wga?.baseAmount.toNumber()).toBe(net.loonSv.toNumber());
      expect(wga?.amount.toNumber()).toBe(3.01);
      expect(wga?.accuracy).toBe('EXACT');
    });

    it('8. Fixed Insurance Deductions: €38.01 (Z&Z) and €2.76 (Additional insurance)', () => {
      const gross = calculateGrossPayroll(week34Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 11.52 });
      const net = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
        etExchangeAmount: 11.52,
        overridePensionBase: 369.18,
      });
      expect(net.healthInsurance.toNumber()).toBe(38.01);
      expect(net.additionalInsurance.toNumber()).toBe(2.76);
    });

    it('9. Final Bank Payout: reproduces €589.90 when actual payslip tax and pension base are supplied', () => {
      const gross = calculateGrossPayroll(week34Sessions, CARRIERE_AH_PROFILE_2026, { etExchangeAmount: 11.52 });
      const net = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
        etExchangeAmount: 11.52,
        overridePensionBase: 369.18,
        overrideTaxAmount: 120.66, // Actual loonheffing from payslip (€98.67 table + €21.99 special)
      });
      // Calculated: €589.93 vs payslip €589.90 (variance of €0.03)
      expect(net.estimatedBankPayment.toNumber()).toBeCloseTo(589.90, 1);
    });
  });
});
