import { calculateGrossPayroll, calculateNetPayroll } from '../../shared/payroll/engine';
import { CARRIERE_AH_PROFILE_2026 } from '../../shared/payroll/profiles';
import type { PayrollProfile } from '../../shared/types/payroll';
import type { CalculatedWorkSession } from '../../shared/types/time';
import { Decimal } from '../../shared/money/decimal';

export interface DaySimulationInput {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  hours: number;
  paidBreakMinutes?: number;
  unpaidBreakMinutes?: number;
}

export interface SimulationParameters {
  totalHours?: number;
  days?: DaySimulationInput[];
  paidBreakMinutes?: number;
  unpaidBreakMinutes?: number;
  profile?: PayrollProfile;
  weeklyFixedExpensesEstimate?: number;
}

export interface SimulationResult {
  paidHours: number;
  paidMinutes: number;
  hourlyRate: number;
  estimatedGross: number;
  baseGross: number;
  advAllowance: number;
  holidayAllowance: number;
  stippPension: number;
  totalDeductions: number;
  estimatedNet: number;
  estimatedBankPayout: number;
  weeklyFixedExpenses: number;
  projectedWeeklySavings: number;
  goalImpact: {
    weeklySavings: number;
    projectedMonthlySavings: number;
  };
}

/**
 * In-Memory Weekly Payroll & Savings Simulator.
 * Pure functional simulation that DOES NOT write to SQLite.
 */
export function simulateWeek(params: SimulationParameters): SimulationResult {
  const profile = params.profile || CARRIERE_AH_PROFILE_2026;

  let totalMinutes = 0;

  if (params.days && params.days.length > 0) {
    for (const d of params.days) {
      const dayMinutes = Math.round(d.hours * 60);
      const paidBreak = d.paidBreakMinutes ?? 0;
      const unpaidBreak = d.unpaidBreakMinutes ?? 0;
      totalMinutes += Math.max(0, dayMinutes - unpaidBreak + paidBreak);
    }
  } else {
    const hours = params.totalHours ?? 40;
    const paidBreak = params.paidBreakMinutes ?? 0;
    const unpaidBreak = params.unpaidBreakMinutes ?? 0;
    totalMinutes = Math.max(0, Math.round(hours * 60) - unpaidBreak + paidBreak);
  }

  const dummySession: CalculatedWorkSession = {
    elapsedMinutes: totalMinutes,
    unpaidBreakMinutes: params.unpaidBreakMinutes ?? 0,
    paidBreakMinutes: params.paidBreakMinutes ?? 0,
    paidMinutes: totalMinutes,
    segments: [
      {
        rateMultiplier: 1.0,
        minutes: totalMinutes,
        name: 'Normal Hours',
        description: 'Standard 100% Rate',
      },
    ],
  };

  const gross = calculateGrossPayroll([dummySession], profile);
  const net = calculateNetPayroll(gross, profile);

  const estimatedGross = Number(gross.totalGross.toFixed(2));
  const baseGross = Number(gross.baseGross.toFixed(2));
  const advAllowance = Number(gross.advAllowance.toFixed(2));
  const holidayAllowance = Number(gross.holidayAllowance.toFixed(2));
  const estimatedBankPayout = Number(net.estimatedBankPayment.toFixed(2));
  const estimatedNet = Number(net.estimatedNet.toFixed(2));
  const totalDeductionsDecimal = net.totalPayrollDeductions.plus(net.estimatedTax).plus(net.totalNetAdjustments);
  const totalDeductions = Number(totalDeductionsDecimal.toFixed(2));
  const stippItem = net.payrollDeductions.find((d) => d.code === 'STIPP');
  const stippPension = stippItem ? Number(stippItem.amount.toFixed(2)) : 0;

  const weeklyFixedExpenses = params.weeklyFixedExpensesEstimate ?? 150.0;
  const projectedWeeklySavings = Number((estimatedBankPayout - weeklyFixedExpenses).toFixed(2));
  const projectedMonthlySavings = Number((projectedWeeklySavings * 4.333).toFixed(2));

  return {
    paidHours: Number((totalMinutes / 60).toFixed(2)),
    paidMinutes: totalMinutes,
    hourlyRate: profile.baseHourlyRate,
    estimatedGross,
    baseGross,
    advAllowance,
    holidayAllowance,
    stippPension,
    totalDeductions,
    estimatedNet,
    estimatedBankPayout,
    weeklyFixedExpenses,
    projectedWeeklySavings,
    goalImpact: {
      weeklySavings: projectedWeeklySavings,
      projectedMonthlySavings,
    },
  };
}
