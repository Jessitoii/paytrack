import type { ParsedPayslipData } from '../../../../shared/schemas/payslip.schema.js';

export interface IAiParserProvider {
  name: string;
  parsePayslipText(extractedText: string): Promise<ParsedPayslipData>;
}
