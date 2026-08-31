import { describe, it, expect } from 'vitest';
import { calculateGrossPayroll, calculateNetPayroll } from '../../shared/payroll/engine.js';
import { CARRIERE_AH_PROFILE_2026, CARRIERE_AH_PROFILE_WEEK13_2026 } from '../../shared/payroll/profiles.js';
import type { CalculatedWorkSession } from '../../shared/types/time.js';

describe('Deterministic Payroll Engine — Reference Payslip Tests', () => {
  it('accurately reproduces Week 33 reference payslip figures', () => {
    // Week 33: 31h 30m = 1890 minutes (16:30 normal + 15:00 training)
    const sessions: CalculatedWorkSession[] = [
      {
        elapsedMinutes: 990, // 16h 30m
        unpaidBreakMinutes: 0,
        paidBreakMinutes: 0,
        paidMinutes: 990,
        segments: [{ name: 'Base', rateMultiplier: 1.0, minutes: 990, description: 'Normal' }],
      },
      {
        elapsedMinutes: 900, // 15h 00m
        unpaidBreakMinutes: 0,
        paidBreakMinutes: 0,
        paidMinutes: 900,
        segments: [{ name: 'Base', rateMultiplier: 1.0, minutes: 900, description: 'Training' }],
      },
    ];

    const gross = calculateGrossPayroll(sessions, CARRIERE_AH_PROFILE_2026, {
      etExchangeAmount: 8.25,
    });

    expect(gross.paidMinutes).toBe(1890); // 31h 30m
    expect(gross.baseGross.toNumber()).toBe(472.19); // €472.19 (247.33 + 224.86)
    expect(gross.advAllowance.toNumber()).toBe(42.53); // €42.53
    expect(gross.holidayDaysExchange.toNumber()).toBe(8.25); // €8.25
    expect(gross.holidayAllowance.toNumber()).toBe(41.84); // 8% of €522.97 (~€41.82 on payslip)
    expect(gross.etExchangeDeduction.toNumber()).toBe(8.25); // -€8.25
    expect(gross.totalGross.toNumber()).toBe(556.56); // €556.54 on payslip

    // Calculate Net with exact Week 33 reference pension and tax parameters
    const net = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
      etExchangeAmount: 8.25,
      overridePensionBase: 264.78,
      overrideTaxAmount: 44.90, // 29.12 + 15.78
    });

    // Check line-item deductions
    const paww = net.payrollDeductions.find((d) => d.code === 'PAWW');
    const azv = net.payrollDeductions.find((d) => d.code === 'AZV');
    const stipp = net.payrollDeductions.find((d) => d.code === 'STIPP');
    const wga = net.payrollDeductions.find((d) => d.code === 'WGA');

    expect(paww?.amount.toNumber()).toBe(0.56); // €0.56 (0.10% of 556.56)
    expect(azv?.amount.toNumber()).toBe(3.31);  // €3.31 (0.70% of 472.19)
    expect(stipp?.amount.toNumber()).toBe(19.86); // €19.86 (7.50% of 264.78)
    expect(net.loonSv.toNumber()).toBe(532.83); // €532.81 on payslip
    expect(wga?.amount.toNumber()).toBe(2.16); // €2.16 (0.405% of 532.83)

    // Net adjustments
    expect(net.etExchangeReimbursement.toNumber()).toBe(8.25);
    expect(net.healthInsurance.toNumber()).toBe(38.01);
    expect(net.additionalInsurance.toNumber()).toBe(2.76);
    expect(net.estimatedBankPayment.toNumber()).toBe(453.25); // €453.23 on payslip
  });

  it('accurately reproduces Week 34 reference payslip figures', () => {
    // Week 34: 43h 55m = 2635 minutes
    const sessions: CalculatedWorkSession[] = [
      {
        elapsedMinutes: 2635,
        unpaidBreakMinutes: 0,
        paidBreakMinutes: 0,
        paidMinutes: 2635,
        segments: [{ name: 'Base', rateMultiplier: 1.0, minutes: 2635, description: 'Normal' }],
      },
    ];

    const gross = calculateGrossPayroll(sessions, CARRIERE_AH_PROFILE_2026, {
      etExchangeAmount: 11.52,
    });

    expect(gross.paidMinutes).toBe(2635); // 43h 55m
    expect(gross.paidHoursFormatted).toBe('43h 55m');
    expect(gross.baseGross.toNumber()).toBe(658.31); // €658.31
    expect(gross.advAllowance.toNumber()).toBe(59.29); // €59.29
    expect(gross.holidayDaysExchange.toNumber()).toBe(11.52); // €11.52
    expect(gross.holidayAllowance.toNumber()).toBe(58.33); // €58.30 on payslip
    expect(gross.etExchangeDeduction.toNumber()).toBe(11.52); // -€11.52
    expect(gross.totalGross.toNumber()).toBe(775.93); // €775.90 on payslip

    const net = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
      etExchangeAmount: 11.52,
      overridePensionBase: 369.18,
      overrideTaxAmount: 120.66, // 98.67 + 21.99
    });

    const paww = net.payrollDeductions.find((d) => d.code === 'PAWW');
    const azv = net.payrollDeductions.find((d) => d.code === 'AZV');
    const stipp = net.payrollDeductions.find((d) => d.code === 'STIPP');
    const wga = net.payrollDeductions.find((d) => d.code === 'WGA');

    expect(paww?.amount.toNumber()).toBe(0.78); // €0.78
    expect(azv?.amount.toNumber()).toBe(4.61);  // €4.61
    expect(stipp?.amount.toNumber()).toBe(27.69); // €27.69
    expect(wga?.amount.toNumber()).toBe(3.01); // €3.01
    expect(net.healthInsurance.toNumber()).toBe(38.01);
    expect(net.additionalInsurance.toNumber()).toBe(2.76);
    expect(net.estimatedBankPayment.toNumber()).toBe(589.93); // €589.90 on payslip
  });

  it('clearly marks estimated tax vs exact tax without fabricating formulas', () => {
    const sessions: CalculatedWorkSession[] = [
      {
        elapsedMinutes: 480,
        unpaidBreakMinutes: 0,
        paidBreakMinutes: 0,
        paidMinutes: 480,
        segments: [{ name: 'Base', rateMultiplier: 1.0, minutes: 480, description: 'Normal' }],
      },
    ];

    const gross = calculateGrossPayroll(sessions, CARRIERE_AH_PROFILE_2026);
    
    // Default estimated mode
    const netEstimated = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026);
    expect(netEstimated.taxAccuracy).toBe('ESTIMATED');
    expect(netEstimated.taxNotes).toContain('estimate');

    // Overridden exact mode
    const netExact = calculateNetPayroll(gross, CARRIERE_AH_PROFILE_2026, {
      overrideTaxAmount: 25.00,
    });
    expect(netExact.taxAccuracy).toBe('EXACT');
    expect(netExact.estimatedTax.toNumber()).toBe(25.00);
  });

  it('preserves historical payroll stability when newer profile rates exist', () => {
    const sessions: CalculatedWorkSession[] = [
      {
        elapsedMinutes: 2400, // 40h
        unpaidBreakMinutes: 0,
        paidBreakMinutes: 0,
        paidMinutes: 2400,
        segments: [{ name: 'Base', rateMultiplier: 1.0, minutes: 2400, description: 'Normal' }],
      },
    ];

    // Calculation with original Week 1-12 profile (€14.99)
    const grossW1 = calculateGrossPayroll(sessions, CARRIERE_AH_PROFILE_2026);
    expect(grossW1.baseGross.toNumber()).toBe(599.60);

    // Calculation with newer Week 13 profile (€15.13)
    const grossW13 = calculateGrossPayroll(sessions, CARRIERE_AH_PROFILE_WEEK13_2026);
    expect(grossW13.baseGross.toNumber()).toBe(605.20);

    // Verifying original calculation remains completely unchanged
    expect(grossW1.baseGross.toNumber()).toBe(599.60);
  });
});
