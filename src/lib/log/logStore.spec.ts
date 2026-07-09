import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { MealLog } from './types';

vi.mock('./logService', () => ({
	createLog: vi.fn(),
	setVerdict: vi.fn(),
	fetchLogsBetween: vi.fn().mockResolvedValue([]),
	fetchRecentLogs: vi.fn().mockResolvedValue([]),
	markPlannedMealLogged: vi.fn().mockResolvedValue(true)
}));
vi.mock('$lib/pantry/preppedMealStore.svelte', () => ({
	optimisticConsumePortions: vi.fn().mockResolvedValue(undefined)
}));
vi.mock('$lib/planning/planStore.svelte', () => ({
	markMealLoggedLocally: vi.fn()
}));

import { createLog, markPlannedMealLogged, setVerdict } from './logService';
import { optimisticConsumePortions } from '$lib/pantry/preppedMealStore.svelte';
import { markMealLoggedLocally } from '$lib/planning/planStore.svelte';
import {
	clearLogError,
	clearLogNotice,
	loadToday,
	logError,
	logMeal,
	logNotice,
	rateLog,
	todayLogs
} from './logStore.svelte';
import type { PlannedMeal } from '$lib/planning/types';

let seq = 0;
function savedLog(overrides: Partial<MealLog> = {}): MealLog {
	seq += 1;
	return {
		id: `srv-${seq}`,
		ownerId: 'user-1',
		logType: 'QUICK_LOG',
		plannedMealId: null,
		recipeId: null,
		preppedMealId: null,
		nameSnapshot: null,
		mealSlot: 'SNACK',
		servings: 1,
		loggedAt: new Date().toISOString(),
		verdict: null,
		notes: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides
	};
}

function plannedMeal(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
	seq += 1;
	return {
		id: `pm-${seq}`,
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

async function resetStore() {
	// Module state persists across tests: drain today's logs via a fresh load.
	await loadToday();
	clearLogError();
	clearLogNotice();
}

describe('logStore.logMeal', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		(createLog as Mock).mockImplementation(async () => savedLog());
		await resetStore();
	});

	it('appends optimistically and reconciles with the server row', async () => {
		expect.hasAssertions();
		const saved = savedLog({ nameSnapshot: 'Chili', logType: 'CUSTOM' });
		(createLog as Mock).mockResolvedValue(saved);

		const result = await logMeal({ kind: 'custom', name: 'Chili', slot: 'DINNER' });

		expect(result).toEqual(saved);
		expect(todayLogs()).toContainEqual(saved);
		expect(todayLogs().some((l) => l.id.startsWith('temp-'))).toBe(false);
	});

	it('rolls back the optimistic row and reports calmly when the insert fails', async () => {
		expect.hasAssertions();
		(createLog as Mock).mockRejectedValue(new Error("We couldn't save that log."));

		const result = await logMeal({ kind: 'quick', slot: null });

		expect(result).toBeNull();
		expect(todayLogs()).toHaveLength(0);
		expect(logError()).toBe("We couldn't save that log.");
	});

	it('consumes prepped portions attributed to the saved log (FR-TL-012)', async () => {
		expect.hasAssertions();
		const saved = savedLog({ logType: 'FROM_PREPPED', preppedMealId: 'prep-1' });
		(createLog as Mock).mockResolvedValue(saved);

		await logMeal({
			kind: 'fromPrepped',
			preppedMeal: { id: 'prep-1', name: 'Chili' },
			slot: 'DINNER',
			servings: 2
		});

		expect(optimisticConsumePortions).toHaveBeenCalledWith('prep-1', 2, {
			triggeredBy: saved.id
		});
	});

	it('keeps the log and sets a notice when portion consumption fails (FR-TL-014)', async () => {
		expect.hasAssertions();
		const saved = savedLog({ logType: 'FROM_PREPPED', preppedMealId: 'prep-1' });
		(createLog as Mock).mockResolvedValue(saved);
		(optimisticConsumePortions as Mock).mockRejectedValue(new Error('offline'));

		const result = await logMeal({
			kind: 'fromPrepped',
			preppedMeal: { id: 'prep-1', name: 'Chili' },
			slot: null
		});

		expect(result).toEqual(saved);
		expect(todayLogs()).toContainEqual(saved);
		expect(logNotice()).toContain('Logged!');
		expect(logError()).toBeNull();
	});

	it('flips the planned meal and reflects it locally (FR-TL-010)', async () => {
		expect.hasAssertions();
		const meal = plannedMeal();
		const saved = savedLog({ logType: 'FROM_PLAN', plannedMealId: meal.id });
		(createLog as Mock).mockResolvedValue(saved);

		await logMeal({ kind: 'fromPlan', plannedMeal: meal });

		expect(markPlannedMealLogged).toHaveBeenCalledWith(meal.id, saved.loggedAt);
		expect(markMealLoggedLocally).toHaveBeenCalledWith(meal.id);
		expect(optimisticConsumePortions).not.toHaveBeenCalled();
	});

	it('logging a prepped-backed planned meal also draws down the ledger (INV-XD-003)', async () => {
		expect.hasAssertions();
		const meal = plannedMeal({ source: 'PREPPED', preppedMealId: 'prep-9', servings: 2 });
		const saved = savedLog({
			logType: 'FROM_PLAN',
			plannedMealId: meal.id,
			preppedMealId: 'prep-9',
			servings: 2
		});
		(createLog as Mock).mockResolvedValue(saved);

		await logMeal({ kind: 'fromPlan', plannedMeal: meal });

		expect(optimisticConsumePortions).toHaveBeenCalledWith('prep-9', 2, {
			triggeredBy: saved.id
		});
	});

	it('guards against a rapid double tap — one log per source (FR-TL-013)', async () => {
		expect.hasAssertions();
		const meal = plannedMeal();
		let release!: (v: MealLog) => void;
		(createLog as Mock).mockImplementation(
			() => new Promise<MealLog>((resolve) => (release = resolve))
		);

		const first = logMeal({ kind: 'fromPlan', plannedMeal: meal });
		const second = logMeal({ kind: 'fromPlan', plannedMeal: meal });

		release(savedLog({ logType: 'FROM_PLAN', plannedMealId: meal.id }));
		const [a, b] = await Promise.all([first, second]);

		expect(createLog).toHaveBeenCalledTimes(1);
		expect(b).toBeNull();
		expect(a).not.toBeNull();
	});
});

describe('logStore.rateLog', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		await resetStore();
	});

	it('applies the verdict optimistically and reconciles', async () => {
		expect.hasAssertions();
		const saved = savedLog({ logType: 'CUSTOM', nameSnapshot: 'Chili' });
		(createLog as Mock).mockResolvedValue(saved);
		await logMeal({ kind: 'custom', name: 'Chili', slot: null });
		(setVerdict as Mock).mockResolvedValue({ ...saved, verdict: 'KEEP' });

		await rateLog(saved.id, 'KEEP');

		expect(setVerdict).toHaveBeenCalledWith(saved.id, 'KEEP');
		expect(todayLogs().find((l) => l.id === saved.id)?.verdict).toBe('KEEP');
	});

	it('rolls the verdict back when the save fails', async () => {
		expect.hasAssertions();
		const saved = savedLog({ logType: 'CUSTOM', nameSnapshot: 'Chili' });
		(createLog as Mock).mockResolvedValue(saved);
		await logMeal({ kind: 'custom', name: 'Chili', slot: null });
		(setVerdict as Mock).mockRejectedValue(new Error("We couldn't save that."));

		await rateLog(saved.id, 'REST');

		expect(todayLogs().find((l) => l.id === saved.id)?.verdict).toBeNull();
		expect(logError()).toBe("We couldn't save that.");
	});
});
