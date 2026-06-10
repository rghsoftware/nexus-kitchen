import { describe, it, expect } from 'vitest';
import {
	validateRecipeInput,
	validateRating,
	validateNutritionInfo,
	isValidRecipeInput
} from './recipeValidation';
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

describe('validateRecipeInput — length bounds', () => {
	it('rejects a title over 500 characters', () => {
		expect(fields(validInput({ title: 'a'.repeat(501) }))).toContain('title');
	});

	it('rejects a description over 2000 characters', () => {
		expect(fields(validInput({ description: 'a'.repeat(2001) }))).toContain('description');
	});

	it('rejects notes over 5000 characters', () => {
		expect(fields(validInput({ notes: 'a'.repeat(5001) }))).toContain('notes');
	});

	it('rejects an ingredient name over 200 characters', () => {
		expect(
			fields(
				validInput({
					ingredients: [{ name: 'a'.repeat(201), quantity: 1, unit: 'g', sortOrder: 0 }]
				})
			)
		).toContain('ingredients.0.name');
	});

	it('rejects an ingredient with no name', () => {
		expect(
			fields(validInput({ ingredients: [{ name: '', quantity: 1, unit: 'g', sortOrder: 0 }] }))
		).toContain('ingredients.0.name');
	});

	it('rejects an ingredient with no unit', () => {
		expect(
			fields(validInput({ ingredients: [{ name: 'salt', quantity: 1, unit: '', sortOrder: 0 }] }))
		).toContain('ingredients.0.unit');
	});

	it('rejects an ingredient unit over 50 characters', () => {
		expect(
			fields(
				validInput({
					ingredients: [{ name: 'salt', quantity: 1, unit: 'x'.repeat(51), sortOrder: 0 }]
				})
			)
		).toContain('ingredients.0.unit');
	});

	it('rejects a step instruction over 2000 characters', () => {
		expect(
			fields(validInput({ steps: [{ instruction: 'a'.repeat(2001), sortOrder: 0 }] }))
		).toContain('steps.0.instruction');
	});

	it('rejects a step with negative durationMinutes', () => {
		expect(
			fields(validInput({ steps: [{ instruction: 'Cook', durationMinutes: -1, sortOrder: 0 }] }))
		).toContain('steps.0.durationMinutes');
	});

	it('rejects a step with negative timerMinutes', () => {
		expect(
			fields(validInput({ steps: [{ instruction: 'Cook', timerMinutes: -5, sortOrder: 0 }] }))
		).toContain('steps.0.timerMinutes');
	});
});

describe('validateRecipeInput — time fields', () => {
	it('rejects negative prepTimeMinutes', () => {
		expect(fields(validInput({ prepTimeMinutes: -1 }))).toContain('prepTimeMinutes');
	});

	it('rejects negative cookTimeMinutes', () => {
		expect(fields(validInput({ cookTimeMinutes: -1 }))).toContain('cookTimeMinutes');
	});

	it('accepts zero for time fields (valid: no prep time)', () => {
		expect(fields(validInput({ prepTimeMinutes: 0 }))).not.toContain('prepTimeMinutes');
	});
});

describe('validateRecipeInput — servings edge cases', () => {
	it('rejects float servings', () => {
		expect(fields(validInput({ servings: 1.5 }))).toContain('servings');
	});

	it('rejects NaN servings', () => {
		expect(fields(validInput({ servings: NaN }))).toContain('servings');
	});
});

describe('isValidRecipeInput', () => {
	it('returns false when there are validation errors', () => {
		expect(isValidRecipeInput(validInput({ title: '' }))).toBe(false);
	});
});

describe('validateNutritionInfo (INV-NT-001)', () => {
	const valid = {
		calories: 300,
		proteinGrams: 20,
		carbsGrams: 40,
		fatGrams: 10
	};

	it('passes for valid non-negative nutrition values', () => {
		expect(validateNutritionInfo(valid)).toEqual([]);
	});

	it('rejects negative calories', () => {
		expect(validateNutritionInfo({ ...valid, calories: -1 }).map((e) => e.field)).toContain(
			'nutritionPerServing.calories'
		);
	});

	it('rejects negative proteinGrams', () => {
		expect(validateNutritionInfo({ ...valid, proteinGrams: -5 }).map((e) => e.field)).toContain(
			'nutritionPerServing.proteinGrams'
		);
	});

	it('accepts zero for required fields (edge: exactly 0 is valid)', () => {
		expect(validateNutritionInfo({ ...valid, calories: 0, fatGrams: 0 })).toEqual([]);
	});

	it('rejects negative optional field when present', () => {
		expect(validateNutritionInfo({ ...valid, fiberGrams: -2 }).map((e) => e.field)).toContain(
			'nutritionPerServing.fiberGrams'
		);
	});

	it('accepts absent optional fields', () => {
		expect(validateNutritionInfo(valid)).toEqual([]);
	});
});
