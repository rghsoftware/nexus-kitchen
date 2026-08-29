import { describe, expect, it } from 'vitest';
import { computePrepShoppingGap, type RecipeForPrep } from './prepShoppingList';

const chili: RecipeForPrep = {
	recipeId: 'r-1',
	recipeName: 'Chili',
	baseServings: 4,
	servingsToPrep: 8, // 2× scale
	ingredients: [
		{ name: 'Kidney beans', unit: 'g', quantity: 400, isOptional: false },
		{ name: 'Onion', unit: 'whole', quantity: 1, isOptional: false },
		{ name: 'Coriander', unit: 'g', quantity: 10, isOptional: true } // optional → never in gap
	]
};

const oats: RecipeForPrep = {
	recipeId: 'r-2',
	recipeName: 'Oats',
	baseServings: 2,
	servingsToPrep: 2, // 1× scale
	ingredients: [
		{ name: 'Oats', unit: 'g', quantity: 100, isOptional: false },
		{ name: 'Onion', unit: 'whole', quantity: 1, isOptional: false } // contrived shared item
	]
};

describe('computePrepShoppingGap (REQ-PP-019..022)', () => {
	it('scales ingredient quantities by servingsToPrep / baseServings', () => {
		const gap = computePrepShoppingGap([chili], new Set());
		const beans = gap.find((g) => g.name === 'Kidney beans');
		expect(beans?.quantity).toBe(800); // 400 × (8/4)
	});

	it('aggregates the same (name, unit) across recipes and records contributing recipes', () => {
		const gap = computePrepShoppingGap([chili, oats], new Set());
		const onion = gap.find((g) => g.name === 'Onion');
		expect(onion?.quantity).toBe(3); // chili 1×2 + oats 1×1
		expect(onion?.forRecipes.sort()).toEqual(['Chili', 'Oats']);
	});

	it('drops ingredients already on hand in the pantry (presence-by-name)', () => {
		const gap = computePrepShoppingGap([chili], new Set(['kidney beans']));
		expect(gap.find((g) => g.name === 'Kidney beans')).toBeUndefined();
		expect(gap.find((g) => g.name === 'Onion')).toBeDefined();
	});

	it('excludes optional ingredients from the gap', () => {
		const gap = computePrepShoppingGap([chili], new Set());
		expect(gap.find((g) => g.name === 'Coriander')).toBeUndefined();
	});

	it('matches pantry names case- and whitespace-insensitively', () => {
		const gap = computePrepShoppingGap([oats], new Set(['oats']));
		// "Oats" on hand → only the shared Onion remains
		expect(gap.map((g) => g.name)).toEqual(['Onion']);
	});

	it('returns an empty gap when everything is on hand', () => {
		const gap = computePrepShoppingGap([oats], new Set(['oats', 'onion']));
		expect(gap).toEqual([]);
	});
});
