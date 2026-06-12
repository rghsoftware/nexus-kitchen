import { describe, expect, it } from 'vitest';
import type { FulfillmentInputs, IngredientForMatch } from '$lib/planning/fulfillment';
import type { PlannedMeal, PlannedMealSource, PlannedMealStatus } from '$lib/planning/types';
import { computeBuyGaps } from './generation';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

let mealCounter = 0;

function meal(overrides: Partial<PlannedMeal> & { source: PlannedMealSource }): PlannedMeal {
	return {
		id: `pm-${++mealCounter}`,
		mealPlanId: 'plan-1',
		date: '2026-06-12',
		mealSlot: 'DINNER',
		recipeId: null,
		recipeTitleSnapshot: null,
		preppedMealId: null,
		preppedNameSnapshot: null,
		storeBoughtName: null,
		quickMealName: null,
		servings: 1,
		status: 'PLANNED' as PlannedMealStatus,
		sortOrder: 0,
		createdAt: '',
		updatedAt: '',
		...overrides
	};
}

function recipeMeal(recipeId: string, title: string): PlannedMeal {
	return meal({ source: 'RECIPE', recipeId, recipeTitleSnapshot: title });
}

function ing(
	name: string,
	extras: Partial<IngredientForMatch> = {},
	idSuffix = name
): IngredientForMatch {
	return { id: `ri-${idSuffix}`, name, isOptional: false, substituteFor: null, ...extras };
}

function inputs(
	pantryNames: string[],
	ingredientsByRecipeId: Record<string, IngredientForMatch[]>
): FulfillmentInputs {
	return {
		pantryIndex: new Set(pantryNames),
		preppedById: new Map(),
		ingredientsByRecipeId: new Map(Object.entries(ingredientsByRecipeId))
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeBuyGaps — ingredient gaps', () => {
	it('lists missing ingredients with attribution and recipe-stated amounts', () => {
		const result = computeBuyGaps(
			[recipeMeal('r-1', 'Marinara')],
			inputs(['garlic'], {
				'r-1': [
					ing('Crushed tomatoes', { quantity: 2, unit: 'cans' }),
					ing('Garlic', { quantity: 1, unit: 'head' }),
					ing('Onions', { quantity: 4, unit: 'x' })
				]
			})
		);
		expect(result.ingredientGaps).toHaveLength(2);
		const tomatoes = result.ingredientGaps.find((g) => g.name === 'Crushed tomatoes');
		expect(tomatoes).toMatchObject({
			suggestedQuantity: 2,
			unit: 'cans',
			category: 'CANNED',
			neededFor: [{ recipeId: 'r-1', title: 'Marinara' }]
		});
	});

	it('dedupes the same ingredient across recipes, merging attribution and dropping the amount', () => {
		const result = computeBuyGaps(
			[recipeMeal('r-1', 'Marinara'), recipeMeal('r-2', 'Soup')],
			inputs([], {
				'r-1': [ing('Crushed tomatoes', { quantity: 2, unit: 'cans' }, 'a')],
				'r-2': [ing('crushed  Tomatoes', { quantity: 3, unit: 'cans' }, 'b')]
			})
		);
		expect(result.ingredientGaps).toHaveLength(1);
		expect(result.ingredientGaps[0].neededFor).toEqual([
			{ recipeId: 'r-1', title: 'Marinara' },
			{ recipeId: 'r-2', title: 'Soup' }
		]);
		// Two needing recipes → editable default, never invented summing.
		expect(result.ingredientGaps[0].suggestedQuantity).toBe(1);
		expect(result.ingredientGaps[0].unit).toBe('x');
	});

	it('skips gaps already pending on the target list (FR-SH-011)', () => {
		const result = computeBuyGaps(
			[recipeMeal('r-1', 'Marinara')],
			inputs([], { 'r-1': [ing('Onions')] }),
			new Set(['onions'])
		);
		expect(result.ingredientGaps).toHaveLength(0);
	});

	it('ignores meals that are not MUST_ACQUIRE and meals not fulfillment-tracked', () => {
		const result = computeBuyGaps(
			[
				meal({ source: 'QUICK', quickMealName: 'Takeout' }),
				meal({
					source: 'RECIPE',
					recipeId: 'r-1',
					recipeTitleSnapshot: 'Covered',
					status: 'LOGGED'
				}),
				recipeMeal('r-2', 'Makeable')
			],
			inputs(['rice'], { 'r-1': [ing('Onions')], 'r-2': [ing('Rice')] })
		);
		expect(result.ingredientGaps).toHaveLength(0);
		expect(result.storeBoughtGaps).toHaveLength(0);
	});
});

describe('computeBuyGaps — store-bought gaps', () => {
	it('emits one purchase per STORE_BOUGHT meal, carrying its planned-meal id', () => {
		const a = meal({ source: 'STORE_BOUGHT', storeBoughtName: 'Rotisserie chicken', servings: 2 });
		const b = meal({ source: 'STORE_BOUGHT', storeBoughtName: 'Sushi tray' });
		const result = computeBuyGaps([a, b], inputs([], {}));
		expect(result.storeBoughtGaps).toEqual([
			{ plannedMealId: a.id, name: 'Rotisserie chicken', servings: 2 },
			{ plannedMealId: b.id, name: 'Sushi tray', servings: 1 }
		]);
	});

	it('skips store-bought gaps already pending on the list', () => {
		const result = computeBuyGaps(
			[meal({ source: 'STORE_BOUGHT', storeBoughtName: 'Sushi tray' })],
			inputs([], {}),
			new Set(['sushi tray'])
		);
		expect(result.storeBoughtGaps).toHaveLength(0);
	});
});

describe('computeBuyGaps — empty result', () => {
	it('returns no gaps when the plan is fully covered', () => {
		const result = computeBuyGaps(
			[recipeMeal('r-1', 'Covered')],
			inputs(['onions'], { 'r-1': [ing('Onions')] })
		);
		expect(result).toEqual({ ingredientGaps: [], storeBoughtGaps: [] });
	});
});
