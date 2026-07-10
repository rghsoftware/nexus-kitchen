import { describe, expect, it } from 'vitest';
import type { PlannedMeal } from '$lib/planning/types';
import type { MealLog } from './types';
import { deriveNudge, localDateISO, localDayBounds, nudgeDismissKey, slotForTime } from './slots';

function at(hour: number, minute = 0): Date {
	return new Date(2026, 6, 9, hour, minute); // local time, 2026-07-09
}

function plannedMeal(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
	return {
		id: 'pm-1',
		mealPlanId: 'plan-1',
		date: '2026-07-09',
		mealSlot: 'LUNCH',
		source: 'QUICK',
		recipeId: null,
		recipeTitleSnapshot: null,
		preppedMealId: null,
		preppedNameSnapshot: null,
		storeBoughtName: null,
		quickMealName: 'Marinara pasta',
		servings: 1,
		status: 'PLANNED',
		sortOrder: 0,
		createdAt: '2026-07-09T00:00:00Z',
		updatedAt: '2026-07-09T00:00:00Z',
		...overrides
	};
}

function log(overrides: Partial<MealLog> = {}): MealLog {
	return {
		id: 'log-1',
		ownerId: 'user-1',
		logType: 'QUICK_LOG',
		plannedMealId: null,
		recipeId: null,
		preppedMealId: null,
		nameSnapshot: null,
		mealSlot: 'LUNCH',
		servings: 1,
		loggedAt: '2026-07-09T12:00:00Z',
		verdict: null,
		notes: null,
		createdAt: '2026-07-09T12:00:00Z',
		updatedAt: '2026-07-09T12:00:00Z',
		...overrides
	};
}

describe('slotForTime', () => {
	it('maps the fixed windows to slots (A-001)', () => {
		expect(slotForTime(at(6))).toBe('BREAKFAST');
		expect(slotForTime(at(10, 59))).toBe('BREAKFAST');
		expect(slotForTime(at(11))).toBe('LUNCH');
		expect(slotForTime(at(13, 12))).toBe('LUNCH');
		expect(slotForTime(at(14, 59))).toBe('LUNCH');
		expect(slotForTime(at(17))).toBe('DINNER');
		expect(slotForTime(at(21, 30))).toBe('DINNER');
	});

	it('defaults to SNACK between and outside windows', () => {
		expect(slotForTime(at(5))).toBe('SNACK');
		expect(slotForTime(at(15))).toBe('SNACK');
		expect(slotForTime(at(16))).toBe('SNACK');
		expect(slotForTime(at(22))).toBe('SNACK');
		expect(slotForTime(at(2))).toBe('SNACK');
	});
});

describe('localDateISO / localDayBounds', () => {
	it('formats the local civil date', () => {
		expect(localDateISO(at(13))).toBe('2026-07-09');
		expect(localDateISO(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
	});

	it('bounds span exactly the local day', () => {
		const { fromISO, toISO } = localDayBounds(at(13, 30));
		expect(new Date(fromISO).getTime()).toBe(new Date(2026, 6, 9).getTime());
		expect(new Date(toISO).getTime()).toBe(new Date(2026, 6, 10).getTime());
	});
});

describe('deriveNudge', () => {
	it('nudges for a planned, unlogged meal inside its window', () => {
		const nudge = deriveNudge(at(12, 10), [plannedMeal()], [], []);
		expect(nudge).toEqual({ slot: 'LUNCH', plannedMealId: 'pm-1', name: 'Marinara pasta' });
	});

	it('stays silent outside breakfast/lunch/dinner windows', () => {
		expect(deriveNudge(at(15), [plannedMeal()], [], [])).toBeNull();
	});

	it('stays silent when the slot was dismissed today', () => {
		expect(deriveNudge(at(12), [plannedMeal()], [], ['LUNCH'])).toBeNull();
	});

	it('stays silent once anything was logged for the slot', () => {
		expect(deriveNudge(at(12), [plannedMeal()], [log({ mealSlot: 'LUNCH' })], [])).toBeNull();
	});

	it('ignores meals that are no longer PLANNED', () => {
		expect(deriveNudge(at(12), [plannedMeal({ status: 'LOGGED' })], [], [])).toBeNull();
	});

	it('ignores meals in other slots', () => {
		expect(deriveNudge(at(12), [plannedMeal({ mealSlot: 'DINNER' })], [], [])).toBeNull();
	});
});

describe('nudgeDismissKey', () => {
	it('is scoped to date and slot', () => {
		expect(nudgeDismissKey('2026-07-09', 'LUNCH')).toBe('nk-nudge-dismissed:2026-07-09:LUNCH');
	});
});
