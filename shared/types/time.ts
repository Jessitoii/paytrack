export interface TimeBreak {
  id?: string;
  type: 'paid_15' | 'unpaid_30' | 'paid_15_extra' | 'custom';
  durationMinutes: number;
  isPaid: boolean;
  name?: string;
}

export interface WorkTimeInterval {
  start: Date;
  finish: Date;
  roundedFinish: Date;
}

export interface PremiumSegment {
  name: string;
  rateMultiplier: number; // e.g. 1.0 for normal, 1.50 for +50%, 1.75 for +75%, 2.0 for +100%
  minutes: number;
  description: string;
}

export interface CalculatedWorkSession {
  elapsedMinutes: number;
  unpaidBreakMinutes: number;
  paidBreakMinutes: number;
  paidMinutes: number;
  segments: PremiumSegment[];
}
