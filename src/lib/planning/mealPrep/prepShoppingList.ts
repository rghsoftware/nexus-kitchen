// Pure prep→shopping aggregation (REQ-PP-019..022, research D4). No I/O — the service layer
// loads recipe ingredients + the pantry index and hands them here. Gap detection uses the same
// presence-by-name rule as fulfillment v1 (no unit math): an ingredient already on hand by name
// drops out; what remains is what the prep session needs to buy.

import { normalizeName } from '../fulfillment';
import type { PrepShoppingGapItem } from './types';

export interface PrepRecipeIngredient {
	name: string;
	unit: string;
	quantity: number;
	isOptional: boolean;
}

export interface RecipeForPrep {
	recipeId: string;
	recipeName: string;
	/** recipes.servings — the recipe's base yield (> 0). */
	baseServings: number;
	/** servings to prepare in this session (> 0). */
	servingsToPrep: number;
	ingredients: PrepRecipeIngredient[];
}

interface Aggregate {
	name: string; // first-seen display name
	unit: string;
	quantity: number;
	forRecipes: Set<string>;
}

/**
 * Aggregate the ingredients a session needs across all its recipes (scaled by servings),
 * drop anything already on hand in the pantry, and annotate each remaining item with the
 * recipe(s) that need it. Optional ingredients never enter the gap.
 */
export function computePrepShoppingGap(
	recipes: readonly RecipeForPrep[],
	pantryIndex: ReadonlySet<string>
): PrepShoppingGapItem[] {
	const byKey = new Map<string, Aggregate>();

	for (const recipe of recipes) {
		const factor = recipe.baseServings > 0 ? recipe.servingsToPrep / recipe.baseServings : 0;
		for (const ing of recipe.ingredients) {
			if (ing.isOptional) continue;
			const norm = normalizeName(ing.name);
			// Aggregate per (name, unit) — different units for the same name stay separate
			// rather than being silently summed across incompatible measures.
			const key = `${norm}|${normalizeName(ing.unit)}`;
			const existing = byKey.get(key);
			if (existing) {
				existing.quantity += ing.quantity * factor;
				existing.forRecipes.add(recipe.recipeName);
			} else {
				byKey.set(key, {
					name: ing.name.trim(),
					unit: ing.unit,
					quantity: ing.quantity * factor,
					forRecipes: new Set([recipe.recipeName])
				});
			}
		}
	}

	const gap: PrepShoppingGapItem[] = [];
	for (const agg of byKey.values()) {
		// Already on hand (presence-by-name) → not a gap.
		if (pantryIndex.has(normalizeName(agg.name))) continue;
		gap.push({
			name: agg.name,
			unit: agg.unit,
			quantity: roundQuantity(agg.quantity),
			forRecipes: [...agg.forRecipes]
		});
	}
	return gap;
}

/** Round scaled quantities to a sane precision (avoids 0.30000000000000004 in lists). */
function roundQuantity(value: number): number {
	return Math.round(value * 1000) / 1000;
}
