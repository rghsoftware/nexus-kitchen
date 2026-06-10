import { describe, it, expect } from 'vitest';
import { scaleFactor, scaleQuantity, scaleIngredients } from './recipeScaling';
import type { RecipeIngredient } from './types';

function ing(partial: Partial<RecipeIngredient> & { quantity: number }): RecipeIngredient {
	return {
		id: 'i1',
		recipeId: 'r1',
		ingredientId: null,
		name: 'flour',
		unit: 'cup',
		preparation: null,
		isOptional: false,
		substituteFor: null,
		sortOrder: 0,
		...partial
	};
}

describe('scaleFactor', () => {
	it('is 1 when base equals target', () => {
		expect(scaleFactor(4, 4)).toBe(1);
	});

	it('doubles when target is twice the base', () => {
		expect(scaleFactor(2, 4)).toBe(2);
	});

	it('halves when target is half the base', () => {
		expect(scaleFactor(4, 2)).toBe(0.5);
	});

	it('guards against non-positive base servings', () => {
		expect(scaleFactor(0, 4)).toBe(1);
	});

	it('returns 0 for non-positive target servings', () => {
		expect(scaleFactor(4, 0)).toBe(0);
	});
});

describe('scaleQuantity', () => {
	it('rounds to at most two decimals', () => {
		expect(scaleQuantity(1, 1 / 3)).toBe(0.33);
	});

	it('scales whole numbers exactly', () => {
		expect(scaleQuantity(2, 3)).toBe(6);
	});
});

describe('scaleIngredients', () => {
	it('scales displayQuantity without mutating the source quantity (SC-006)', () => {
		const source = [
			ing({ quantity: 2, name: 'flour' }),
			ing({ id: 'i2', quantity: 1, name: 'salt' })
		];
		const scaled = scaleIngredients(source, 2, 4);

		expect(scaled[0].displayQuantity).toBe(4);
		expect(scaled[1].displayQuantity).toBe(2);
		// originals untouched
		expect(source[0].quantity).toBe(2);
		expect(source[1].quantity).toBe(1);
		// returns new objects
		expect(scaled[0]).not.toBe(source[0]);
	});

	it('returns same display values when servings unchanged', () => {
		const source = [ing({ quantity: 1.5 })];
		const scaled = scaleIngredients(source, 4, 4);
		expect(scaled[0].displayQuantity).toBe(1.5);
	});
});
