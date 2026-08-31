import { describe, it, expect } from 'vitest';
import {
  roundFinishDateTo5Minutes,
  roundFinishTimeStringTo5Minutes,
  formatMinutesToHoursAndMinutes,
  parseTimeToMinutes,
} from '../../shared/time/rounding.js';
import {
  calculateElapsedMinutes,
  calculateBreakTotals,
  segmentWorkSession,
  calculateWorkSession,
  DEFAULT_PREMIUM_CONFIG,
} from '../../shared/time/periods.js';
import type { TimeBreak } from '../../shared/types/time.js';

describe('Time Rounding Rules (Zebra logout 5-minute upward rounding)', () => {
  it('correctly rounds finish time strings upward to next 5 minutes per specification', () => {
    // Exact spec examples:
    // 23:21 -> 23:25
    // 23:22 -> 23:25
    // 23:23 -> 23:25
    // 23:24 -> 23:25
    // 23:25 -> 23:25
    // 23:26 -> 23:30
    // 23:29 -> 23:30
    // 23:30 -> 23:30
    expect(roundFinishTimeStringTo5Minutes('23:21')).toBe('23:25');
    expect(roundFinishTimeStringTo5Minutes('23:22')).toBe('23:25');
    expect(roundFinishTimeStringTo5Minutes('23:23')).toBe('23:25');
    expect(roundFinishTimeStringTo5Minutes('23:24')).toBe('23:25');
    expect(roundFinishTimeStringTo5Minutes('23:25')).toBe('23:25');
    expect(roundFinishTimeStringTo5Minutes('23:26')).toBe('23:30');
    expect(roundFinishTimeStringTo5Minutes('23:29')).toBe('23:30');
    expect(roundFinishTimeStringTo5Minutes('23:30')).toBe('23:30');
  });

  it('correctly rounds Date objects upward to next 5 minutes', () => {
    const d1 = new Date('2026-08-17T23:21:15');
    const rounded1 = roundFinishDateTo5Minutes(d1);
    expect(rounded1.getMinutes()).toBe(25);
    expect(rounded1.getSeconds()).toBe(0);

    const dExact = new Date('2026-08-17T23:25:00.000');
    const roundedExact = roundFinishDateTo5Minutes(dExact);
    expect(roundedExact.getMinutes()).toBe(25);
    expect(roundedExact.getSeconds()).toBe(0);

    const dPastExact = new Date('2026-08-17T23:25:01');
    const roundedPast = roundFinishDateTo5Minutes(dPastExact);
    expect(roundedPast.getMinutes()).toBe(30);
  });

  it('formats minutes to human readable "Xh Ym"', () => {
    expect(formatMinutesToHoursAndMinutes(510)).toBe('8h 30m');
    expect(formatMinutesToHoursAndMinutes(2635)).toBe('43h 55m');
    expect(formatMinutesToHoursAndMinutes(1890)).toBe('31h 30m');
  });

  it('parses time strings to total day minutes', () => {
    expect(parseTimeToMinutes('06:00')).toBe(360);
    expect(parseTimeToMinutes('14:30')).toBe(870);
    expect(parseTimeToMinutes('23:00')).toBe(1380);
  });
});

describe('Elapsed Time and Midnight Crossing', () => {
  it('calculates duration for standard daytime shift', () => {
    const start = new Date('2026-08-17T06:00:00');
    const finish = new Date('2026-08-17T14:30:00');
    expect(calculateElapsedMinutes(start, finish)).toBe(510); // 8h 30m
  });

  it('calculates duration for afternoon shift crossing into evening', () => {
    const start = new Date('2026-08-17T14:30:00');
    const finish = new Date('2026-08-17T23:00:00');
    expect(calculateElapsedMinutes(start, finish)).toBe(510); // 8h 30m
  });

  it('calculates duration for night shift crossing midnight without negative numbers', () => {
    const start = new Date('2026-08-17T23:00:00');
    const finish = new Date('2026-08-18T06:00:00');
    expect(calculateElapsedMinutes(start, finish)).toBe(420); // 7h 00m
  });
});

describe('Break Rules & Calculation', () => {
  it('subtracts unpaid breaks and preserves paid breaks', () => {
    const breaks: TimeBreak[] = [
      { type: 'paid_15', durationMinutes: 15, isPaid: true },
      { type: 'unpaid_30', durationMinutes: 30, isPaid: false },
    ];
    const { paidBreakMinutes, unpaidBreakMinutes } = calculateBreakTotals(breaks);
    expect(paidBreakMinutes).toBe(15);
    expect(unpaidBreakMinutes).toBe(30);

    const start = new Date('2026-08-17T06:00:00');
    const rawFinish = new Date('2026-08-17T14:30:00');
    const session = calculateWorkSession(start, rawFinish, breaks);

    expect(session.elapsedMinutes).toBe(510); // 8h 30m
    expect(session.unpaidBreakMinutes).toBe(30);
    expect(session.paidBreakMinutes).toBe(15);
    expect(session.paidMinutes).toBe(480); // 8h 00m paid
  });

  it('handles overtime with second paid 15-minute break', () => {
    const breaks: TimeBreak[] = [
      { type: 'paid_15', durationMinutes: 15, isPaid: true },
      { type: 'unpaid_30', durationMinutes: 30, isPaid: false },
      { type: 'paid_15_extra', durationMinutes: 15, isPaid: true },
    ];
    const start = new Date('2026-08-17T14:30:00');
    // raw finish 23:23 -> rounded to 23:25
    const rawFinish = new Date('2026-08-17T23:23:00');
    const session = calculateWorkSession(start, rawFinish, breaks);

    expect(session.elapsedMinutes).toBe(535); // 8h 55m
    expect(session.unpaidBreakMinutes).toBe(30);
    expect(session.paidBreakMinutes).toBe(30);
    expect(session.paidMinutes).toBe(505); // 8h 25m paid
  });
});

describe('Premium Segment Splitting (Evening, Sunday, Sunday Evening)', () => {
  it('splits weekday afternoon shift with evening hours (22:00–23:25)', () => {
    // Monday August 17, 2026
    const start = new Date('2026-08-17T14:30:00');
    const roundedFinish = new Date('2026-08-17T23:25:00');
    const segments = segmentWorkSession(start, roundedFinish, DEFAULT_PREMIUM_CONFIG);

    // 14:30 -> 22:00 is 7h 30m = 450 minutes normal (1.0x)
    // 22:00 -> 23:25 is 1h 25m = 85 minutes evening (+50% / 1.50x)
    const baseSeg = segments.find((s) => s.rateMultiplier === 1.0);
    const eveningSeg = segments.find((s) => s.rateMultiplier === 1.5);

    expect(baseSeg?.minutes).toBe(450);
    expect(eveningSeg?.minutes).toBe(85);
    expect(baseSeg!.minutes + eveningSeg!.minutes).toBe(535);
  });

  it('splits Sunday shift with Sunday daytime (+50%) and Sunday evening (+75%)', () => {
    // Sunday August 23, 2026
    const start = new Date('2026-08-23T14:30:00');
    const roundedFinish = new Date('2026-08-23T23:00:00');
    const segments = segmentWorkSession(start, roundedFinish, DEFAULT_PREMIUM_CONFIG);

    // Sunday 14:30 -> 22:00 is 450 minutes @ 1.50x
    // Sunday 22:00 -> 23:00 is 60 minutes @ 1.75x
    const sunDaySeg = segments.find((s) => s.rateMultiplier === 1.5);
    const sunEveningSeg = segments.find((s) => s.rateMultiplier === 1.75);

    expect(sunDaySeg?.minutes).toBe(450);
    expect(sunEveningSeg?.minutes).toBe(60);
  });
});
