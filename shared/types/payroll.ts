import type { Decimal } from '../money/decimal';

export type CalculationAccuracyType = 'EXACT' | 'ESTIMATED' | 'ACTUAL_PAYSLIP';

export interface DeductionRule {
  name: string;
  code: string;
  ratePercentage: number; // e.g. 0.10 for 0.10%
  baseType: 'TOTAL_GROSS' | 'BASE_WAGE' | 'LOON_SV' | 'PENSION_BASE';
  isEstimated?: boolean;
}

export interface PayrollProfile {
  id: string;
  name: string;
  employer: string;
  agency?: string;
  effectiveFromWeek: number;
  effectiveUntilWeek?: number;
  effectiveFromDate: string; // YYYY-MM-DD
  
  // Wages & Allowances
  baseHourlyRate: number; // e.g. 14.99 (or 16.49 in week 13)
  advHourlyRate?: number; // e.g. 1.35
  advPercentage?: number; // e.g. 9.005
  holidayAllowancePercentage: number; // e.g. 8.00
  holidayEntitlementPercentage: number; // e.g. 10.49777

  // Deduction rules
  pawwRatePercentage: number; // e.g. 0.1000
  azvRatePercentage: number;  // e.g. 0.7000
  stippRatePercentage: number; // e.g. 7.5000
  stippHourlyFranchise?: number; // Hourly franchise for pension base calculation if applicable
  wgaRatePercentage: number;  // e.g. 0.4050

  // Fixed Net Deductions
  healthInsuranceWeekly: number; // e.g. 38.01 (Z&Z)
  additionalInsuranceWeekly: number; // e.g. 2.76

  // Tax Estimation Settings
  estimatedTaxRatePercentage?: number; // Optional fallback tax estimate rate
  taxEstimationMode: 'CONFIGURABLE_RATE' | 'EXEMPT' | 'CUSTOM_ESTIMATE';
}

export interface PremiumLineItem {
  name: string;
  description: string;
  rateMultiplier: number;
  premiumMultiplier: number; // e.g. 0.50 for +50%
  minutes: number;
  hoursFormatted: string;
  hourlyRate: Decimal;
  amount: Decimal;
}

export interface DeductionLineItem {
  name: string;
  code: string;
  ratePercentage: number;
  baseAmount: Decimal;
  amount: Decimal;
  accuracy: CalculationAccuracyType;
}

export interface GrossPayrollBreakdown {
  paidMinutes: number;
  paidHoursDecimal: Decimal;
  paidHoursFormatted: string;
  baseGross: Decimal;
  advAllowance: Decimal;
  holidayAllowance: Decimal; // Vakantiegeld (8% paid out weekly)
  holidayDaysExchange: Decimal; // Vakantiedagen gross component used in ET exchange
  holidayEntitlementAccrual: Decimal; // Total 10.49777% holiday entitlement reservation
  premiumItems: PremiumLineItem[];
  totalPremiums: Decimal;
  etExchangeDeduction: Decimal;
  totalGross: Decimal;
}

export interface NetPayrollBreakdown {
  gross: GrossPayrollBreakdown;
  payrollDeductions: DeductionLineItem[];
  totalPayrollDeductions: Decimal;
  loonSv: Decimal; // Taxable Wage Base (Loon voor loonbelasting en premies)
  
  // Tax
  estimatedTax: Decimal;
  taxAccuracy: CalculationAccuracyType;
  taxNotes?: string;

  // Net Adjustments
  netBeforeAdjustments: Decimal;
  etExchangeReimbursement: Decimal;
  healthInsurance: Decimal;
  additionalInsurance: Decimal;
  totalNetAdjustments: Decimal;

  // Final Net
  estimatedNet: Decimal;
  estimatedBankPayment: Decimal;
}
