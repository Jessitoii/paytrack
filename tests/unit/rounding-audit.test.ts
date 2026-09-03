import { describe, it, expect } from 'vitest';
import {
  roundFinishDateTo5Minutes,
  roundFinishTimeStringTo5Minutes,
  formatMinutesToHoursAndMinutes,
} from '../../shared/time/rounding';
import { calculateWorkSession } from '../../shared/time/periods';
import type { TimeBreak } from '../../shared/types/time';

describe('Audit: 5-Minute Finish-Time Rounding Engine', () => {
  describe('Exact 5-minute boundaries (no rounding change)', () => {
    it('preserves exact 5-minute string values', () => {
      expect(roundFinishTimeStringTo5Minutes('23:00')).toBe('23:00');
      expect(roundFinishTimeStringTo5Minutes('23:05')).toBe('23:05');
      expect(roundFinishTimeStringTo5Minutes('23:10')).toBe('23:10');
      expect(roundFinishTimeStringTo5Minutes('23:15')).toBe('23:15');
      expect(roundFinishTimeStringTo5Minutes('23:20')).toBe('23:20');
      expect(roundFinishTimeStringTo5Minutes('23:25')).toBe('23:25');
      expect(roundFinishTimeStringTo5Minutes('23:30')).toBe('23:30');
      expect(roundFinishTimeStringTo5Minutes('23:55')).toBe('23:55');
    });

    it('preserves exact 5-minute Date instances', () => {
      const d = new Date('2026-08-17T23:25:00.000');
      const rounded = roundFinishDateTo5Minutes(d);
      expect(rounded.getHours()).toBe(23);
      expect(rounded.getMinutes()).toBe(25);
      expect(rounded.getSeconds()).toBe(0);
      expect(rounded.getMilliseconds()).toBe(0);
    });
  });

  describe('+1/+2/+3/+4 minutes (ceiling rounding upward)', () => {
    it('rounds +1..+4 minutes to the next 5-minute mark', () => {
      expect(roundFinishTimeStringTo5Minutes('23:01')).toBe('23:05');
      expect(roundFinishTimeStringTo5Minutes('23:02')).toBe('23:05');
      expect(roundFinishTimeStringTo5Minutes('23:03')).toBe('23:05');
      expect(roundFinishTimeStringTo5Minutes('23:04')).toBe('23:05');
      expect(roundFinishTimeStringTo5Minutes('23:21')).toBe('23:25');
      expect(roundFinishTimeStringTo5Minutes('23:22')).toBe('23:25');
      expect(roundFinishTimeStringTo5Minutes('23:23')).toBe('23:25');
      expect(roundFinishTimeStringTo5Minutes('23:24')).toBe('23:25');
    });
  });

  describe('+6/+7/+8/+9 minutes (ceiling rounding upward)', () => {
    it('rounds +6..+9 minutes to the next 5-minute mark', () => {
      expect(roundFinishTimeStringTo5Minutes('23:06')).toBe('23:10');
      expect(roundFinishTimeStringTo5Minutes('23:07')).toBe('23:10');
      expect(roundFinishTimeStringTo5Minutes('23:08')).toBe('23:10');
      expect(roundFinishTimeStringTo5Minutes('23:09')).toBe('23:10');
      expect(roundFinishTimeStringTo5Minutes('23:11')).toBe('23:15');
      expect(roundFinishTimeStringTo5Minutes('23:17')).toBe('23:20');
      expect(roundFinishTimeStringTo5Minutes('23:26')).toBe('23:30');
      expect(roundFinishTimeStringTo5Minutes('23:29')).toBe('23:30');
    });
  });

  describe('Midnight crossing & 23:59', () => {
    it('rounds 23:59 to 00:00 (next hour)', () => {
      expect(roundFinishTimeStringTo5Minutes('23:59')).toBe('00:00');
    });

    it('handles Date rollover at 23:59:00 to 00:00 on the following day', () => {
      const d = new Date('2026-08-17T23:59:00');
      const rounded = roundFinishDateTo5Minutes(d);
      expect(rounded.getDate()).toBe(18);
      expect(rounded.getHours()).toBe(0);
      expect(rounded.getMinutes()).toBe(0);
      expect(rounded.getSeconds()).toBe(0);
    });

    it('calculates duration for night shift 22:30 -> 00:01 correctly as positive (rounded to 00:05)', () => {
      const start = new Date('2026-08-17T22:30:00');
      const finish = new Date('2026-08-18T00:01:00');
      const session = calculateWorkSession(start, finish, []);

      // 22:30 -> 00:05 is 1h 35m = 95 minutes
      expect(session.elapsedMinutes).toBe(95);
      expect(session.paidMinutes).toBe(95);
      expect(formatMinutesToHoursAndMinutes(session.paidMinutes)).toBe('1h 35m');
    });
  });

  describe('Break deduction after rounding', () => {
    it('correctly applies paid 15m (0 deduction) and unpaid 30m (-30m deduction)', () => {
      // Planned: 14:30 -> 23:00
      // Actual: 14:45 -> 23:17 (rounded to 23:20)
      // Elapsed: 14:45 -> 23:20 = 8h 35m = 515m
      // Breaks: 1x 15m paid, 1x 15m paid, 1x 30m unpaid = 30m paid, 30m unpaid
      // Paid minutes = 515 - 30 = 485m = 8h 05m
      const start = new Date('2026-08-31T14:45:00');
      const rawFinish = new Date('2026-08-31T23:17:00');
      const breaks: TimeBreak[] = [
        { id: 'b1', type: 'paid_15', name: '15m Paid Coffee', durationMinutes: 15, isPaid: true },
        { id: 'b2', type: 'paid_15', name: '15m Paid Coffee', durationMinutes: 15, isPaid: true },
        { id: 'b3', type: 'unpaid_30', name: '30m Meal Break', durationMinutes: 30, isPaid: false },
      ];

      const session = calculateWorkSession(start, rawFinish, breaks);
      expect(session.elapsedMinutes).toBe(515); // 8h 35m
      expect(session.paidBreakMinutes).toBe(30);
      expect(session.unpaidBreakMinutes).toBe(30);
      expect(session.paidMinutes).toBe(485); // 8h 05m
      expect(formatMinutesToHoursAndMinutes(session.paidMinutes)).toBe('8h 05m');
    });
  });
});
