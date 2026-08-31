import { describe, it, expect } from 'vitest';
import { getCalendarMonthGrid, getMonthYearTitle } from '../../src/lib/calendar';

describe('Calendar Grid Generation Unit Tests', () => {
  it('generates exact 30 days for September 2026 with correct Monday-first alignment', () => {
    // September 2026 (monthIndex = 8)
    const grid = getCalendarMonthGrid(2026, 8, '2026-09-15');

    expect(getMonthYearTitle(2026, 8)).toBe('September 2026');

    // Sept 1, 2026 is Tuesday -> 1 leading cell from August (Aug 31)
    const leading = grid.filter((c) => !c.isCurrentMonth && c.dateStr.startsWith('2026-08'));
    expect(leading.length).toBe(1);
    expect(leading[0].dateStr).toBe('2026-08-31');
    expect(leading[0].dayOfWeek).toBe(0); // Monday

    // Current month days: exactly 30 days
    const current = grid.filter((c) => c.isCurrentMonth);
    expect(current.length).toBe(30);
    expect(current[0].dateStr).toBe('2026-09-01');
    expect(current[0].dayNumber).toBe(1);
    expect(current[0].dayOfWeek).toBe(1); // Tuesday

    expect(current[29].dateStr).toBe('2026-09-30');
    expect(current[29].dayNumber).toBe(30);
    expect(current[29].dayOfWeek).toBe(2); // Wednesday

    // Total cells must be a multiple of 7
    expect(grid.length % 7).toBe(0);
    expect(grid.length).toBe(35); // 5 rows of 7
  });

  it('generates exact 31 days for August 2026', () => {
    // August 2026 (monthIndex = 7)
    const grid = getCalendarMonthGrid(2026, 7);
    const current = grid.filter((c) => c.isCurrentMonth);

    expect(current.length).toBe(31);
    expect(current[0].dateStr).toBe('2026-08-01');
    expect(current[30].dateStr).toBe('2026-08-31');
    expect(grid.length % 7).toBe(0);
  });

  it('generates exact 28 days for February 2027 (non-leap year)', () => {
    // Feb 2027 (monthIndex = 1)
    const grid = getCalendarMonthGrid(2027, 1);
    const current = grid.filter((c) => c.isCurrentMonth);

    expect(current.length).toBe(28);
    expect(current[27].dateStr).toBe('2027-02-28');
  });

  it('generates exact 29 days for February 2028 (leap year)', () => {
    // Feb 2028 (monthIndex = 1)
    const grid = getCalendarMonthGrid(2028, 1);
    const current = grid.filter((c) => c.isCurrentMonth);

    expect(current.length).toBe(29);
    expect(current[28].dateStr).toBe('2028-02-29');
  });

  it('correctly transitions between December 2026 and January 2027', () => {
    // December 2026 (monthIndex = 11)
    const decGrid = getCalendarMonthGrid(2026, 11);
    const decCurrent = decGrid.filter((c) => c.isCurrentMonth);
    expect(decCurrent.length).toBe(31);
    expect(decCurrent[30].dateStr).toBe('2026-12-31');

    // January 2027 (monthIndex = 0)
    const janGrid = getCalendarMonthGrid(2027, 0);
    const janCurrent = janGrid.filter((c) => c.isCurrentMonth);
    expect(janCurrent.length).toBe(31);
    expect(janCurrent[0].dateStr).toBe('2027-01-01');
  });
});
