import { roundFinishDateTo5Minutes } from './rounding.js';
import type { TimeBreak, CalculatedWorkSession, PremiumSegment } from '../types/time.js';

export interface PremiumRulesConfig {
  eveningStartHour: number; // 22
  eveningEndHour: number;   // 24 (00:00)
  eveningMultiplier: number; // 1.50 (+50%)
  
  sundayMultiplier: number; // 1.50 (+50%)
  sundayEveningMultiplier: number; // 1.75 (+75%)
  
  nightStartHour?: number; // 23
  nightEndHour?: number;   // 6
  nightMultiplier?: number; // 2.00 (+100%)
  enableNightMultiplier?: boolean; // false unless confirmed
}

export const DEFAULT_PREMIUM_CONFIG: PremiumRulesConfig = {
  eveningStartHour: 22,
  eveningEndHour: 24,
  eveningMultiplier: 1.50,
  sundayMultiplier: 1.50,
  sundayEveningMultiplier: 1.75,
  nightStartHour: 23,
  nightEndHour: 6,
  nightMultiplier: 2.00,
  enableNightMultiplier: false, // Per doc: exact contract night range unknown/configurable
};

/**
 * Calculates elapsed minutes between two dates in integer minutes.
 * Handles crossing midnight correctly.
 */
export function calculateElapsedMinutes(start: Date, finish: Date): number {
  const diffMs = finish.getTime() - start.getTime();
  if (diffMs < 0) {
    throw new Error('Finish time cannot be earlier than start time');
  }
  return Math.floor(diffMs / (1000 * 60));
}

/**
 * Calculates total paid and unpaid break minutes.
 */
export function calculateBreakTotals(breaks: TimeBreak[]): {
  paidBreakMinutes: number;
  unpaidBreakMinutes: number;
} {
  let paidBreakMinutes = 0;
  let unpaidBreakMinutes = 0;

  for (const b of breaks) {
    if (b.isPaid) {
      paidBreakMinutes += b.durationMinutes;
    } else {
      unpaidBreakMinutes += b.durationMinutes;
    }
  }

  return { paidBreakMinutes, unpaidBreakMinutes };
}

/**
 * Splits a continuous work period (start to finish) into 1-minute or 15-minute segments
 * and tags each segment with its applicable premium multiplier based on day of week and local hour.
 * 
 * Rules:
 * - Sunday (00:00 - 22:00): +50% (multiplier 1.50)
 * - Sunday (22:00 - 24:00): +75% (multiplier 1.75)
 * - Mon-Sat (22:00 - 24:00): +50% (multiplier 1.50)
 * - Mon-Sat (00:00 - 22:00): Normal (multiplier 1.00)
 * - If Night Shift premium enabled (+100% / 2.00), applies to configured hours.
 */
export function segmentWorkSession(
  start: Date,
  roundedFinish: Date,
  config: PremiumRulesConfig = DEFAULT_PREMIUM_CONFIG
): PremiumSegment[] {
  const totalMinutes = calculateElapsedMinutes(start, roundedFinish);
  if (totalMinutes === 0) {
    return [];
  }

  // Segment aggregation map: key is rateMultiplier -> total minutes
  const segmentMinutesMap = new Map<number, { name: string; minutes: number; description: string }>();

  // Helper to add minutes to a rate bucket
  const addMinute = (multiplier: number, name: string, description: string) => {
    const existing = segmentMinutesMap.get(multiplier);
    if (existing) {
      existing.minutes += 1;
    } else {
      segmentMinutesMap.set(multiplier, { name, minutes: 1, description });
    }
  };

  // Walk minute by minute from start to roundedFinish
  const current = new Date(start.getTime());
  for (let i = 0; i < totalMinutes; i++) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = current.getHours();
    const isSunday = dayOfWeek === 0;

    // Check Sunday Evening
    if (isSunday && hour >= config.eveningStartHour) {
      addMinute(config.sundayEveningMultiplier, 'Sunday Evening (+75%)', 'Sunday work 22:00-00:00');
    }
    // Check Sunday Day
    else if (isSunday) {
      addMinute(config.sundayMultiplier, 'Sunday (+50%)', 'Sunday work 00:00-22:00');
    }
    // Check Weekday Evening (Mon-Sat 22:00-00:00)
    else if (hour >= config.eveningStartHour) {
      addMinute(config.eveningMultiplier, 'Evening (+50%)', 'Mon-Sat work 22:00-00:00');
    }
    // Check Optional Night Multiplier if enabled
    else if (
      config.enableNightMultiplier &&
      config.nightStartHour !== undefined &&
      config.nightEndHour !== undefined &&
      (hour >= config.nightStartHour || hour < config.nightEndHour)
    ) {
      addMinute(config.nightMultiplier || 2.0, 'Night Shift (+100%)', 'Night premium hours');
    }
    // Standard base rate
    else {
      addMinute(1.0, 'Base / Normal', 'Standard working hours');
    }

    // Advance 1 minute
    current.setTime(current.getTime() + 60 * 1000);
  }

  const result: PremiumSegment[] = [];
  for (const [rateMultiplier, data] of segmentMinutesMap.entries()) {
    result.push({
      name: data.name,
      rateMultiplier,
      minutes: data.minutes,
      description: data.description,
    });
  }

  // Sort with base rate first, then ascending multiplier
  return result.sort((a, b) => a.rateMultiplier - b.rateMultiplier);
}

/**
 * Calculates a complete work session including finish rounding, break deduction, and premium segmentation.
 */
export function calculateWorkSession(
  start: Date,
  rawFinish: Date,
  breaks: TimeBreak[],
  config: PremiumRulesConfig = DEFAULT_PREMIUM_CONFIG
): CalculatedWorkSession {
  const roundedFinish = roundFinishDateTo5Minutes(rawFinish);
  const elapsedMinutes = calculateElapsedMinutes(start, roundedFinish);
  const { paidBreakMinutes, unpaidBreakMinutes } = calculateBreakTotals(breaks);

  const paidMinutes = Math.max(0, elapsedMinutes - unpaidBreakMinutes);
  const segments = segmentWorkSession(start, roundedFinish, config);

  // If unpaid break exists, proportionally or base-deduct it from segments
  // Unpaid breaks are generally taken during normal day hours.
  // We proportionally adjust or deduct from standard base rate.
  let remainingUnpaidToDeduct = unpaidBreakMinutes;
  const adjustedSegments: PremiumSegment[] = [];

  // Deduct unpaid break from lowest multiplier (base) first
  for (const seg of segments) {
    if (remainingUnpaidToDeduct > 0) {
      if (seg.minutes >= remainingUnpaidToDeduct) {
        adjustedSegments.push({
          ...seg,
          minutes: seg.minutes - remainingUnpaidToDeduct,
        });
        remainingUnpaidToDeduct = 0;
      } else {
        remainingUnpaidToDeduct -= seg.minutes;
        // 0 minutes remaining for this segment, do not add
      }
    } else {
      adjustedSegments.push({ ...seg });
    }
  }

  return {
    elapsedMinutes,
    unpaidBreakMinutes,
    paidBreakMinutes,
    paidMinutes,
    segments: adjustedSegments.filter((s) => s.minutes > 0),
  };
}
