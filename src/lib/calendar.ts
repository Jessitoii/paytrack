export interface CalendarCell {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayOfWeek: number; // 0 = Mon, ..., 6 = Sun
}

/**
 * Returns a deterministic Monday-first 7-column calendar grid for a given year and month (0-indexed).
 * Always returns complete rows of 7 days (e.g. 35 or 42 cells).
 */
export function getCalendarMonthGrid(
  year: number,
  monthIndex: number,
  todayStr = new Date().toISOString().substring(0, 10)
): CalendarCell[] {
  // 1. Total days in this month
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();

  // 2. Day of week for 1st of month (Monday = 0, ..., Sunday = 6)
  const firstDayObj = new Date(year, monthIndex, 1);
  const startDayOfWeek = (firstDayObj.getDay() + 6) % 7;

  // 3. Days in previous month
  const prevMonthTotalDays = new Date(year, monthIndex, 0).getDate();

  const cells: CalendarCell[] = [];

  // Previous month leading cells
  const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
  const prevYear = monthIndex === 0 ? year - 1 : year;

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const dateStr = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayOfWeek = (startDayOfWeek - 1 - i) % 7;
    cells.push({
      dateStr,
      dayNumber: dayNum,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      dayOfWeek,
    });
  }

  // Current month cells (1 to totalDays)
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = (startDayOfWeek + day - 1) % 7;
    cells.push({
      dateStr,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      dayOfWeek,
    });
  }

  // Next month trailing cells to complete the 7-day grid rows
  const remaining = cells.length % 7;
  if (remaining > 0) {
    const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
    const nextYear = monthIndex === 11 ? year + 1 : year;
    const toAdd = 7 - remaining;

    for (let day = 1; day <= toAdd; day++) {
      const dateStr = `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = (cells.length) % 7;
      cells.push({
        dateStr,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        dayOfWeek,
      });
    }
  }

  return cells;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function getMonthYearTitle(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}
