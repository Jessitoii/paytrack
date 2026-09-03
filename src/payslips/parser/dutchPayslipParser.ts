/**
 * Deterministic Dutch Agency Payslip Parser.
 * Specialized for Dutch CAO / ABU agency payslips (e.g. Carrière, Albert Heijn, Randstad, Tempo-Team).
 * Extracts structured wage lines, allowances, tax, pension, and banking components.
 */

import { extractPdfText, PdfExtractionResult } from './pdfTextExtractor';

export interface ParsedPayslipComponent {
  code: string;
  name: string;
  category: 'EARNING' | 'DEDUCTION' | 'REIMBURSEMENT' | 'STATUTORY';
  amount: number;
  percentage?: number;
  hourlyRate?: number;
  hours?: number;
}

export interface ParsedPayslip {
  success: boolean;
  error?: string;
  missingFields?: string[];
  isScannedImage?: boolean;
  period: {
    weekNumber: number | null;
    year: number | null;
    startDate: string | null; // ISO YYYY-MM-DD
    endDate: string | null; // ISO YYYY-MM-DD
  };
  employee: {
    name?: string;
    employeeNumber?: string;
    birthDate?: string;
  };
  employer: {
    name?: string;
    cao?: string;
    workLocation?: string;
  };
  wageDetails: {
    totalGross: number | null;
    baseWage: number | null;
    totalHoursWorked: number | null;
    hourlyRate: number | null;
    advAllowance: number | null;
    holidayAllowance: number | null;
    holidayHoursAccrued?: number | null;
    taxableGross: number | null; // Loon voor loonbelasting / Loon SV
    totalTax: number | null; // Loonheffingen
    stippPension: number | null;
    socialSecurityDeductions: number | null; // PAWW + AZV + Whk
    healthInsuranceDeduction: number | null; // Z&Z + aanvullende
    housingDeductions: number | null; // ET-uitruil
    housingReimbursements: number | null; // Vergoeding ET-uitruil
    totalNet: number | null;
    bankPayout: number | null;
    bankIban?: string;
  };
  components: ParsedPayslipComponent[];
  rawText: string;
}

/**
 * Parses Dutch numbers: "1.234,56", "-29,12", "€ 453,23", "14,99" -> number.
 */
export function parseDutchCurrencyOrNumber(val: string | null | undefined): number | null {
  if (!val) return null;
  // Clean whitespace and currency signs
  const cleaned = val.replace(/[€\s]/g, '').trim();
  if (!cleaned) return null;

  // Check Dutch style with thousands dot: 1.234,56
  if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(cleaned)) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  }

  // Comma decimal: 556,54 or -0,56
  if (/^-?\d+,\d+$/.test(cleaned)) {
    const normalized = cleaned.replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? null : num;
  }

  // Standard dot decimal: 556.54 or 1234.56
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  return null;
}

/**
 * Converts "HH:MM" (e.g. "16:30", "43:55") or numeric hours string to decimal hours.
 */
export function parseHoursStringToDecimal(hoursStr: string): number | null {
  if (!hoursStr) return null;
  const match = /^(\d+):(\d{2})$/.exec(hoursStr.trim());
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return Number((hours + minutes / 60).toFixed(4));
  }
  const direct = parseDutchCurrencyOrNumber(hoursStr);
  return direct !== null && !isNaN(direct) ? direct : null;
}

/**
 * Converts Dutch date string "DD-MM-YYYY" to ISO "YYYY-MM-DD".
 */
export function parseDutchDateToIso(dStr: string): string | null {
  if (!dStr) return null;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(dStr.trim());
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/**
 * Deterministically parses extracted PDF text result into structured payslip data.
 */
export function parseDutchPayslipText(extraction: PdfExtractionResult): ParsedPayslip {
  const missingFields: string[] = [];

  if (!extraction.success) {
    return {
      success: false,
      isScannedImage: extraction.isScannedImage,
      error: extraction.error || 'Failed to extract text from payslip PDF.',
      missingFields: ['totalGross', 'totalNet', 'bankPayment'],
      period: { weekNumber: null, year: null, startDate: null, endDate: null },
      employee: {},
      employer: {},
      wageDetails: {
        totalGross: null,
        baseWage: null,
        totalHoursWorked: null,
        hourlyRate: null,
        advAllowance: null,
        holidayAllowance: null,
        taxableGross: null,
        totalTax: null,
        stippPension: null,
        socialSecurityDeductions: null,
        healthInsuranceDeduction: null,
        housingDeductions: null,
        housingReimbursements: null,
        totalNet: null,
        bankPayout: null,
      },
      components: [],
      rawText: extraction.rawText,
    };
  }

  const rawText = extraction.rawText;
  const lines = extraction.lines;

  // 1. Period & Year
  // Pattern: "Tijdvak: Week 33 (2026)" or "Tijdvak: Week 34 (2026)"
  let weekNumber: number | null = null;
  let year: number | null = null;
  const tijdvakMatch = /Tijdvak:\s*Week\s*(\d+)\s*\((\d{4})\)/i.exec(rawText);
  if (tijdvakMatch) {
    weekNumber = parseInt(tijdvakMatch[1], 10);
    year = parseInt(tijdvakMatch[2], 10);
  }

  // Dates: "Periode: 10-08-2026 t/m 16-08-2026"
  let startDate: string | null = null;
  let endDate: string | null = null;
  const periodMatch = /Periode:\s*(\d{2}-\d{2}-\d{4})\s*t\/m\s*(\d{2}-\d{2}-\d{4})/i.exec(rawText);
  if (periodMatch) {
    startDate = parseDutchDateToIso(periodMatch[1]);
    endDate = parseDutchDateToIso(periodMatch[2]);
  }

  // 2. Employee & Employer Details
  let employeeName: string | undefined;
  let employeeNumber: string | undefined;
  let employerName: string | undefined;
  let cao: string | undefined;

  const empNumMatch = /Personeelsnummer:\s*(\d+)/i.exec(rawText);
  if (empNumMatch) employeeNumber = empNumMatch[1];

  const caoMatch = /Cao:\s*([^\r\n\)]+)/i.exec(rawText);
  if (caoMatch) cao = caoMatch[1].trim();

  // Employee name: "De heer A. Ozer" or "Mevrouw ..."
  const nameMatch = /(?:De heer|Mevrouw)\s+([A-Z0-9\.\s]+)/i.exec(rawText);
  if (nameMatch) {
    employeeName = nameMatch[0].trim();
  }

  if (rawText.includes('Carriere Personeelsdiensten') || rawText.includes('Carrière Personeelsdiensten')) {
    employerName = 'Carrière Personeelsdiensten B.V.';
  }

  // 3. Hourly Rate & Minimumuurloon
  let hourlyRate: number | null = null;
  const minWageMatch = /Minimumuurloon:\s*€?\s*([0-9\.,]+)/i.exec(rawText);
  if (minWageMatch) {
    hourlyRate = parseDutchCurrencyOrNumber(minWageMatch[1]);
  }

  // 4. Base Normal Hours Wage
  // Example: "Loon normale uren 16:30 14,99 247,33" or "Loon normale uren 43:55 14,99 658,31"
  let baseHours = 0;
  let baseWage: number | null = null;
  const normalHoursMatch = /Loon normale uren\s+(\d+:\d{2})\s+([0-9\.,]+)\s+([0-9\.,]+)/i.exec(rawText);
  if (normalHoursMatch) {
    baseHours = parseHoursStringToDecimal(normalHoursMatch[1]) || 0;
    if (hourlyRate === null) {
      hourlyRate = parseDutchCurrencyOrNumber(normalHoursMatch[2]);
    }
    baseWage = parseDutchCurrencyOrNumber(normalHoursMatch[3]);
  }

  // Learnhours (Leeruren)
  let learnHours = 0;
  let learnWage = 0;
  const learnMatch = /Leeruren\s+(\d+:\d{2})\s+([0-9\.,]+)\s+([0-9\.,]+)/i.exec(rawText);
  if (learnMatch) {
    learnHours = parseHoursStringToDecimal(learnMatch[1]) || 0;
    learnWage = parseDutchCurrencyOrNumber(learnMatch[3]) || 0;
  }

  const totalHoursWorked = Number((baseHours + learnHours).toFixed(2));

  // 5. ADV Allowance (Belaste ADV-toeslag Albert Heijn)
  let advAllowance: number | null = null;
  let advRate: number | null = null;
  const advMatch = /Belaste ADV-toeslag[^\r\n]*?\s+(\d+:\d{2})\s+([0-9\.,]+)\s+([0-9\.,]+)/i.exec(rawText);
  if (advMatch) {
    advRate = parseDutchCurrencyOrNumber(advMatch[2]);
    advAllowance = parseDutchCurrencyOrNumber(advMatch[3]);
  } else {
    // Fallback: search in line-by-line components
    const advLineMatch = /Belaste ADV-toeslag[^\r\n]*?[^0-9\-]*([0-9\.,]+)/i.exec(rawText);
    if (advLineMatch) {
      advAllowance = parseDutchCurrencyOrNumber(advLineMatch[1]);
    }
  }

  // 6. Holiday Allowance (Vakantiegeld)
  let holidayAllowance: number | null = null;
  const holidayLine = lines.find((l) => /^Vakantiegeld\b/i.test(l.trim()));
  if (holidayLine) {
    const numbers = holidayLine.match(/-?[0-9]+(?:\.[0-9]{3})*,[0-9]{2}/g);
    if (numbers && numbers.length > 0) {
      holidayAllowance = parseDutchCurrencyOrNumber(numbers[numbers.length - 1]);
    }
  }

  // 7. Holiday Days Entitlement (Vakantiedagen)
  let holidayDaysExchange: number | null = null;
  const holidayDaysLine = lines.find((l) => /^Vakantiedagen\b/i.test(l.trim()));
  if (holidayDaysLine) {
    const numbers = holidayDaysLine.match(/-?[0-9]+(?:\.[0-9]{3})*,[0-9]{2}/g);
    if (numbers && numbers.length > 0) {
      holidayDaysExchange = parseDutchCurrencyOrNumber(numbers[numbers.length - 1]);
    }
  }

  // Accrued Holiday Hours (Opbouw vakantiedagen in uren)
  let holidayHoursAccrued: number | null = null;
  const holidayAccrualMatch = /Opbouw vakantiedagen[^\r\n]*?\s+(\d+:\d{2})/i.exec(rawText);
  if (holidayAccrualMatch) {
    holidayHoursAccrued = parseHoursStringToDecimal(holidayAccrualMatch[1]);
  }

  // 8. Total Gross Wage (Totaal bruto loon)
  let totalGross: number | null = null;
  const grossLine = lines.find((l) => /Totaal bruto loon/i.test(l));
  if (grossLine) {
    const numbers = grossLine.match(/-?[0-9]+(?:\.[0-9]{3})*,[0-9]{2}/g) || grossLine.match(/[0-9\.,]+/g);
    if (numbers && numbers.length > 0) {
      totalGross = parseDutchCurrencyOrNumber(numbers[numbers.length - 1]);
    }
  }
  if (totalGross === null) {
    missingFields.push('totalGross');
  }

  // 9. Taxable Gross (Loon voor loonbelasting en premies)
  let taxableGross: number | null = null;
  const taxableLine = lines.find((l) => /Loon voor loonbelasting/i.test(l));
  if (taxableLine) {
    const numbers = taxableLine.match(/-?[0-9]+(?:\.[0-9]{3})*,[0-9]{2}/g) || taxableLine.match(/[0-9\.,]+/g);
    if (numbers && numbers.length > 0) {
      taxableGross = parseDutchCurrencyOrNumber(numbers[numbers.length - 1]);
    }
  }

  // 10. Loonheffingen / Wage Tax
  let wageTaxStandard = 0;
  let wageTaxSpecial = 0;

  const taxStandardLine = lines.find((l) => /Loonheffingen\s*\(Week wit\)/i.test(l));
  if (taxStandardLine) {
    const negs = taxStandardLine.match(/-[0-9]+(?:\.[0-9]{3})*,[0-9]{2}/g);
    if (negs && negs.length > 0) {
      const val = parseDutchCurrencyOrNumber(negs[0]);
      if (val !== null) wageTaxStandard = Math.abs(val);
    }
  }

  const taxSpecialLine = lines.find((l) => /Loonheffingen\s*\(bijz\.\s*beloningen/i.test(l));
  if (taxSpecialLine) {
    const negs = taxSpecialLine.match(/-[0-9]+(?:\.[0-9]{3})*,[0-9]{2}/g);
    if (negs && negs.length > 0) {
      const val = parseDutchCurrencyOrNumber(negs[0]);
      if (val !== null) wageTaxSpecial = Math.abs(val);
    }
  }

  const totalTax = wageTaxStandard + wageTaxSpecial > 0 ? Number((wageTaxStandard + wageTaxSpecial).toFixed(2)) : null;

  // 11. StiPP Pension Deduction (7.5%)
  let stippPension: number | null = null;
  const stippLine = lines.find((l) => /StiPP Pensioen/i.test(l) && /7,5000%|7\.5%/i.test(l));
  if (stippLine) {
    const numbers = stippLine.match(/-?[0-9]+(?:\.[0-9]{3})*,[0-9]{2}/g);
    if (numbers && numbers.length > 0) {
      const p = parseDutchCurrencyOrNumber(numbers[numbers.length - 1]);
      if (p !== null) stippPension = Math.abs(p);
    }
  }

  // 12. Social Security Deductions (PAWW, AZV, Whk)
  let pawwDeduction = 0;
  const pawwMatch = /PAWW bijdrage:[^\r\n]*?([0-9\.,\-]+)\s*$/m.exec(rawText);
  if (pawwMatch) {
    const v = parseDutchCurrencyOrNumber(pawwMatch[1]);
    if (v !== null) pawwDeduction = Math.abs(v);
  }

  let azvDeduction = 0;
  const azvMatch = /Premie AZV[^\r\n]*?([0-9\.,\-]+)\s*$/m.exec(rawText);
  if (azvMatch) {
    const v = parseDutchCurrencyOrNumber(azvMatch[1]);
    if (v !== null) azvDeduction = Math.abs(v);
  }

  let whkDeduction = 0;
  const whkMatch = /Gediff\.\s*premie Whk[^\r\n]*?([0-9\.,\-]+)\s*$/m.exec(rawText);
  if (whkMatch) {
    const v = parseDutchCurrencyOrNumber(whkMatch[1]);
    if (v !== null) whkDeduction = Math.abs(v);
  }

  const socialSecurityDeductions = Number((pawwDeduction + azvDeduction + whkDeduction).toFixed(2));

  // 13. Health Insurance Deductions (Z&Z + aanvullend)
  let zzInsurance = 0;
  const zzMatch = /Inhouding verzekeringen Z&Z[^\r\n]*?([0-9\.,\-]+)\s*$/m.exec(rawText);
  if (zzMatch) {
    const v = parseDutchCurrencyOrNumber(zzMatch[1]);
    if (v !== null) zzInsurance = Math.abs(v);
  }

  let extraInsurance = 0;
  const extraInsMatch = /Inhoudinge? aanvullende verzekeringen?[^\r\n]*?([0-9\.,\-]+)\s*$/m.exec(rawText);
  if (extraInsMatch) {
    const v = parseDutchCurrencyOrNumber(extraInsMatch[1]);
    if (v !== null) extraInsurance = Math.abs(v);
  }

  const healthInsuranceDeduction = Number((zzInsurance + extraInsurance).toFixed(2));

  // 14. ET-uitruil Housing Exchange Deductions and Reimbursements
  let housingDeductions = 0;
  const etDeductMatch = /ET-uitruil huisvesting\s+(?:7\s+\*\s+)?([0-9\.,\-]+)/i.exec(rawText);
  if (etDeductMatch) {
    const v = parseDutchCurrencyOrNumber(etDeductMatch[1]);
    if (v !== null) housingDeductions = Math.abs(v);
  }

  let housingReimbursements = 0;
  const etReimbMatch = /Vergoeding ET-uitruil huisvesting\s+(?:7\s+)?([0-9\.,]+)/i.exec(rawText);
  if (etReimbMatch) {
    const v = parseDutchCurrencyOrNumber(etReimbMatch[1]);
    if (v !== null) housingReimbursements = Math.abs(v);
  }

  // 15. Net Wage (Netto loon)
  let totalNet: number | null = null;
  const netMatch = /Netto loon\s+([0-9\.,]+)/i.exec(rawText);
  if (netMatch) {
    totalNet = parseDutchCurrencyOrNumber(netMatch[1]);
  } else {
    missingFields.push('totalNet');
  }

  // 16. Bank Payout (Netto te betalen / Te betalen per Bank)
  let bankPayout: number | null = null;
  let bankIban: string | undefined;

  const bankMatch = /Netto te betalen\s+([0-9\.,]+)/i.exec(rawText) ||
    /Te betalen\s+€?\s*([0-9\.,]+)\s+per Bank/i.exec(rawText);
  if (bankMatch) {
    bankPayout = parseDutchCurrencyOrNumber(bankMatch[1]);
  } else {
    missingFields.push('bankPayment');
  }

  const ibanMatch = /IBAN\s*\)?\s*:\s*([A-Z0-9\s]+)/i.exec(rawText);
  if (ibanMatch) {
    bankIban = ibanMatch[1].trim();
  }

  // 17. Structured Components Array
  const components: ParsedPayslipComponent[] = [];

  if (baseWage !== null && baseWage > 0) {
    components.push({
      code: '1000',
      name: 'Loon normale uren',
      category: 'EARNING',
      amount: baseWage,
      hours: baseHours,
      hourlyRate: hourlyRate ?? undefined,
    });
  }

  if (learnWage > 0) {
    components.push({
      code: '1010',
      name: 'Leeruren',
      category: 'EARNING',
      amount: learnWage,
      hours: learnHours,
      hourlyRate: hourlyRate ?? undefined,
    });
  }

  if (advAllowance !== null && advAllowance > 0) {
    components.push({
      code: '1050',
      name: 'Belaste ADV-toeslag Albert Heijn',
      category: 'EARNING',
      amount: advAllowance,
      hourlyRate: advRate ?? undefined,
    });
  }

  if (holidayAllowance !== null && holidayAllowance > 0) {
    components.push({
      code: '1080',
      name: 'Vakantiegeld (8.00%)',
      category: 'EARNING',
      amount: holidayAllowance,
      percentage: 8.0,
    });
  }

  if (holidayDaysExchange !== null && holidayDaysExchange > 0) {
    components.push({
      code: '1085',
      name: 'Vakantiedagen opbouw/vergoeding',
      category: 'EARNING',
      amount: holidayDaysExchange,
    });
  }

  if (housingDeductions > 0) {
    components.push({
      code: '2010',
      name: 'ET-uitruil huisvesting (Inhouding)',
      category: 'DEDUCTION',
      amount: housingDeductions,
    });
  }

  if (stippPension !== null && stippPension > 0) {
    components.push({
      code: '3000',
      name: 'StiPP Pensioen (7.50%)',
      category: 'DEDUCTION',
      amount: stippPension,
      percentage: 7.5,
    });
  }

  if (pawwDeduction > 0) {
    components.push({
      code: '3010',
      name: 'PAWW bijdrage (0.10%)',
      category: 'DEDUCTION',
      amount: pawwDeduction,
      percentage: 0.1,
    });
  }

  if (azvDeduction > 0) {
    components.push({
      code: '3020',
      name: 'Premie AZV (0.70%)',
      category: 'DEDUCTION',
      amount: azvDeduction,
      percentage: 0.7,
    });
  }

  if (whkDeduction > 0) {
    components.push({
      code: '3030',
      name: 'Gediff. premie Whk (0.405%)',
      category: 'DEDUCTION',
      amount: whkDeduction,
      percentage: 0.405,
    });
  }

  if (wageTaxStandard > 0) {
    components.push({
      code: '3040',
      name: 'Loonheffingen (Week wit)',
      category: 'DEDUCTION',
      amount: wageTaxStandard,
    });
  }

  if (wageTaxSpecial > 0) {
    components.push({
      code: '3045',
      name: 'Loonheffingen (bijzondere beloningen)',
      category: 'DEDUCTION',
      amount: wageTaxSpecial,
    });
  }

  if (housingReimbursements > 0) {
    components.push({
      code: '4010',
      name: 'Vergoeding ET-uitruil huisvesting',
      category: 'REIMBURSEMENT',
      amount: housingReimbursements,
    });
  }

  if (zzInsurance > 0) {
    components.push({
      code: '4050',
      name: 'Inhouding verzekeringen Z&Z',
      category: 'DEDUCTION',
      amount: zzInsurance,
    });
  }

  if (extraInsurance > 0) {
    components.push({
      code: '4060',
      name: 'Inhouding aanvullende verzekeringen',
      category: 'DEDUCTION',
      amount: extraInsurance,
    });
  }

  const isSuccess = missingFields.length === 0;

  return {
    success: isSuccess,
    isScannedImage: extraction.isScannedImage,
    error: isSuccess ? undefined : `Could not deterministically find required fields: ${missingFields.join(', ')}.`,
    missingFields: isSuccess ? undefined : missingFields,
    period: {
      weekNumber,
      year,
      startDate,
      endDate,
    },
    employee: {
      name: employeeName,
      employeeNumber,
    },
    employer: {
      name: employerName,
      cao,
    },
    wageDetails: {
      totalGross,
      baseWage,
      totalHoursWorked: totalHoursWorked > 0 ? totalHoursWorked : null,
      hourlyRate,
      advAllowance,
      holidayAllowance,
      holidayHoursAccrued,
      taxableGross,
      totalTax,
      stippPension,
      socialSecurityDeductions: socialSecurityDeductions > 0 ? socialSecurityDeductions : null,
      healthInsuranceDeduction: healthInsuranceDeduction > 0 ? healthInsuranceDeduction : null,
      housingDeductions: housingDeductions > 0 ? housingDeductions : null,
      housingReimbursements: housingReimbursements > 0 ? housingReimbursements : null,
      totalNet,
      bankPayout,
      bankIban,
    },
    components,
    rawText,
  };
}

export function parsePayslipDocument(input: Uint8Array | ArrayBuffer | string): ParsedPayslip {
  const extraction = extractPdfText(input);
  const parsed = parseDutchPayslipText(extraction);
  console.log(
    `[PAYSLIP] Parser result: success=${parsed.success}, week=${parsed.period.weekNumber}, year=${parsed.period.year}, gross=${parsed.wageDetails.totalGross}, net=${parsed.wageDetails.totalNet}, payout=${parsed.wageDetails.bankPayout}`
  );
  return parsed;
}
