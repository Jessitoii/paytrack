/**
 * Rounds a finish time upward to the next 5-minute boundary.
 * In accordance with Zebra device logout rounding rules:
 * 23:21 -> 23:25
 * 23:22 -> 23:25
 * 23:23 -> 23:25
 * 23:24 -> 23:25
 * 23:25 -> 23:25
 * 23:26 -> 23:30
 */
export function roundFinishDateTo5Minutes(date: Date): Date {
  const result = new Date(date.getTime());
  const minutes = result.getMinutes();
  const seconds = result.getSeconds();
  const millis = result.getMilliseconds();

  // If already at an exact 5-minute mark with 0 seconds and 0 millis, keep it
  if (minutes % 5 === 0 && seconds === 0 && millis === 0) {
    return result;
  }

  // Clear seconds and millis
  result.setSeconds(0, 0);

  // Compute total floating minutes or ceil
  const roundedMinutes = Math.ceil((minutes + (seconds > 0 || millis > 0 ? 0.001 : 0)) / 5) * 5;
  
  result.setMinutes(roundedMinutes);
  return result;
}

/**
 * Rounds a time string "HH:mm" upward to the next 5-minute boundary.
 */
export function roundFinishTimeStringTo5Minutes(timeStr: string): string {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time string: ${timeStr}`);
  }

  const roundedMinutesTotal = Math.ceil(minutes / 5) * 5;
  const newHours = (hours + Math.floor(roundedMinutesTotal / 60)) % 24;
  const newMinutes = roundedMinutesTotal % 60;

  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
}

/**
 * Formats a duration in total minutes into "Xh Ym" or "X:YY" format.
 */
export function formatMinutesToHoursAndMinutes(totalMinutes: number): string {
  const isNegative = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;

  const prefix = isNegative ? '-' : '';
  return `${prefix}${hours}h ${String(minutes).padStart(2, '0')}m`;
}

/**
 * Converts "HH:mm" to total minutes from midnight (0..1439).
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  return hours * 60 + minutes;
}
