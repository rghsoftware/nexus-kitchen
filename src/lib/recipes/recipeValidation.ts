// Client-side validation mirroring the recipe domain invariants (INV-RC-*). Messages are calm
// and shame-free (design system voice) — they guide, never scold. The database CHECK
// constraints are the backstop; this layer gives immediate feedback in the form.

import type { RecipeInput, NutritionInfo } from './types';

export interface ValidationError {
	/** Dotted field path, e.g. "servings" or "ingredients.0.quantity". */
	field: string;
	message: string;
}

const TITLE_MAX = 500;
const DESC_MAX = 2000;
const NOTES_MAX = 5000;
const NAME_MAX = 200;
const UNIT_MAX = 50;
const INSTRUCTION_MAX = 2000;

/**
 * Validate a recipe input against the domain invariants. Returns an empty array when valid.
 * Covers INV-RC-001/002/003/005/008/009(n.a. here)/011 plus length bounds.
 */
export function validateRecipeInput(input: RecipeInput): ValidationError[] {
	const errors: ValidationError[] = [];

	// Title (1..500)
	const title = input.title?.trim() ?? '';
	if (title.length < 1) {
		errors.push({ field: 'title', message: 'Give your recipe a title so you can find it later.' });
	} else if (title.length > TITLE_MAX) {
		errors.push({
			field: 'title',
			message: `Title is a little long — keep it under ${TITLE_MAX} characters.`
		});
	}

	if (input.description && input.description.length > DESC_MAX) {
		errors.push({ field: 'description', message: `Description is over ${DESC_MAX} characters.` });
	}
	if (input.notes && input.notes.length > NOTES_MAX) {
		errors.push({ field: 'notes', message: `Notes are over ${NOTES_MAX} characters.` });
	}

	// Servings (INV-RC-003): positive, 1..100
	if (!Number.isFinite(input.servings) || !Number.isInteger(input.servings)) {
		errors.push({ field: 'servings', message: 'Servings should be a whole number.' });
	} else if (input.servings < 1 || input.servings > 100) {
		errors.push({ field: 'servings', message: 'Servings can be between 1 and 100.' });
	}

	// Times: non-negative when set
	for (const key of ['prepTimeMinutes', 'cookTimeMinutes', 'activeTimeMinutes'] as const) {
		const v = input[key];
		if (v != null && (!Number.isFinite(v) || v < 0)) {
			errors.push({ field: key, message: 'Time can’t be negative.' });
		}
	}

	// INV-RC-008: active time cannot exceed total (prep + cook)
	const prep = input.prepTimeMinutes ?? 0;
	const cook = input.cookTimeMinutes ?? 0;
	if (input.activeTimeMinutes != null && input.activeTimeMinutes > prep + cook) {
		errors.push({
			field: 'activeTimeMinutes',
			message: 'Hands-on time can’t be more than the total prep and cook time.'
		});
	}

	// Nutrition values: non-negative (INV-NT-001; AI output is untrusted per INV-PRI-006)
	if (input.nutritionPerServing != null) {
		errors.push(...validateNutritionInfo(input.nutritionPerServing));
	}

	// INV-RC-001: at least one ingredient
	if (!input.ingredients || input.ingredients.length < 1) {
		errors.push({ field: 'ingredients', message: 'Add at least one ingredient.' });
	} else {
		input.ingredients.forEach((ing, i) => {
			if (!ing.name || ing.name.trim().length < 1) {
				errors.push({ field: `ingredients.${i}.name`, message: 'Name this ingredient.' });
			} else if (ing.name.length > NAME_MAX) {
				errors.push({
					field: `ingredients.${i}.name`,
					message: `Ingredient name is over ${NAME_MAX} characters.`
				});
			}
			// INV-RC-005: quantity > 0
			if (!Number.isFinite(ing.quantity) || ing.quantity <= 0) {
				errors.push({
					field: `ingredients.${i}.quantity`,
					message: 'Quantity should be greater than zero.'
				});
			}
			if (!ing.unit || ing.unit.trim().length < 1) {
				errors.push({ field: `ingredients.${i}.unit`, message: 'Add a unit (e.g. cup, g, tbsp).' });
			} else if (ing.unit.length > UNIT_MAX) {
				errors.push({
					field: `ingredients.${i}.unit`,
					message: `Unit is over ${UNIT_MAX} characters.`
				});
			}
			// INV-RC-011: substitute must reference another ingredient in the same recipe
			if (ing.substituteForIndex != null) {
				const ref = ing.substituteForIndex;
				if (ref === i) {
					errors.push({
						field: `ingredients.${i}.substituteForIndex`,
						message: 'An ingredient can’t substitute for itself.'
					});
				} else if (ref < 0 || ref >= input.ingredients.length) {
					errors.push({
						field: `ingredients.${i}.substituteForIndex`,
						message: 'Substitute points to an ingredient that isn’t in this recipe.'
					});
				}
			}
		});
	}

	// INV-RC-002: at least one step
	if (!input.steps || input.steps.length < 1) {
		errors.push({ field: 'steps', message: 'Add at least one step.' });
	} else {
		input.steps.forEach((step, i) => {
			if (!step.instruction || step.instruction.trim().length < 1) {
				errors.push({ field: `steps.${i}.instruction`, message: 'Describe this step.' });
			} else if (step.instruction.length > INSTRUCTION_MAX) {
				errors.push({
					field: `steps.${i}.instruction`,
					message: `Step is over ${INSTRUCTION_MAX} characters.`
				});
			}
			for (const key of ['durationMinutes', 'timerMinutes'] as const) {
				const v = step[key];
				if (v != null && (!Number.isFinite(v) || v < 0)) {
					errors.push({ field: `steps.${i}.${key}`, message: 'Time can’t be negative.' });
				}
			}
		});
	}

	return errors;
}

/** Validate nutrition info values (INV-NT-001): all numeric fields must be non-negative. */
export function validateNutritionInfo(
	nutrition: NutritionInfo,
	field = 'nutritionPerServing'
): ValidationError[] {
	const errors: ValidationError[] = [];
	const required: (keyof NutritionInfo)[] = ['calories', 'proteinGrams', 'carbsGrams', 'fatGrams'];
	for (const key of required) {
		const v = nutrition[key] as number;
		if (!Number.isFinite(v) || v < 0) {
			errors.push({ field: `${field}.${key}`, message: `${key} can't be negative.` });
		}
	}
	const optional: (keyof NutritionInfo)[] = [
		'fiberGrams',
		'sugarGrams',
		'sodiumMg',
		'saturatedFatGrams',
		'cholesterolMg'
	];
	for (const key of optional) {
		const v = nutrition[key];
		if (v != null && (!Number.isFinite(v) || v < 0)) {
			errors.push({ field: `${field}.${key}`, message: `${key} can't be negative.` });
		}
	}
	return errors;
}

/** Convenience: validate a rating value (INV-RC-009). null clears the rating. */
export function validateRating(rating: number | null): ValidationError[] {
	if (rating == null) return [];
	if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
		return [{ field: 'rating', message: 'Rating can be from 1 to 5.' }];
	}
	return [];
}

export function isValidRecipeInput(input: RecipeInput): boolean {
	return validateRecipeInput(input).length === 0;
}
