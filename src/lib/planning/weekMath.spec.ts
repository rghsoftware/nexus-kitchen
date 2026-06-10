import { describe, expect, it } from 'vitest';
import {
	addDays,
	dayFullLabel,
	dayLabel,
	dayOfMonth,
	isSameMonth,
	mondayOf,
	monthEndOf,
	monthGridDates,
	monthGridRange,
	monthLabel,
	monthStartOf,
	todayLocalISO,
	weekDatesOf,
	weekLabel,
	weekRangeOf,
	weekdayLabel
} from './weekMath';

describe('addDays', () => {
	it('adds within a month', () => {
		expect(addDays('2026-06-10', 3)).toBe('2026-06-13');
	});

	it('crosses month boundaries', () => {
		expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
		expect(addDays('2026-07-01', -1)).toBe('2026-06-30');
	});

	it('crosses year boundaries', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
	});

	it('handles leap day', () => {
		expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
		expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
	});

	it('rejects malformed input', () => {
		expect(() => addDays('06/10/2026', 1)).toThrow('Invalid ISO date');
		expect(() => addDays('2026-13-45', 1)).toThrow('Invalid ISO date');
	});
});

describe('mondayOf (ISO Monday-start weeks, A-009)', () => {
	it('returns the same day for a Monday', () => {
		expect(mondayOf('2026-06-08')).toBe('2026-06-08'); // a Monday
	});

	it('maps midweek days back to Monday', () => {
		expect(mondayOf('2026-06-10')).toBe('2026-06-08'); // Wednesday
		expect(mondayOf('2026-06-13')).toBe('2026-06-08'); // Saturday
	});

	it('maps Sunday back to the preceding Monday, not forward', () => {
		expect(mondayOf('2026-06-14')).toBe('2026-06-08'); // Sunday
	});

	it('crosses month and year boundaries', () => {
		expect(mondayOf('2026-01-01')).toBe('2025-12-29'); // Thu Jan 1 → Mon Dec 29
		expect(mondayOf('2026-08-01')).toBe('2026-07-27');
	});
});

describe('weekRangeOf / weekDatesOf', () => {
	it('spans Monday through Sunday', () => {
		expect(weekRangeOf('2026-06-10')).toEqual({ start: '2026-06-08', end: '2026-06-14' });
	});

	it('lists exactly the 7 week dates in order', () => {
		const dates = weekDatesOf('2026-06-10');
		expect(dates).toHaveLength(7);
		expect(dates[0]).toBe('2026-06-08');
		expect(dates[6]).toBe('2026-06-14');
	});
});

describe('month helpers', () => {
	it('monthStartOf / monthEndOf', () => {
		expect(monthStartOf('2026-06-10')).toBe('2026-06-01');
		expect(monthEndOf('2026-06-10')).toBe('2026-06-30');
		expect(monthEndOf('2026-02-10')).toBe('2026-02-28');
		expect(monthEndOf('2028-02-10')).toBe('2028-02-29'); // leap year
		expect(monthEndOf('2026-12-05')).toBe('2026-12-31');
	});

	it('monthGridRange is Monday-aligned and covers the whole month', () => {
		// June 2026: Jun 1 is a Monday, Jun 30 is a Tuesday
		expect(monthGridRange('2026-06-10')).toEqual({ start: '2026-06-01', end: '2026-07-05' });
		// August 2026: Aug 1 is a Saturday
		expect(monthGridRange('2026-08-15')).toEqual({ start: '2026-07-27', end: '2026-09-06' });
	});

	it('monthGridDates is a whole number of weeks starting on Monday', () => {
		const dates = monthGridDates('2026-06-10');
		expect(dates.length % 7).toBe(0);
		expect(dates[0]).toBe('2026-06-01');
		expect(dates.at(-1)).toBe('2026-07-05');
	});

	it('isSameMonth compares calendar months', () => {
		expect(isSameMonth('2026-06-01', '2026-06-30')).toBe(true);
		expect(isSameMonth('2026-06-30', '2026-07-01')).toBe(false);
	});

	it('dayOfMonth strips leading zeros', () => {
		expect(dayOfMonth('2026-06-05')).toBe(5);
		expect(dayOfMonth('2026-06-25')).toBe(25);
	});
});

describe('todayLocalISO', () => {
	it('formats the local clock as a civil date', () => {
		// Construct a fixed local time; expect local Y-M-D regardless of timezone
		const fixed = new Date(2026, 5, 10, 23, 30); // June 10, 23:30 local
		expect(todayLocalISO(fixed)).toBe('2026-06-10');
	});

	it('returns a well-formed ISO date for the real clock', () => {
		expect(todayLocalISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('labels', () => {
	it('weekday and day labels', () => {
		expect(weekdayLabel('2026-06-08')).toBe('Mon');
		expect(dayLabel('2026-06-08')).toBe('Jun 8');
		expect(dayFullLabel('2026-06-10')).toBe('Wednesday, June 10');
	});

	it('month and week labels', () => {
		expect(monthLabel('2026-06-10')).toBe('June 2026');
		expect(weekLabel('2026-06-10')).toBe('Jun 8 – Jun 14, 2026');
	});
});
