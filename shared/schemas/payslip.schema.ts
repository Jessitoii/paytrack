import { z } from 'zod';

export const parsedPayrollPeriodSchema = z.object({
  year: z.number().int().min(2020).max(2050),
  weekNumber: z.number().int().min(1).max(53),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),   // YYYY-MM-DD
});

export const parsedEmployerSchema = z.object({
  employerName: z.string().optional(),
  agencyName: z.string().optional(),
  employeeNumber: z.string().optional(),
});

export const parsedHoursSchema = z.object({
  normalHours: z.number().min(0),
  trainingHours: z.number().min(0).default(0),
  overtimeHours: z.number().min(0).default(0),
  totalHours: z.number().min(0),
});

export const parsedEarningItemSchema = z.object({
  name: z.string(),
  code: z.string().optional(),
  hours: z.number().optional(),
  rate: z.number().optional(),
  amount: z.number(),
  category: z.enum(['BASE_SALARY', 'ADV', 'HOLIDAY_ALLOWANCE', 'HOLIDAY_DAYS', 'PREMIUM', 'TRAINING', 'OTHER']).default('OTHER'),
});

export const parsedDeductionItemSchema = z.object({
  name: z.string(),
  code: z.string().optional(), // PAWW, AZV, STIPP, WGA, LOONHEFFING, etc.
  baseAmount: z.number().optional(),
  ratePercentage: z.number().optional(),
  amount: z.number(),
  category: z.enum(['PAWW', 'AZV', 'PENSION', 'WGA', 'TAX', 'OTHER']).default('OTHER'),
});

export const parsedAdjustmentItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
  isTaxFree: z.boolean().default(false),
  category: z.enum(['ET_EXCHANGE', 'HEALTH_INSURANCE', 'ADDITIONAL_INSURANCE', 'OTHER']).default('OTHER'),
});

export const parsedTotalsSchema = z.object({
  totalGross: z.number(),
  loonSv: z.number().optional(),
  taxableWage: z.number().optional(),
  totalTax: z.number().optional(),
  totalNet: z.number(),
  bankPayment: z.number(),
});

export const parsedAccrualsSchema = z.object({
  holidayHoursAccrued: z.number().optional(),
  holidayHoursBalance: z.number().optional(),
  holidayMoneyBalance: z.number().optional(),
});

/**
 * Complete structured schema expected from AI payslip parsing.
 */
export const parsedPayslipSchema = z.object({
  payrollPeriod: parsedPayrollPeriodSchema,
  employer: parsedEmployerSchema.optional(),
  hours: parsedHoursSchema,
  earnings: z.array(parsedEarningItemSchema).default([]),
  deductions: z.array(parsedDeductionItemSchema).default([]),
  adjustments: z.array(parsedAdjustmentItemSchema).default([]),
  totals: parsedTotalsSchema,
  accruals: parsedAccrualsSchema.optional(),
  confidence: z.number().min(0).max(1).default(1.0),
  rawSummary: z.string().optional(),
});

export type ParsedPayslipData = z.infer<typeof parsedPayslipSchema>;

/**
 * User Review and Confirmation payload schema.
 */
export const confirmPayslipSchema = z.object({
  payrollPeriod: parsedPayrollPeriodSchema,
  hours: parsedHoursSchema,
  earnings: z.array(parsedEarningItemSchema),
  deductions: z.array(parsedDeductionItemSchema),
  adjustments: z.array(parsedAdjustmentItemSchema),
  totals: parsedTotalsSchema,
  accruals: parsedAccrualsSchema.optional(),
});

export type ConfirmPayslipPayload = z.infer<typeof confirmPayslipSchema>;
