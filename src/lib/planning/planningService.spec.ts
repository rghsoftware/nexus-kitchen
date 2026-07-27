import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
	PlanningError,
	addPlannedMeal,
	getOrCreatePlanForWeek,
	listPlannedMeals,
	movePlannedMeal,
	removePlannedMeal,
	updatePlannedMeal
} from './planningService';

vi.mock('$lib/supabaseClient', () => ({
	supabase: { from: vi.fn() }
}));
vi.mock('$lib/session/session.svelte', () => ({
	currentUser: vi.fn().mockResolvedValue({ id: 'user-1' })
}));

// Import mocked supabase after vi.mock is hoisted
import { supabase } from '$lib/supabaseClient';
import { currentUser } from '$lib/session/session.svelte';

// ---------------------------------------------------------------------------
// Chainable mock builder — thenable so plain `await builder` works too
// ---------------------------------------------------------------------------

type ChainResult = { data: unknown; error: unknown };

function makeChain(result: ChainResult) {
	const chain: Record<string, Mock> = {};
	const methods = [
		'select',
		'order',
		'insert',
		'update',
		'delete',
		'eq',
		'gte',
		'lte',
		'is',
		'limit',
		'upsert'
	];
	for (const m of methods) {
		chain[m] = vi.fn().mockReturnValue(chain);
	}
	chain.single = vi.fn().mockResolvedValue(result);
	chain.maybeSingle = vi.fn().mockResolvedValue(result);
	(chain as Record<string, unknown>).then = (resolve: (v: unknown) => unknown) =>
		Promise.resolve(result).then(resolve);
	return chain;
}

function makePlanRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 'plan-1',
		owner_id: 'user-1',
		household_id: null,
		name: null,
		start_date: '2026-06-08',
		end_date: '2026-06-14',
		created_at: '2026-06-01T00:00:00Z',
		updated_at: '2026-06-01T00:00:00Z',
		...overrides
	};
}

function makeMealRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 'meal-1',
		meal_plan_id: 'plan-1',
		date: '2026-06-10',
		meal_slot: 'DINNER',
		source: 'RECIPE',
		recipe_id: 'recipe-1',
		recipe_title_snapshot: 'Chicken Stir Fry',
		prepped_meal_id: null,
		prepped_name_snapshot: null,
		store_bought_name: null,
		quick_meal_name: null,
		servings: 2,
		status: 'PLANNED',
		logged_at: null,
		sort_order: 0,
		created_at: '2026-06-01T00:00:00Z',
		updated_at: '2026-06-01T00:00:00Z',
		...overrides
	};
}

const fromMock = supabase.from as Mock;

describe('planningService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(currentUser as Mock).mockResolvedValue({ id: 'user-1' });
	});

	describe('getOrCreatePlanForWeek', () => {
		it('upserts the Monday-start week on (owner_id, start_date)', async () => {
			const chain = makeChain({ data: makePlanRow(), error: null });
			fromMock.mockReturnValue(chain);

			const plan = await getOrCreatePlanForWeek('2026-06-10'); // a Wednesday

			expect(fromMock).toHaveBeenCalledWith('meal_plans');
			expect(chain.upsert).toHaveBeenCalledWith(
				{ start_date: '2026-06-08', end_date: '2026-06-14' },
				{ onConflict: 'owner_id,start_date' }
			);
			expect(plan.startDate).toBe('2026-06-08');
			expect(plan.endDate).toBe('2026-06-14');
		});

		it('throws PlanningError when the session cannot start', async () => {
			(currentUser as Mock).mockResolvedValue(null);
			await expect(getOrCreatePlanForWeek('2026-06-10')).rejects.toBeInstanceOf(PlanningError);
		});
	});

	describe('listPlannedMeals', () => {
		it('queries the range and maps rows, ordering Anytime last within a date', async () => {
			const chain = makeChain({ data: [makeMealRow()], error: null });
			fromMock.mockReturnValue(chain);

			const meals = await listPlannedMeals('2026-06-08', '2026-06-14');

			expect(fromMock).toHaveBeenCalledWith('planned_meals');
			expect(chain.gte).toHaveBeenCalledWith('date', '2026-06-08');
			expect(chain.lte).toHaveBeenCalledWith('date', '2026-06-14');
			expect(chain.order).toHaveBeenCalledWith('meal_slot', { nullsFirst: false });
			expect(meals).toHaveLength(1);
			expect(meals[0].recipeTitleSnapshot).toBe('Chicken Stir Fry');
			expect(meals[0].servings).toBe(2);
		});

		it('wraps PostgREST errors in PlanningError', async () => {
			fromMock.mockReturnValue(makeChain({ data: null, error: { message: 'boom' } }));
			await expect(listPlannedMeals('2026-06-08', '2026-06-14')).rejects.toBeInstanceOf(
				PlanningError
			);
		});
	});

	describe('addPlannedMeal', () => {
		function setupAddChains(insertResults: ChainResult[], maxSort: number | null = null) {
			const planChain = makeChain({ data: makePlanRow(), error: null });
			const chains: Record<string, Mock>[] = [planChain];
			for (const r of insertResults) {
				const sortChain = makeChain({
					data: maxSort === null ? [] : [{ sort_order: maxSort }],
					error: null
				});
				const insertChain = makeChain(r);
				chains.push(sortChain, insertChain);
			}
			for (const c of chains) fromMock.mockReturnValueOnce(c);
			return chains;
		}

		it('inserts an exclusive RECIPE payload with snapshot and appended sort order', async () => {
			const row = makeMealRow({ sort_order: 3 });
			const [, , insertChain] = setupAddChains([{ data: row, error: null }], 2);

			const meal = await addPlannedMeal(
				{ source: 'RECIPE', recipeId: 'recipe-1', recipeTitle: 'Chicken Stir Fry', servings: 2 },
				{ date: '2026-06-10', mealSlot: 'DINNER' }
			);

			expect(insertChain.insert).toHaveBeenCalledWith({
				meal_plan_id: 'plan-1',
				date: '2026-06-10',
				meal_slot: 'DINNER',
				servings: 2,
				sort_order: 3,
				source: 'RECIPE',
				recipe_id: 'recipe-1',
				recipe_title_snapshot: 'Chicken Stir Fry'
			});
			expect(meal.sortOrder).toBe(3);
		});

		it('inserts an exclusive STORE_BOUGHT payload', async () => {
			const row = makeMealRow({
				source: 'STORE_BOUGHT',
				recipe_id: null,
				recipe_title_snapshot: null,
				store_bought_name: 'Frozen lasagna'
			});
			const [, , insertChain] = setupAddChains([{ data: row, error: null }]);

			await addPlannedMeal(
				{ source: 'STORE_BOUGHT', storeBoughtName: 'Frozen lasagna', servings: 1 },
				{ date: '2026-06-12', mealSlot: null }
			);

			const payload = insertChain.insert.mock.calls[0][0];
			expect(payload.source).toBe('STORE_BOUGHT');
			expect(payload.store_bought_name).toBe('Frozen lasagna');
			expect(payload.recipe_id).toBeUndefined();
			expect(payload.quick_meal_name).toBeUndefined();
			expect(payload.meal_slot).toBeNull();
			expect(payload.sort_order).toBe(0); // empty group appends at 0
		});

		it('inserts an exclusive QUICK payload', async () => {
			const row = makeMealRow({
				source: 'QUICK',
				recipe_id: null,
				recipe_title_snapshot: null,
				quick_meal_name: 'Takeout'
			});
			const [, , insertChain] = setupAddChains([{ data: row, error: null }]);

			await addPlannedMeal(
				{ source: 'QUICK', quickMealName: 'Takeout', servings: 1 },
				{ date: '2026-06-13', mealSlot: 'DINNER' }
			);

			const payload = insertChain.insert.mock.calls[0][0];
			expect(payload.source).toBe('QUICK');
			expect(payload.quick_meal_name).toBe('Takeout');
			expect(payload.store_bought_name).toBeUndefined();
		});

		it('inserts an exclusive PREPPED payload with name snapshot (FR-FS-010, INV-PL-003)', async () => {
			const row = makeMealRow({
				source: 'PREPPED',
				recipe_id: null,
				recipe_title_snapshot: null,
				prepped_meal_id: 'prepped-1',
				prepped_name_snapshot: 'Chili'
			});
			const [, , insertChain] = setupAddChains([{ data: row, error: null }]);

			const meal = await addPlannedMeal(
				{ source: 'PREPPED', preppedMealId: 'prepped-1', preppedName: 'Chili', servings: 1 },
				{ date: '2026-06-11', mealSlot: 'LUNCH' }
			);

			const payload = insertChain.insert.mock.calls[0][0];
			expect(payload.source).toBe('PREPPED');
			expect(payload.prepped_meal_id).toBe('prepped-1');
			expect(payload.prepped_name_snapshot).toBe('Chili');
			expect(payload.recipe_id).toBeUndefined();
			expect(payload.store_bought_name).toBeUndefined();
			expect(payload.quick_meal_name).toBeUndefined();
			expect(meal.preppedMealId).toBe('prepped-1');
			expect(meal.preppedNameSnapshot).toBe('Chili');
		});

		it('retries once when a concurrent writer takes the sort position (23505)', async () => {
			const row = makeMealRow();
			setupAddChains(
				[
					{ data: null, error: { code: '23505', message: 'duplicate key' } },
					{ data: row, error: null }
				],
				0
			);

			const meal = await addPlannedMeal(
				{ source: 'QUICK', quickMealName: 'Leftovers', servings: 1 },
				{ date: '2026-06-10', mealSlot: 'LUNCH' }
			);

			expect(meal.id).toBe('meal-1');
			// plan upsert + (sort + insert) x 2 attempts
			expect(fromMock).toHaveBeenCalledTimes(5);
		});

		it('does not retry non-unique errors and throws PlanningError', async () => {
			setupAddChains([{ data: null, error: { code: '23514', message: 'check violation' } }]);

			await expect(
				addPlannedMeal(
					{ source: 'QUICK', quickMealName: 'Takeout', servings: 1 },
					{ date: '2026-06-10', mealSlot: null }
				)
			).rejects.toBeInstanceOf(PlanningError);
			expect(fromMock).toHaveBeenCalledTimes(3); // no second attempt
		});
	});

	describe('movePlannedMeal', () => {
		it('re-homes a cross-week move to the target week plan and appends', async () => {
			const targetPlan = makePlanRow({
				id: 'plan-2',
				start_date: '2026-06-15',
				end_date: '2026-06-21'
			});
			const movedRow = makeMealRow({
				meal_plan_id: 'plan-2',
				date: '2026-06-16',
				meal_slot: 'LUNCH',
				sort_order: 1
			});
			const planChain = makeChain({ data: targetPlan, error: null });
			const sortChain = makeChain({ data: [{ sort_order: 0 }], error: null });
			const updateChain = makeChain({ data: movedRow, error: null });
			fromMock
				.mockReturnValueOnce(planChain)
				.mockReturnValueOnce(sortChain)
				.mockReturnValueOnce(updateChain);

			const meal = await movePlannedMeal('meal-1', { date: '2026-06-16', mealSlot: 'LUNCH' });

			expect(planChain.upsert).toHaveBeenCalledWith(
				{ start_date: '2026-06-15', end_date: '2026-06-21' },
				{ onConflict: 'owner_id,start_date' }
			);
			expect(updateChain.update).toHaveBeenCalledWith({
				meal_plan_id: 'plan-2',
				date: '2026-06-16',
				meal_slot: 'LUNCH',
				sort_order: 1
			});
			expect(updateChain.eq).toHaveBeenCalledWith('id', 'meal-1');
			expect(meal.mealPlanId).toBe('plan-2');
		});
	});

	describe('updatePlannedMeal', () => {
		it('patches servings without touching sort order', async () => {
			const chain = makeChain({ data: makeMealRow({ servings: 4 }), error: null });
			fromMock.mockReturnValue(chain);

			const meal = await updatePlannedMeal('meal-1', { servings: 4 });

			expect(chain.update).toHaveBeenCalledWith({ servings: 4 });
			expect(meal.servings).toBe(4);
		});

		it('re-appends within the new group on slot change', async () => {
			const currentChain = makeChain({ data: makeMealRow(), error: null });
			const sortChain = makeChain({ data: [{ sort_order: 4 }], error: null });
			const updateChain = makeChain({
				data: makeMealRow({ meal_slot: 'LUNCH', sort_order: 5 }),
				error: null
			});
			fromMock
				.mockReturnValueOnce(currentChain)
				.mockReturnValueOnce(sortChain)
				.mockReturnValueOnce(updateChain);

			await updatePlannedMeal('meal-1', { mealSlot: 'LUNCH' });

			expect(updateChain.update).toHaveBeenCalledWith({ meal_slot: 'LUNCH', sort_order: 5 });
		});
	});

	describe('removePlannedMeal', () => {
		it('deletes by id', async () => {
			const chain = makeChain({ data: null, error: null });
			fromMock.mockReturnValue(chain);

			await removePlannedMeal('meal-1');

			expect(chain.delete).toHaveBeenCalled();
			expect(chain.eq).toHaveBeenCalledWith('id', 'meal-1');
		});

		it('wraps delete errors in PlanningError', async () => {
			fromMock.mockReturnValue(makeChain({ data: null, error: { message: 'boom' } }));
			await expect(removePlannedMeal('meal-1')).rejects.toBeInstanceOf(PlanningError);
		});
	});
});
