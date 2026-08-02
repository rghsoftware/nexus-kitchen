import { describe, expect, it } from 'vitest';
import { isNotPast, isWeekend, suggestPrepDay } from './prepDay';

// Local-midnight Date for a given ISO date, so tests don't depend on the runner's clock.
const at = (iso: string) => new Date(`${iso}T09:00:00`);

describe('isWeekend', () => {
	it('is true for Saturday and Sunday', () => {
		expect(isWeekend(at('2026-06-13'))).toBe(true); // Sat
		expect(isWeekend(at('2026-06-14'))).toBe(true); // Sun
	});

	it('is false for weekdays', () => {
		expect(isWeekend(at('2026-06-15'))).toBe(false); // Mon
		expect(isWeekend(at('2026-06-11'))).toBe(false); // Thu
	});
});

describe('suggestPrepDay (REQ-PP-003)', () => {
	it('returns today when today is already a weekend day', () => {
		expect(suggestPrepDay(at('2026-06-13'))).toBe('2026-06-13'); // Sat → Sat
		expect(suggestPrepDay(at('2026-06-14'))).toBe('2026-06-14'); // Sun → Sun
	});

	it('returns the nearest upcoming Saturday from a weekday', () => {
		expect(suggestPrepDay(at('2026-06-10'))).toBe('2026-06-13'); // Wed → Sat
		expect(suggestPrepDay(at('2026-06-12'))).toBe('2026-06-13'); // Fri → Sat
	});

	it('returns Sunday when today is Monday-after-Saturday is further than Sunday', () => {
		expect(suggestPrepDay(at('2026-06-15'))).toBe('2026-06-20'); // Mon → next Sat
	});
});

describe('isNotPast (REQ-PP-004)', () => {
	const today = at('2026-06-13');

	it('accepts today and future dates', () => {
		expect(isNotPast('2026-06-13', today)).toBe(true);
		expect(isNotPast('2026-06-20', today)).toBe(true);
	});

	it('rejects past dates', () => {
		expect(isNotPast('2026-06-12', today)).toBe(false);
	});

	it('rejects malformed date strings', () => {
		expect(isNotPast('not-a-date', today)).toBe(false);
	});
});
