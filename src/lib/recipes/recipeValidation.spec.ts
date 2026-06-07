import { describe, it, expect } from 'vitest';
import { validateRecipeInput, validateRating, isValidRecipeInput } from './recipeValidation';
import type { RecipeInput } from './types';

function validInput(overrides: Partial<RecipeInput> = {}): RecipeInput {
	return {
		title: 'Test Curry',
		servings: 4,
		ingredients: [{ name: 'chicken', quantity: 2, unit: 'lb', sortOrder: 0 }],
		steps: [{ instruction: 'Cook it', sortOrder: 0 }],
		tags: [],
		...overrides
	};
}

function fields(input: RecipeInput): string[] {
	return validateRecipeInput(input).map((e) => e.field);
}

describe('validateRecipeInput', () => {
	it('passes for a minimal valid recipe', () => {
		expect(validateRecipeInput(validInput())).toEqual([]);
		expect(isValidRecipeInput(validInput())).toBe(true);
	});

	it('requires a title (INV)', () => {
		expect(fields(validInput({ title: '   ' }))).toContain('title');
	});

	it('requires at least one ingredient (INV-RC-001)', () => {
		expect(fields(validInput({ ingredients: [] }))).toContain('ingredients');
	});

	it('requires at least one step (INV-RC-002)', () => {
		expect(fields(validInput({ steps: [] }))).toContain('steps');
	});

	it('rejects non-positive servings (INV-RC-003)', () => {
		expect(fields(validInput({ servings: 0 }))).toContain('servings');
		expect(fields(validInput({ servings: 101 }))).toContain('servings');
	});

	it('rejects non-positive ingredient quantity (INV-RC-005)', () => {
		expect(
			fields(validInput({ ingredients: [{ name: 'x', quantity: 0, unit: 'g', sortOrder: 0 }] }))
		).toContain('ingredients.0.quantity');
	});

	it('rejects active time greater than total (INV-RC-008)', () => {
		const input = validInput({ prepTimeMinutes: 5, cookTimeMinutes: 5, activeTimeMinutes: 20 });
		expect(fields(input)).toContain('activeTimeMinutes');
	});

	it('accepts active time equal to total (INV-RC-008 boundary)', () => {
		const input = validInput({ prepTimeMinutes: 5, cookTimeMinutes: 5, activeTimeMinutes: 10 });
		expect(fields(input)).not.toContain('activeTimeMinutes');
	});

	it('rejects a substitute that points to itself (INV-RC-011)', () => {
		const input = validInput({
			ingredients: [
				{ name: 'butter', quantity: 1, unit: 'tbsp', sortOrder: 0, substituteForIndex: 0 }
			]
		});
		expect(fields(input)).toContain('ingredients.0.substituteForIndex');
	});

	it('rejects a substitute pointing outside the recipe (INV-RC-011)', () => {
		const input = validInput({
			ingredients: [
				{ name: 'butter', quantity: 1, unit: 'tbsp', sortOrder: 0, substituteForIndex: 5 }
			]
		});
		expect(fields(input)).toContain('ingredients.0.substituteForIndex');
	});

	it('accepts a valid substitute reference (INV-RC-011)', () => {
		const input = validInput({
			ingredients: [
				{ name: 'butter', quantity: 1, unit: 'tbsp', sortOrder: 0 },
				{ name: 'oil', quantity: 1, unit: 'tbsp', sortOrder: 1, substituteForIndex: 0 }
			]
		});
		expect(fields(input)).not.toContain('ingredients.1.substituteForIndex');
	});
});

describe('validateRating (INV-RC-009)', () => {
	it('accepts null (clearing the rating)', () => {
		expect(validateRating(null)).toEqual([]);
	});

	it('accepts 1 through 5', () => {
		for (const r of [1, 2, 3, 4, 5]) expect(validateRating(r)).toEqual([]);
	});

	it('rejects out-of-range values', () => {
		expect(validateRating(0).length).toBe(1);
		expect(validateRating(6).length).toBe(1);
	});

	it('rejects non-integers', () => {
		expect(validateRating(3.5).length).toBe(1);
	});
});
