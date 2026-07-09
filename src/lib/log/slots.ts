// Slot/time helpers for logging and the gentle nudge (feature 006, research R6).
// Pure: every function takes `now` explicitly — no Date.now() inside — so behaviour
// is fully unit-testable. Slot windows are fixed constants (spec A-001);
// personalisation belongs to the reminders feature.

import type { MealSlot, PlannedMeal, ISODate } from '$lib/planning/types';
import { plannedMealName } from '$lib/planning/types';
import type { MealLog } from './types';

/** Local-time hour windows, inclusive of both ends. SNACK is the in-between default. */
const SLOT_WINDOWS: readonly { slot: MealSlot; from: number; to: number }[] = [
	{ slot: 'BREAKFAST', from: 6, to: 10 },
	{ slot: 'LUNCH', from: 11, to: 14 },
	{ slot: 'DINNER', from: 17, to: 21 }
];

/** The slot a log made right now most likely belongs to (Quick Log default). */
export function slotForTime(now: Date): MealSlot {
	const hour = now.getHours();
	const window = SLOT_WINDOWS.find((w) => hour >= w.from && hour <= w.to);
	return window?.slot ?? 'SNACK';
}

/** The local calendar date, YYYY-MM-DD (planning's civil-date convention, A-006). */
export function localDateISO(now: Date): ISODate {
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

/** [start of local day, start of next local day) as UTC instants for range queries. */
export function localDayBounds(now: Date): { fromISO: string; toISO: string } {
	const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
	return { fromISO: start.toISOString(), toISO: end.toISOString() };
}

export interface NudgeState {
	slot: MealSlot;
	plannedMealId: string;
	name: string;
}

/**
 * Gentle mealtime nudge (FR-TL-019): show only when the clock is inside a
 * breakfast/lunch/dinner window, that slot has a still-PLANNED meal today, nothing
 * has been logged for the slot yet, and the user hasn't said "Not now" today.
 * Returns null otherwise — silence is the default, never pressure.
 */
export function deriveNudge(
	now: Date,
	todaysMeals: readonly PlannedMeal[],
	todaysLogs: readonly MealLog[],
	dismissedSlots: readonly MealSlot[]
): NudgeState | null {
	const hour = now.getHours();
	const window = SLOT_WINDOWS.find((w) => hour >= w.from && hour <= w.to);
	if (!window) return null;
	if (dismissedSlots.includes(window.slot)) return null;
	if (todaysLogs.some((log) => log.mealSlot === window.slot)) return null;

	const candidate = todaysMeals.find(
		(meal) => meal.mealSlot === window.slot && meal.status === 'PLANNED'
	);
	if (!candidate) return null;

	return { slot: window.slot, plannedMealId: candidate.id, name: plannedMealName(candidate) };
}

/** localStorage key for a "Not now" dismissal — device-local by design (R6). */
export function nudgeDismissKey(dateISO: ISODate, slot: MealSlot): string {
	return `nk-nudge-dismissed:${dateISO}:${slot}`;
}
