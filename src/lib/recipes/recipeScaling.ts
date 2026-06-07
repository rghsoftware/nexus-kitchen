// Pure, display-only serving-scale logic (FR-016, SC-006).
// Scaling NEVER mutates stored data — it returns new display values for the UI.

import type { RecipeIngredient } from './types';

/** Scale factor for moving from a recipe's base servings to a target serving count. */
export function scaleFactor(baseServings: number, targetServings: number): number {
	if (baseServings <= 0) return 1;
	if (targetServings <= 0) return 0;
	return targetServings / baseServings;
}

/** Scale a single quantity, rounded to a sensible kitchen precision (max 2 decimals). */
export function scaleQuantity(quantity: number, factor: number): number {
	const scaled = quantity * factor;
	return Math.round(scaled * 100) / 100;
}

/** A view-model of an ingredient with its displayed quantity scaled. Does not mutate input. */
export interface ScaledIngredient extends RecipeIngredient {
	displayQuantity: number;
}

/**
 * Return a new array of ingredients with `displayQuantity` scaled from `baseServings` to
 * `targetServings`. The original objects and their `quantity` are left untouched.
 */
export function scaleIngredients(
	ingredients: readonly RecipeIngredient[],
	baseServings: number,
	targetServings: number
): ScaledIngredient[] {
	const factor = scaleFactor(baseServings, targetServings);
	return ingredients.map((ing) => ({
		...ing,
		displayQuantity: scaleQuantity(ing.quantity, factor)
	}));
}
