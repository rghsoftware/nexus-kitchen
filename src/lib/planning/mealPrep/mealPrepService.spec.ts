import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import {
	addRecipe,
	cancelSession,
	completeSession,
	createSession,
	MealPrepServiceError,
	removeRecipe,
	updateServings
} from './mealPrepService';

vi.mock('$lib/supabaseClient', () => ({
	supabase: { from: vi.fn() }
}));

vi.mock('$lib/pantry/preppedMealService', () => ({
	addPreppedMeal: vi.fn().mockResolvedValue({ id: 'pp-new' })
}));

vi.mock('$lib/session/session.svelte', () => ({
	currentUser: vi.fn().mockResolvedValue({ id: 'user-1' })
}));

import { supabase } from '$lib/supabaseClient';
import { addPreppedMeal } from '$lib/pantry/preppedMealService';

// ---------------------------------------------------------------------------
// Per-table mock dispatch. Each table maps to a thenable/terminal chain whose
// result can be set per test. Chains record nothing beyond returning configured data.
// ---------------------------------------------------------------------------

type Result = { data: unknown; error: unknown };

function chainFor(result: Result) {
	const chain: Record<string, unknown> = {};
	for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) {
		chain[m] = vi.fn().mockReturnValue(chain);
	}
	chain.single = vi.fn().mockResolvedValue(result);
	chain.maybeSingle = vi.fn().mockResolvedValue(result);
	chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
	return chain;
}

/** today + offset days, ISO date. */
function isoDay(offset = 0): string {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + offset);
	return d.toISOString().slice(0, 10);
}

function sessionRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 'sess-1',
		status: 'PLANNED',
		prep_day: isoDay(1),
		completed_at: null,
		meal_prep_session_recipes: [
			{ id: 'sr-1', recipe_id: 'r-1', recipe_name: 'Chili', servings_to_prep: 3 },
			{ id: 'sr-2', recipe_id: 'r-2', recipe_name: 'Oats', servings_to_prep: 2 }
		],
		...overrides
	};
}

/** Configure supabase.from to return the given result for each table name. */
function mockTables(byTable: Record<string, Result>) {
	(supabase.from as Mock).mockImplementation((table: string) =>
		chainFor(byTable[table] ?? { data: null, error: null })
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	(addPreppedMeal as Mock).mockResolvedValue({ id: 'pp-new' });
});

describe('createSession — validation (INV-PL-006/007)', () => {
	it('rejects a session with zero recipes', async () => {
		await expect(createSession({ prepDay: isoDay(1), recipes: [] })).rejects.toBeInstanceOf(
			MealPrepServiceError
		);
		expect(supabase.from).not.toHaveBeenCalled();
	});

	it('rejects non-positive servings', async () => {
		await expect(
			createSession({
				prepDay: isoDay(1),
				recipes: [{ recipeId: 'r-1', recipeName: 'Chili', servingsToPrep: 0 }]
			})
		).rejects.toThrow(/greater than zero/);
	});

	it('rejects a prep day in the past', async () => {
		await expect(
			createSession({
				prepDay: isoDay(-1),
				recipes: [{ recipeId: 'r-1', recipeName: 'Chili', servingsToPrep: 3 }]
			})
		).rejects.toThrow(/past/);
	});
});

describe('addRecipe / updateServings — validation', () => {
	it('addRecipe rejects non-positive servings', async () => {
		await expect(
			addRecipe('sess-1', { recipeId: 'r-9', recipeName: 'Soup', servingsToPrep: -1 })
		).rejects.toThrow(/greater than zero/);
	});

	it('updateServings rejects non-positive servings', async () => {
		await expect(updateServings('sr-1', 0)).rejects.toThrow(/greater than zero/);
	});
});

describe('removeRecipe — keeps at least one recipe (INV-PL-006)', () => {
	it('rejects removing the last recipe', async () => {
		mockTables({
			meal_prep_sessions: {
				data: sessionRow({
					meal_prep_session_recipes: [
						{ id: 'sr-1', recipe_id: 'r-1', recipe_name: 'Chili', servings_to_prep: 3 }
					]
				}),
				error: null
			}
		});
		await expect(removeRecipe('sess-1', 'sr-1')).rejects.toThrow(/at least one recipe/);
	});
});

describe('completeSession — yield to inventory (FR-PP-014/015)', () => {
	it('yields one prepped portion per recipe then marks the session complete', async () => {
		mockTables({
			meal_prep_sessions: { data: sessionRow(), error: null },
			prepped_meals: { data: [], error: null } // no existing yield
		});

		await completeSession('sess-1', [
			{ sessionRecipeId: 'sr-1', storageLocation: 'FREEZER' },
			{ sessionRecipeId: 'sr-2', storageLocation: 'FRIDGE' }
		]);

		expect(addPreppedMeal).toHaveBeenCalledTimes(2);
		// Chili → freezer, FROZEN, portions from servings_to_prep
		expect(addPreppedMeal).toHaveBeenCalledWith(
			expect.objectContaining({
				origin: 'PREP_SESSION',
				recipe_id: 'r-1',
				recipe_name: 'Chili',
				meal_prep_session_id: 'sess-1',
				original_portions: 3,
				portions_remaining: 3,
				storage_location: 'FREEZER',
				defrost_state: 'FROZEN'
			})
		);
		// Oats → fridge, not applicable
		expect(addPreppedMeal).toHaveBeenCalledWith(
			expect.objectContaining({
				recipe_name: 'Oats',
				storage_location: 'FRIDGE',
				defrost_state: 'NOT_APPLICABLE',
				original_portions: 2
			})
		);
	});

	it('is idempotent — does not yield again when portions already exist for the session', async () => {
		mockTables({
			meal_prep_sessions: {
				data: sessionRow({ status: 'COMPLETED', completed_at: isoDay() }),
				error: null
			},
			prepped_meals: { data: [{ id: 'pp-existing' }], error: null } // already yielded
		});

		await completeSession('sess-1');

		expect(addPreppedMeal).not.toHaveBeenCalled();
	});
});

describe('cancelSession', () => {
	it('does not create any prepped portions', async () => {
		mockTables({ meal_prep_sessions: { data: sessionRow({ status: 'CANCELLED' }), error: null } });
		await cancelSession('sess-1');
		expect(addPreppedMeal).not.toHaveBeenCalled();
	});
});
