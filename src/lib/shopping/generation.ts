// Buy-gap generation (FR-SH-010..012). Pure functions, no I/O: the gaps come from the
// SAME derivation the calendar chips use — deriveFulfillment — so the list and the
// chips can never disagree (FR-SH-012). Aggregation dedupes by normalizeName and
// merges "For: …" attribution (FR-SH-011); items already pending on the target list
// are excluded by the same normalization.
//
// Quantity suggestion (spec Assumptions — no unit math): when exactly ONE planned
// recipe needs an ingredient and the recipe states an amount, suggest it; as soon as
// a second recipe needs the same ingredient, fall back to a user-editable 1 "x"
// (cross-unit summing would be invented arithmetic).

import {
	deriveFulfillment,
	normalizeName,
	type FulfillmentInputs,
	type IngredientForMatch
} from '$lib/planning/fulfillment';
import type { PlannedMeal } from '$lib/planning/types';
import { categorize } from './categorize';
import type { NeededFor, ShoppingCategory } from './types';

export interface IngredientGap {
	/** Display name (first-seen spelling). */
	name: string;
	suggestedQuantity: number;
	unit: string;
	category: ShoppingCategory;
	neededFor: NeededFor[];
}

export interface StoreBoughtGap {
	plannedMealId: string;
	name: string;
	servings: number;
}

export interface GapResult {
	ingredientGaps: IngredientGap[];
	storeBoughtGaps: StoreBoughtGap[];
}

interface Aggregate {
	name: string;
	neededFor: NeededFor[];
	/** Recipe-stated amount of the single needing recipe; null once ambiguous. */
	suggestion: { quantity: number; unit: string } | null;
	sources: number;
}

function recipeTitle(meal: PlannedMeal): string {
	return meal.recipeTitleSnapshot ?? 'a recipe';
}

function statedAmount(
	ingredients: readonly IngredientForMatch[] | undefined,
	missingName: string
): { quantity: number; unit: string } | null {
	const key = normalizeName(missingName);
	const row = ingredients?.find((ing) => normalizeName(ing.name) === key);
	return row?.quantity !== undefined && row.quantity > 0 && row.unit
		? { quantity: row.quantity, unit: row.unit }
		: null;
}

/**
 * Compute the buy-gaps for a set of planned meals (FR-SH-010): every MUST_ACQUIRE
 * RECIPE meal contributes its missing ingredients; every MUST_ACQUIRE STORE_BOUGHT
 * meal contributes itself (one purchase per meal — each carries its own
 * plannedMealId for the completion auto-link, FR-SH-018).
 *
 * `existingPendingNames` holds normalizeName()-ed names of the target list's PENDING
 * items; matching gaps are skipped instead of duplicated (FR-SH-011).
 */
export function computeBuyGaps(
	meals: readonly PlannedMeal[],
	inputs: FulfillmentInputs,
	existingPendingNames: ReadonlySet<string> = new Set()
): GapResult {
	const aggregates = new Map<string, Aggregate>();
	const storeBoughtGaps: StoreBoughtGap[] = [];

	for (const meal of meals) {
		const result = deriveFulfillment(meal, inputs);
		if (result === null || result.state !== 'MUST_ACQUIRE') continue;

		if (meal.source === 'STORE_BOUGHT') {
			const name = meal.storeBoughtName ?? '';
			if (name.length === 0 || existingPendingNames.has(normalizeName(name))) continue;
			storeBoughtGaps.push({ plannedMealId: meal.id, name, servings: meal.servings });
			continue;
		}

		if (meal.source !== 'RECIPE') continue; // exhausted PREPPED: nothing listable

		const ingredients =
			meal.recipeId !== null ? inputs.ingredientsByRecipeId?.get(meal.recipeId) : undefined;

		for (const missingName of result.missingIngredients) {
			const key = normalizeName(missingName);
			if (existingPendingNames.has(key)) continue;

			const attribution: NeededFor = { recipeId: meal.recipeId, title: recipeTitle(meal) };
			const existing = aggregates.get(key);
			if (existing === undefined) {
				aggregates.set(key, {
					name: missingName,
					neededFor: [attribution],
					suggestion: statedAmount(ingredients, missingName),
					sources: 1
				});
			} else {
				if (
					!existing.neededFor.some(
						(n) => n.recipeId === attribution.recipeId && n.title === attribution.title
					)
				) {
					existing.neededFor.push(attribution);
				}
				// A second needing recipe makes any single stated amount ambiguous.
				existing.sources += 1;
				existing.suggestion = null;
			}
		}
	}

	const ingredientGaps: IngredientGap[] = [...aggregates.values()].map((agg) => ({
		name: agg.name,
		suggestedQuantity: agg.suggestion?.quantity ?? 1,
		unit: agg.suggestion?.unit ?? 'x',
		category: categorize(agg.name),
		neededFor: agg.neededFor
	}));

	return { ingredientGaps, storeBoughtGaps };
}
