// Civil-date math for the planning calendar. All public functions take and return
// YYYY-MM-DD strings (A-006): plan dates are civil dates with no time component, and
// "today" is whatever the user's local clock says. Internally dates are parsed to a
// UTC-noon Date so day arithmetic can never be skewed by DST transitions.
//
// Weeks are Monday-start ISO weeks (A-009): implicit MealPlans span Monday–Sunday.

import type { ISODate } from './types';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse an ISO date string to a UTC-noon Date. Throws on malformed input. */
function parse(date: ISODate): Date {
	if (!ISO_DATE_RE.test(date)) throw new Error(`Invalid ISO date: ${date}`);
	const d = new Date(`${date}T12:00:00Z`);
	if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${date}`);
	return d;
}

/** Format a UTC-noon Date back to YYYY-MM-DD. */
function format(d: Date): ISODate {
	return d.toISOString().slice(0, 10);
}

/** Today as a civil date in the user's local timezone. */
export function todayLocalISO(now: Date = new Date()): ISODate {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** Add (or subtract) whole days. */
export function addDays(date: ISODate, days: number): ISODate {
	const d = parse(date);
	d.setUTCDate(d.getUTCDate() + days);
	return format(d);
}

/** The Monday of the ISO week containing `date`. */
export function mondayOf(date: ISODate): ISODate {
	const d = parse(date);
	const dow = d.getUTCDay(); // 0 = Sunday … 6 = Saturday
	const offset = dow === 0 ? -6 : 1 - dow;
	return addDays(date, offset);
}

/** Monday–Sunday range of the ISO week containing `date` (implicit plan bounds). */
export function weekRangeOf(date: ISODate): { start: ISODate; end: ISODate } {
	const start = mondayOf(date);
	return { start, end: addDays(start, 6) };
}

/** The 7 dates (Mon–Sun) of the week containing `date`. */
export function weekDatesOf(date: ISODate): ISODate[] {
	const start = mondayOf(date);
	return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** First day of the month containing `date`. */
export function monthStartOf(date: ISODate): ISODate {
	return `${date.slice(0, 7)}-01`;
}

/** Last day of the month containing `date`. */
export function monthEndOf(date: ISODate): ISODate {
	const d = parse(monthStartOf(date));
	d.setUTCMonth(d.getUTCMonth() + 1);
	d.setUTCDate(0); // last day of previous month
	return format(d);
}

/**
 * The full Monday-aligned grid covering the month of `date`: from the Monday of the
 * week containing the 1st through the Sunday of the week containing the last day.
 * Always a whole number of weeks (28–42 days) — feeds the month view and its fetch range.
 */
export function monthGridRange(date: ISODate): { start: ISODate; end: ISODate } {
	const start = mondayOf(monthStartOf(date));
	const end = addDays(mondayOf(monthEndOf(date)), 6);
	return { start, end };
}

/** All dates of the month grid, in order. */
export function monthGridDates(date: ISODate): ISODate[] {
	const { start, end } = monthGridRange(date);
	const out: ISODate[] = [];
	for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
	return out;
}

/** Same calendar month? */
export function isSameMonth(a: ISODate, b: ISODate): boolean {
	return a.slice(0, 7) === b.slice(0, 7);
}

const WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
const DAY_FMT = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});
const DAY_FULL_FMT = new Intl.DateTimeFormat('en-US', {
	weekday: 'long',
	month: 'long',
	day: 'numeric',
	timeZone: 'UTC'
});
const MONTH_FMT = new Intl.DateTimeFormat('en-US', {
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

/** "Mon", "Tue", … */
export function weekdayLabel(date: ISODate): string {
	return WEEKDAY_FMT.format(parse(date));
}

/** "Jun 10" */
export function dayLabel(date: ISODate): string {
	return DAY_FMT.format(parse(date));
}

/** "Wednesday, June 10" */
export function dayFullLabel(date: ISODate): string {
	return DAY_FULL_FMT.format(parse(date));
}

/** "June 2026" */
export function monthLabel(date: ISODate): string {
	return MONTH_FMT.format(parse(date));
}

/** "Jun 8 – Jun 14, 2026" for the week containing `date`. */
export function weekLabel(date: ISODate): string {
	const { start, end } = weekRangeOf(date);
	return `${DAY_FMT.format(parse(start))} – ${DAY_FMT.format(parse(end))}, ${start.slice(0, 4)}`;
}

/** Day-of-month without leading zero, for month-grid cells. */
export function dayOfMonth(date: ISODate): number {
	return Number(date.slice(8, 10));
}
