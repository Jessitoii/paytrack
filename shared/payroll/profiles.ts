import type { PayrollProfile } from '../types/payroll.js';

/**
 * Authoritative Initial Profile for Carrière uitzendbureau / Albert Heijn.
 * Configured from verified docs and reference payslips.
 */
export const CARRIERE_AH_PROFILE_2026: PayrollProfile = {
  id: 'carriere_ah_2026',
  name: 'Carrière - Albert Heijn (2026)',
  employer: 'Albert Heijn B.V. Bleiswijk',
  agency: 'Carrière Personeelsdiensten B.V.',
  effectiveFromWeek: 1,
  effectiveUntilWeek: 12,
  effectiveFromDate: '2026-01-01',
  
  // Wages & Allowances
  baseHourlyRate: 14.99,
  advHourlyRate: 1.35,
  advPercentage: 9.005,
  holidayAllowancePercentage: 8.00,
  holidayEntitlementPercentage: 10.49777,

  // Deductions
  pawwRatePercentage: 0.1000,
  azvRatePercentage: 0.7000,
  stippRatePercentage: 7.5000,
  wgaRatePercentage: 0.4050,

  // Fixed Net Deductions
  healthInsuranceWeekly: 38.01,
  additionalInsuranceWeekly: 2.76,

  // Tax Estimation Mode (clearly marked as estimate)
  taxEstimationMode: 'CONFIGURABLE_RATE',
  estimatedTaxRatePercentage: 18.0, // Default configurable estimate rate
};

/**
 * Expected Rate Change Profile starting from Week 13.
 */
export const CARRIERE_AH_PROFILE_WEEK13_2026: PayrollProfile = {
  ...CARRIERE_AH_PROFILE_2026,
  id: 'carriere_ah_2026_w13',
  effectiveFromWeek: 13,
  effectiveUntilWeek: 52,
  effectiveFromDate: '2026-03-23',
  baseHourlyRate: 15.13, // Example base if €16.49 total including ADV, or configurable
};
