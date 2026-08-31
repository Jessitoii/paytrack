import { Decimal, roundCurrency, toDecimal } from '../money/decimal.js';
import { formatMinutesToHoursAndMinutes } from '../time/rounding.js';
import type { CalculatedWorkSession } from '../types/time.js';
import type {
  PayrollProfile,
  GrossPayrollBreakdown,
  NetPayrollBreakdown,
  PremiumLineItem,
  DeductionLineItem,
} from '../types/payroll.js';

export interface CalculationOptions {
  etExchangeAmount?: number; // Weekly ET accommodation exchange amount if applicable
  overridePensionBase?: number; // Exact pension base if known from payslip or specific formula
  overrideTaxAmount?: number; // Exact tax if known from payslip
  taxEstimateRatePercentage?: number; // Custom tax rate for estimation
}

/**
 * Deterministic Gross Payroll Calculation Engine.
 */
export function calculateGrossPayroll(
  sessions: CalculatedWorkSession[],
  profile: PayrollProfile,
  options: CalculationOptions = {}
): GrossPayrollBreakdown {
  const totalPaidMinutes = sessions.reduce((acc, s) => acc + s.paidMinutes, 0);
  const paidHoursDecimal = toDecimal(totalPaidMinutes).dividedBy(60);
  const baseRate = toDecimal(profile.baseHourlyRate);

  // 1. Base Gross Earnings
  const baseGross = roundCurrency(paidHoursDecimal.times(baseRate));

  // 2. ADV Allowance
  let advAllowance = new Decimal(0);
  if (profile.advHourlyRate) {
    advAllowance = roundCurrency(paidHoursDecimal.times(toDecimal(profile.advHourlyRate)));
  } else if (profile.advPercentage) {
    advAllowance = roundCurrency(baseGross.times(toDecimal(profile.advPercentage).dividedBy(100)));
  }

  // 3. Premium Segments
  const premiumItems: PremiumLineItem[] = [];
  let totalPremiums = new Decimal(0);

  const segmentMap = new Map<number, { name: string; description: string; minutes: number }>();
  for (const s of sessions) {
    for (const seg of s.segments) {
      if (seg.rateMultiplier > 1.0) {
        const existing = segmentMap.get(seg.rateMultiplier);
        if (existing) {
          existing.minutes += seg.minutes;
        } else {
          segmentMap.set(seg.rateMultiplier, {
            name: seg.name,
            description: seg.description,
            minutes: seg.minutes,
          });
        }
      }
    }
  }

  for (const [rateMultiplier, data] of segmentMap.entries()) {
    const premiumMultiplier = rateMultiplier - 1.0;
    const hours = toDecimal(data.minutes).dividedBy(60);
    const amount = roundCurrency(hours.times(baseRate).times(toDecimal(premiumMultiplier)));

    premiumItems.push({
      name: data.name,
      description: data.description,
      rateMultiplier,
      premiumMultiplier,
      minutes: data.minutes,
      hoursFormatted: formatMinutesToHoursAndMinutes(data.minutes),
      hourlyRate: baseRate,
      amount,
    });

    totalPremiums = totalPremiums.plus(amount);
  }

  // 4. ET-Exchange Components
  const etExchangeAmount = toDecimal(options.etExchangeAmount ?? 0);
  const holidayDaysExchange = roundCurrency(etExchangeAmount); // ET accommodation exchange against holiday days
  const etExchangeDeduction = roundCurrency(etExchangeAmount);

  // 5. Holiday Allowance (Vakantiegeld): 8.00% of (baseGross + advAllowance + holidayDaysExchange + totalPremiums)
  const holidayBase = baseGross.plus(advAllowance).plus(holidayDaysExchange).plus(totalPremiums);
  const holidayAllowance = roundCurrency(
    holidayBase.times(toDecimal(profile.holidayAllowancePercentage).dividedBy(100))
  );

  // 6. Holiday Entitlement Accrual (Vakantiedagen reservation - 10.49777%)
  const holidayEntitlementAccrual = roundCurrency(
    baseGross.times(toDecimal(profile.holidayEntitlementPercentage).dividedBy(100))
  );

  // 7. Total Gross (Totaal bruto loon)
  // Base + ADV + Premiums + Vakantiegeld + Vakantiedagen(ET) - ET-uitruil
  const totalGross = baseGross
    .plus(advAllowance)
    .plus(totalPremiums)
    .plus(holidayAllowance)
    .plus(holidayDaysExchange)
    .minus(etExchangeDeduction);

  return {
    paidMinutes: totalPaidMinutes,
    paidHoursDecimal,
    paidHoursFormatted: formatMinutesToHoursAndMinutes(totalPaidMinutes),
    baseGross,
    advAllowance,
    holidayAllowance,
    holidayDaysExchange,
    holidayEntitlementAccrual,
    premiumItems,
    totalPremiums,
    etExchangeDeduction,
    totalGross: roundCurrency(totalGross),
  };
}

/**
 * Deterministic Net Payroll & Deductions Calculation Engine.
 */
export function calculateNetPayroll(
  gross: GrossPayrollBreakdown,
  profile: PayrollProfile,
  options: CalculationOptions = {}
): NetPayrollBreakdown {
  const deductions: DeductionLineItem[] = [];

  // 1. PAWW: 0.1000% of Total Gross
  const pawwBase = gross.totalGross;
  const pawwAmount = roundCurrency(pawwBase.times(toDecimal(profile.pawwRatePercentage).dividedBy(100)));
  deductions.push({
    name: 'PAWW bijdrage',
    code: 'PAWW',
    ratePercentage: profile.pawwRatePercentage,
    baseAmount: pawwBase,
    amount: pawwAmount,
    accuracy: 'EXACT',
  });

  // 2. Premie AZV: 0.7000% of Base Wage
  const azvBase = gross.baseGross;
  const azvAmount = roundCurrency(azvBase.times(toDecimal(profile.azvRatePercentage).dividedBy(100)));
  deductions.push({
    name: 'Premie AZV',
    code: 'AZV',
    ratePercentage: profile.azvRatePercentage,
    baseAmount: azvBase,
    amount: azvAmount,
    accuracy: 'EXACT',
  });

  // 3. StiPP Pensioen: 7.5000%
  const pensionBase = options.overridePensionBase !== undefined
    ? toDecimal(options.overridePensionBase)
    : gross.baseGross.times(0.56); // Estimated franchise approximation if base unknown

  const stippAmount = roundCurrency(pensionBase.times(toDecimal(profile.stippRatePercentage).dividedBy(100)));
  deductions.push({
    name: 'StiPP Pensioen',
    code: 'STIPP',
    ratePercentage: profile.stippRatePercentage,
    baseAmount: roundCurrency(pensionBase),
    amount: stippAmount,
    accuracy: options.overridePensionBase !== undefined ? 'EXACT' : 'ESTIMATED',
  });

  const totalPayrollDeductionsPreTax = pawwAmount.plus(azvAmount).plus(stippAmount);

  // 4. Loon SV (Taxable base: Total Gross - Employee SV deductions)
  const loonSv = roundCurrency(gross.totalGross.minus(totalPayrollDeductionsPreTax));

  // 5. Gediff. Premie Whk (WGA): 0.4050% of Loon SV
  const wgaAmount = roundCurrency(loonSv.times(toDecimal(profile.wgaRatePercentage).dividedBy(100)));
  deductions.push({
    name: 'Gediff. premie Whk (WGA)',
    code: 'WGA',
    ratePercentage: profile.wgaRatePercentage,
    baseAmount: loonSv,
    amount: wgaAmount,
    accuracy: 'EXACT',
  });

  const totalPayrollDeductions = totalPayrollDeductionsPreTax.plus(wgaAmount);

  // 6. Tax (Loonheffing) - Explicitly marked as ESTIMATED unless overridden
  let estimatedTax: Decimal;
  let taxAccuracy: 'EXACT' | 'ESTIMATED' = 'ESTIMATED';

  if (options.overrideTaxAmount !== undefined) {
    estimatedTax = roundCurrency(toDecimal(options.overrideTaxAmount));
    taxAccuracy = 'EXACT';
  } else {
    const taxRate = options.taxEstimateRatePercentage ?? profile.estimatedTaxRatePercentage ?? 18.0;
    estimatedTax = roundCurrency(loonSv.times(toDecimal(taxRate).dividedBy(100)));
  }

  // 7. Net Before Adjustments
  const netBeforeAdjustments = roundCurrency(loonSv.minus(wgaAmount).minus(estimatedTax));

  // 8. Net Adjustments
  const etExchangeReimbursement = roundCurrency(toDecimal(options.etExchangeAmount ?? 0));
  const healthInsurance = roundCurrency(toDecimal(profile.healthInsuranceWeekly));
  const additionalInsurance = roundCurrency(toDecimal(profile.additionalInsuranceWeekly));
  const totalNetAdjustments = etExchangeReimbursement.minus(healthInsurance).minus(additionalInsurance);

  // 9. Final Net and Bank Payment
  const estimatedNet = netBeforeAdjustments;
  const estimatedBankPayment = roundCurrency(netBeforeAdjustments.plus(totalNetAdjustments));

  return {
    gross,
    payrollDeductions: deductions,
    totalPayrollDeductions: roundCurrency(totalPayrollDeductions),
    loonSv,
    estimatedTax,
    taxAccuracy,
    taxNotes: taxAccuracy === 'ESTIMATED' ? 'Tax is an estimate based on configurable rate' : undefined,
    netBeforeAdjustments,
    etExchangeReimbursement,
    healthInsurance,
    additionalInsurance,
    totalNetAdjustments,
    estimatedNet,
    estimatedBankPayment,
  };
}
