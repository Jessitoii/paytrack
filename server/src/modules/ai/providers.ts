import type { IAiParserProvider } from './types.js';
import { PAYSLIP_SYSTEM_PROMPT } from './prompts.js';
import { parsedPayslipSchema, type ParsedPayslipData } from '../../../../shared/schemas/payslip.schema.js';

export class GroqProvider implements IAiParserProvider {
  name = 'GroqProvider';

  constructor(private apiKey: string, private model: string = 'llama-3.3-70b-versatile') {}

  async parsePayslipText(extractedText: string): Promise<ParsedPayslipData> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: PAYSLIP_SYSTEM_PROMPT },
          { role: 'user', content: `Please parse this Dutch payslip text:\n\n${extractedText}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API error (${response.status}): ${err}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Groq returned empty response');
    }

    const parsedJson = JSON.parse(content);
    return parsedPayslipSchema.parse(parsedJson);
  }
}

export class CerebrasProvider implements IAiParserProvider {
  name = 'CerebrasProvider';

  constructor(private apiKey: string, private model: string = 'llama3.1-70b') {}

  async parsePayslipText(extractedText: string): Promise<ParsedPayslipData> {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: PAYSLIP_SYSTEM_PROMPT },
          { role: 'user', content: `Please parse this Dutch payslip text:\n\n${extractedText}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Cerebras API error (${response.status}): ${err}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Cerebras returned empty response');
    }

    const parsedJson = JSON.parse(content);
    return parsedPayslipSchema.parse(parsedJson);
  }
}
