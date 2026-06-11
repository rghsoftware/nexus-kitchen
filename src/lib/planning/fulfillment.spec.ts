import { describe, expect, it } from 'vitest';
import {
	buildPantryNameIndex,
	deriveFulfillment,
	normalizeName,
	type FulfillmentInputs,
	type IngredientForMatch
} from './fulfillment';
import type { PlannedMeal, PlannedMealSource, PlannedMealStatus } from './types';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function meal(overrides: Partial<PlannedMeal> & { source: PlannedMealSource }): PlannedMeal {
	return {
		id: 'pm-1',
		mealPlanId: 'plan-1',
		date: '2026-06-11',
		mealSlot: 'DINNER',
		recipeId: null,
		recipeTitleSnapshot: null,
		preppedMealId: null,
		preppedNameSnapshot: null,
		storeBoughtName: null,
		quickMealName: null,
		servings: 1,
		status: 'PLANNED',
		sortOrder: 0,
		createdAt: '',
		updatedAt: '',
		...overrides
	};
}

function ingredient(overrides: Partial<IngredientForMatch> & { name: string }): IngredientForMatch {
	return { id: `ing-${overrides.name}`, isOptional: false, substituteFor: null, ...overrides };
}

function inputs(overrides: Partial<FulfillmentInputs> = {}): FulfillmentInputs {
	return {
		pantryIndex: new Set<string>(),
		preppedById: new Map(),
		ingredientsByRecipeId: new Map(),
		...overrides
	};
}

const recipeMeal = meal({ source: 'RECIPE', recipeId: 'r-1', recipeTitleSnapshot: 'Beans & rice' });

function recipeInputs(ingredients: IngredientForMatch[], pantryNames: string[]): FulfillmentInputs {
	return inputs({
		pantryIndex: new Set(pantryNames.map(normalizeName)),
		ingredientsByRecipeId: new Map([['r-1', ingredients]])
	});
}

// ---------------------------------------------------------------------------
// Not fulfillment-tracked
// ---------------------------------------------------------------------------

describe('deriveFulfillment — not tracked', () => {
	it('returns null for QUICK meals (FR-FS-002)', () => {
		expect(deriveFulfillment(meal({ source: 'QUICK', quickMealName: 'Takeout' }), inputs())).toBe(
			null
		);
	});

	it.each<PlannedMealStatus>(['LOGGED', 'SKIPPED', 'SWAPPED'])(
		'returns null for %s meals — requirement already resolved',
		(status) => {
			expect(deriveFulfillment(meal({ ...recipeMeal, status }), inputs())).toBe(null);
		}
	);

	it('returns null for RECIPE meals while ingredients are not fetched (FR-FS-009)', () => {
		const result = deriveFulfillment(recipeMeal, inputs({ ingredientsByRecipeId: null }));
		expect(result).toBe(null);
	});
});

// ---------------------------------------------------------------------------
// PREPPED → HAVE_IT / MUST_ACQUIRE
// ---------------------------------------------------------------------------

describe('deriveFulfillment — PREPPED', () => {
	const prepped = meal({ source: 'PREPPED', preppedMealId: 'pp-1', preppedNameSnapshot: 'Chili' });

	it('is HAVE_IT while the referenced portion has portions remaining', () => {
		const result = deriveFulfillment(
			prepped,
			inputs({ preppedById: new Map([['pp-1', { portionsRemaining: 2 }]]) })
		);
		expect(result).toEqual({ state: 'HAVE_IT', missingIngredients: [] });
	});

	it('is MUST_ACQUIRE when the portion is exhausted', () => {
		const result = deriveFulfillment(
			prepped,
			inputs({ preppedById: new Map([['pp-1', { portionsRemaining: 0 }]]) })
		);
		expect(result?.state).toBe('MUST_ACQUIRE');
	});

	it('is MUST_ACQUIRE when the referenced portion was deleted (id nulled, FR-FS-011)', () => {
		const orphaned = meal({ source: 'PREPPED', preppedNameSnapshot: 'Chili' });
		expect(deriveFulfillment(orphaned, inputs())?.state).toBe('MUST_ACQUIRE');
	});

	it('is MUST_ACQUIRE when the portion id is unknown to the inventory', () => {
		expect(deriveFulfillment(prepped, inputs())?.state).toBe('MUST_ACQUIRE');
	});
});

// ---------------------------------------------------------------------------
// STORE_BOUGHT → always MUST_ACQUIRE
// ---------------------------------------------------------------------------

describe('deriveFulfillment — STORE_BOUGHT', () => {
	it('is always MUST_ACQUIRE (the buy-gap)', () => {
		const sb = meal({ source: 'STORE_BOUGHT', storeBoughtName: 'Frozen lasagna' });
		expect(deriveFulfillment(sb, inputs())?.state).toBe('MUST_ACQUIRE');
	});
});

// ---------------------------------------------------------------------------
// RECIPE → CAN_MAKE_IT / MUST_ACQUIRE
// ---------------------------------------------------------------------------

describe('deriveFulfillment — RECIPE', () => {
	it('is CAN_MAKE_IT when every required ingredient is on hand', () => {
		const result = deriveFulfillment(
			recipeMeal,
			recipeInputs(
				[ingredient({ name: 'Rice' }), ingredient({ name: 'Black beans' })],
				['Rice', 'Black beans']
			)
		);
		expect(result).toEqual({ state: 'CAN_MAKE_IT', missingIngredients: [] });
	});

	it('is MUST_ACQUIRE listing the missing required ingredients by name', () => {
		const result = deriveFulfillment(
			recipeMeal,
			recipeInputs(
				[
					ingredient({ name: 'Rice' }),
					ingredient({ name: 'Chicken thighs' }),
					ingredient({ name: 'Coconut milk' })
				],
				['Rice']
			)
		);
		expect(result?.state).toBe('MUST_ACQUIRE');
		expect(result?.missingIngredients).toEqual(['Chicken thighs', 'Coconut milk']);
	});

	it('matches names case- and whitespace-insensitively (clarified matching rule)', () => {
		const result = deriveFulfillment(
			recipeMeal,
			recipeInputs([ingredient({ name: '  Black   Beans ' })], ['black beans'])
		);
		expect(result?.state).toBe('CAN_MAKE_IT');
	});

	it('ignores missing optional ingredients', () => {
		const result = deriveFulfillment(
			recipeMeal,
			recipeInputs(
				[ingredient({ name: 'Rice' }), ingredient({ name: 'Cilantro', isOptional: true })],
				['Rice']
			)
		);
		expect(result?.state).toBe('CAN_MAKE_IT');
	});

	it('treats a substitute on hand as satisfying its base ingredient', () => {
		const base = ingredient({ id: 'ing-base', name: 'Butter' });
		const sub = ingredient({ id: 'ing-sub', name: 'Margarine', substituteFor: 'ing-base' });
		const result = deriveFulfillment(recipeMeal, recipeInputs([base, sub], ['Margarine']));
		expect(result?.state).toBe('CAN_MAKE_IT');
	});

	it('does not require substitute rows themselves', () => {
		const base = ingredient({ id: 'ing-base', name: 'Butter' });
		const sub = ingredient({ id: 'ing-sub', name: 'Margarine', substituteFor: 'ing-base' });
		const result = deriveFulfillment(recipeMeal, recipeInputs([base, sub], ['Butter']));
		expect(result?.state).toBe('CAN_MAKE_IT');
	});

	it('is MUST_ACQUIRE when the recipe has no ingredients on record (cannot verify)', () => {
		expect(deriveFulfillment(recipeMeal, recipeInputs([], []))?.state).toBe('MUST_ACQUIRE');
	});

	it('is MUST_ACQUIRE when the recipe was deleted (recipeId null, FR-PL-019)', () => {
		const orphaned = meal({ source: 'RECIPE', recipeTitleSnapshot: 'Gone recipe' });
		expect(deriveFulfillment(orphaned, inputs())?.state).toBe('MUST_ACQUIRE');
	});
});

// ---------------------------------------------------------------------------
// Pantry index
// ---------------------------------------------------------------------------

describe('buildPantryNameIndex', () => {
	it('indexes normalized names of items with quantity > 0 only', () => {
		const index = buildPantryNameIndex([
			{ name: '  Black   Beans ', quantity: 2 },
			{ name: 'Rice', quantity: '1.5' },
			{ name: 'Empty jar', quantity: 0 }
		]);
		expect(index).toEqual(new Set(['black beans', 'rice']));
	});
});
