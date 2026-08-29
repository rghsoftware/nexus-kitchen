// Pure prep-day helpers (REQ-PP-003/004, research D6). No I/O, no globals — `today` is
// always passed in so the suggestion is deterministic and unit-testable.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toLocalMidnight(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function toIsoDate(date: Date): string {
	const d = toLocalMidnight(date);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** True for Saturday (6) and Sunday (0) — the default "common prep days" (REQ-PP-003). */
export function isWeekend(date: Date): boolean {
	const dow = toLocalMidnight(date).getDay();
	return dow === 0 || dow === 6;
}

/**
 * Suggest the next common prep day: the nearest upcoming weekend day (Sat/Sun), or today
 * if today is already a weekend day. Returns an ISO date string (REQ-PP-003).
 */
export function suggestPrepDay(today: Date): string {
	const start = toLocalMidnight(today);
	for (let offset = 0; offset < 7; offset++) {
		const candidate = new Date(start);
		candidate.setDate(start.getDate() + offset);
		if (isWeekend(candidate)) return toIsoDate(candidate);
	}
	// Unreachable (a weekend day occurs within any 7-day window), but keep total.
	return toIsoDate(start);
}

/**
 * Guard for the user-chosen prep day (REQ-PP-004): a prep day may be today or later, never
 * in the past. `prepDay` is an ISO date; `today` is compared on the local calendar date.
 */
export function isNotPast(prepDay: string, today: Date): boolean {
	if (!ISO_DATE.test(prepDay)) return false;
	const target = new Date(`${prepDay}T00:00:00`);
	return target.getTime() >= toLocalMidnight(today).getTime();
}
