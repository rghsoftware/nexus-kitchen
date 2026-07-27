import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { PlannedMeal } from '$lib/planning/types';
import {
	LogError,
	createLog,
	draftColumns,
	fetchLogsBetween,
	fetchRecentLogs,
	markPlannedMealLogged,
	setVerdict
} from './logService';

vi.mock('$lib/supabaseClient', () => ({
	supabase: { from: vi.fn() }
}));
vi.mock('$lib/session/session.svelte', () => ({
	currentUser: vi.fn().mockResolvedValue({ id: 'user-1' })
}));

import { supabase } from '$lib/supabaseClient';

// Chainable mock builder — thenable so plain `await builder` works too
function makeChain(result: { data: unknown; error: unknown }) {
	const chain: Record<string, unknown> = {};
	const methods = ['select', 'order', 'insert', 'update', 'eq', 'neq', 'gte', 'lt', 'limit'];
	for (const m of methods) {
		chain[m] = vi.fn().mockReturnValue(chain);
	}
	chain.single = vi.fn().mockResolvedValue(result);
	chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
	return chain;
}

function makeLogRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 'log-1',
		owner_id: 'user-1',
		household_id: null,
		log_type: 'QUICK_LOG',
		planned_meal_id: null,
		recipe_id: null,
		prepped_meal_id: null,
		name_snapshot: null,
		meal_slot: 'SNACK',
		servings: '1',
		logged_at: '2026-07-09T12:00:00Z',
		verdict: null,
		notes: null,
		created_at: '2026-07-09T12:00:00Z',
		updated_at: '2026-07-09T12:00:00Z',
		...overrides
	};
}

function plannedMeal(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
	return {
		id: 'pm-1',
		mealPlanId: 'plan-1',
		date: '2026-07-09',
		mealSlot: 'LUNCH',
		source: 'PREPPED',
		recipeId: null,
		recipeTitleSnapshot: null,
		preppedMealId: 'prep-1',
		preppedNameSnapshot: 'Marinara pasta',
		storeBoughtName: null,
		quickMealName: null,
		servings: 2,
		status: 'PLANNED',
		sortOrder: 0,
		createdAt: '2026-07-09T00:00:00Z',
		updatedAt: '2026-07-09T00:00:00Z',
		...overrides
	};
}

describe('draftColumns', () => {
	it('maps a fromPlan draft with snapshot, slot, servings and refs', () => {
		expect(draftColumns({ kind: 'fromPlan', plannedMeal: plannedMeal() })).toEqual({
			log_type: 'FROM_PLAN',
			planned_meal_id: 'pm-1',
			recipe_id: null,
			prepped_meal_id: 'prep-1',
			name_snapshot: 'Marinara pasta',
			meal_slot: 'LUNCH',
			servings: 2,
			verdict: null
		});
	});

	it('maps fromPrepped with default servings 1', () => {
		expect(
			draftColumns({
				kind: 'fromPrepped',
				preppedMeal: { id: 'prep-2', name: 'Chili' },
				slot: 'DINNER'
			})
		).toMatchObject({ log_type: 'FROM_PREPPED', prepped_meal_id: 'prep-2', servings: 1 });
	});

	it('maps a bare quick log with no name and carries a log-time verdict', () => {
		expect(draftColumns({ kind: 'quick', slot: 'SNACK', verdict: 'FINE' })).toEqual({
			log_type: 'QUICK_LOG',
			meal_slot: 'SNACK',
			verdict: 'FINE'
		});
	});

	it('maps custom and fromRecipe names', () => {
		expect(draftColumns({ kind: 'custom', name: 'Takeout', slot: null })).toMatchObject({
			log_type: 'CUSTOM',
			name_snapshot: 'Takeout'
		});
		expect(
			draftColumns({ kind: 'fromRecipe', recipeId: 'r-1', name: 'Lentil curry', slot: 'DINNER' })
		).toMatchObject({ log_type: 'FROM_RECIPE', recipe_id: 'r-1', name_snapshot: 'Lentil curry' });
	});
});

describe('logService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('createLog', () => {
		it('inserts the draft columns with the given logged_at and maps the row', async () => {
			expect.hasAssertions();
			const chain = makeChain({ data: makeLogRow(), error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			const saved = await createLog({ kind: 'quick', slot: 'SNACK' }, '2026-07-09T12:00:00Z');

			expect(supabase.from).toHaveBeenCalledWith('meal_logs');
			expect(chain.insert).toHaveBeenCalledWith(
				expect.objectContaining({ log_type: 'QUICK_LOG', logged_at: '2026-07-09T12:00:00Z' })
			);
			expect(saved.servings).toBe(1); // numeric string coerced
			expect(saved.logType).toBe('QUICK_LOG');
		});

		it('throws a calm LogError on failure', async () => {
			expect.hasAssertions();
			const chain = makeChain({ data: null, error: { message: 'boom' } });
			(supabase.from as Mock).mockReturnValue(chain);

			await expect(createLog({ kind: 'quick', slot: null })).rejects.toBeInstanceOf(LogError);
		});
	});

	describe('setVerdict', () => {
		it('updates only the verdict column (annotation window)', async () => {
			expect.hasAssertions();
			const chain = makeChain({ data: makeLogRow({ verdict: 'KEEP' }), error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			const saved = await setVerdict('log-1', 'KEEP');

			expect(chain.update).toHaveBeenCalledWith({ verdict: 'KEEP' });
			expect(chain.eq).toHaveBeenCalledWith('id', 'log-1');
			expect(saved.verdict).toBe('KEEP');
		});
	});

	describe('fetchLogsBetween', () => {
		it('queries the half-open window, newest first', async () => {
			expect.hasAssertions();
			const chain = makeChain({ data: [makeLogRow()], error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			const logs = await fetchLogsBetween('2026-07-09T05:00:00Z', '2026-07-10T05:00:00Z');

			expect(chain.gte).toHaveBeenCalledWith('logged_at', '2026-07-09T05:00:00Z');
			expect(chain.lt).toHaveBeenCalledWith('logged_at', '2026-07-10T05:00:00Z');
			expect(logs).toHaveLength(1);
		});
	});

	describe('fetchRecentLogs', () => {
		it('excludes bare quick logs and limits', async () => {
			expect.hasAssertions();
			const chain = makeChain({ data: [], error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			await fetchRecentLogs(50);

			expect(chain.neq).toHaveBeenCalledWith('log_type', 'QUICK_LOG');
			expect(chain.limit).toHaveBeenCalledWith(50);
		});
	});

	describe('markPlannedMealLogged', () => {
		it('safe-flips only PLANNED meals and reports success', async () => {
			expect.hasAssertions();
			const chain = makeChain({ data: [{ id: 'pm-1' }], error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			const flipped = await markPlannedMealLogged('pm-1', '2026-07-09T12:00:00Z');

			expect(supabase.from).toHaveBeenCalledWith('planned_meals');
			expect(chain.update).toHaveBeenCalledWith({
				status: 'LOGGED',
				logged_at: '2026-07-09T12:00:00Z'
			});
			expect(chain.eq).toHaveBeenCalledWith('status', 'PLANNED');
			expect(flipped).toBe(true);
		});

		it('reports false when another writer already flipped it', async () => {
			expect.hasAssertions();
			const chain = makeChain({ data: [], error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			await expect(markPlannedMealLogged('pm-1', '2026-07-09T12:00:00Z')).resolves.toBe(false);
		});
	});
});
