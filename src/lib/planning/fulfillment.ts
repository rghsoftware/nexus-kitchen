// Fulfillment-state derivation (REQ-MP-012). Pure functions, no I/O: derived from
// current inventory + plan at display time and NEVER persisted (INV-PL-017).
//
// Canonical rules (Domain Specification §2.4):
//   HAVE_IT      — source = PREPPED and the referenced portion has portions remaining > 0
//   CAN_MAKE_IT  — source = RECIPE and every required ingredient is on hand in the pantry
//   MUST_ACQUIRE — not yet satisfiable: RECIPE missing ingredients, STORE_BOUGHT (buy),
//                  or a PREPPED whose portion is exhausted / no longer exists
// QUICK meals carry no fulfillment state by design; nor do non-PLANNED meals — the
// requirement is already resolved (eaten, skipped, swapped).

import type { InventorySnapshot } from '$lib/pantry/types';
import type { PlannedMeal } from './types';

export type FulfillmentState = 'HAVE_IT' | 'CAN_MAKE_IT' | 'MUST_ACQUIRE';

export interface FulfillmentResult {
	state: FulfillmentState;
	/** Required-ingredient names not on hand; non-empty only for RECIPE + MUST_ACQUIRE. */
	missingIngredients: string[];
}

/** The slice of a recipe_ingredients row the matcher needs. */
export interface IngredientForMatch {
	id: string;
	name: string;
	isOptional: boolean;
	/** recipe_ingredients.id of the base ingredient this row substitutes for, if any. */
	substituteFor: string | null;
}

export interface FulfillmentInputs {
	/** Normalized names of pantry items with quantity > 0 (presence-by-name matching). */
	pantryIndex: ReadonlySet<string>;
	/** Prepped portions by id — only `portionsRemaining` matters here. */
	preppedById: ReadonlyMap<string, { portionsRemaining: number }>;
	/** Ingredients per recipe id; null = not fetched yet (chips are omitted, FR-FS-009). */
	ingredientsByRecipeId: ReadonlyMap<string, IngredientForMatch[]> | null;
}

/**
 * Pantry↔ingredient matching is presence-by-name (clarified 2026-06-10): no master
 * ingredient table exists yet, and units are free text, so quantity/unit math would
 * be invented. Both sides normalize through this function.
 */
export function normalizeName(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Build the pantry-name index from pantry items; items with zero quantity don't count. */
export function buildPantryNameIndex(
	items: readonly { name: string; quantity: number | string }[]
): Set<string> {
	const index = new Set<string>();
	for (const item of items) {
		if (Number(item.quantity) > 0) index.add(normalizeName(item.name));
	}
	return index;
}

/**
 * Assemble derivation inputs from the inventory-snapshot interface (FR-FS-008): the
 * `InventorySnapshot` shape from FR-FC-003 is the documented seam between the pantry
 * feature and this derivation. Pass live store values for reactive consumers, or a
 * point-in-time `getInventorySnapshot()` result in tests.
 */
export function inputsFromSnapshot(
	snapshot: Pick<InventorySnapshot, 'pantryItems' | 'preppedMeals'>,
	ingredientsByRecipeId: ReadonlyMap<string, IngredientForMatch[]> | null
): FulfillmentInputs {
	return {
		pantryIndex: buildPantryNameIndex(snapshot.pantryItems),
		preppedById: new Map(
			snapshot.preppedMeals.map((p) => [p.id, { portionsRemaining: p.portions_remaining }])
		),
		ingredientsByRecipeId
	};
}

const HAVE_IT: FulfillmentResult = { state: 'HAVE_IT', missingIngredients: [] };
const MUST_ACQUIRE: FulfillmentResult = { state: 'MUST_ACQUIRE', missingIngredients: [] };
const CAN_MAKE_IT: FulfillmentResult = { state: 'CAN_MAKE_IT', missingIngredients: [] };

/**
 * Derive the fulfillment state of one planned meal (FR-FS-001..004).
 * Returns null when the meal is not fulfillment-tracked (QUICK, non-PLANNED status)
 * or when the inputs needed for a truthful answer aren't loaded yet (FR-FS-009) —
 * surfaces omit the chip rather than show a possibly-wrong state.
 */
export function deriveFulfillment(
	meal: PlannedMeal,
	inputs: FulfillmentInputs
): FulfillmentResult | null {
	if (meal.status !== 'PLANNED') return null;

	switch (meal.source) {
		case 'QUICK':
			return null; // not fulfillment-tracked by design (FR-FS-002)

		case 'PREPPED': {
			// Exhausted or deleted portion = the requirement is no longer covered.
			const portion =
				meal.preppedMealId !== null ? inputs.preppedById.get(meal.preppedMealId) : undefined;
			return portion !== undefined && portion.portionsRemaining > 0 ? HAVE_IT : MUST_ACQUIRE;
		}

		case 'STORE_BOUGHT':
			// Always a buy-gap: purchasing enters inventory as a prepped portion, at which
			// point covering the meal means pointing it at that portion (spec Assumptions).
			return MUST_ACQUIRE;

		case 'RECIPE': {
			if (inputs.ingredientsByRecipeId === null) return null; // not fetched yet

			const ingredients =
				meal.recipeId !== null ? inputs.ingredientsByRecipeId.get(meal.recipeId) : undefined;
			// Deleted recipe or no ingredients on record: can't verify makeability.
			if (ingredients === undefined || ingredients.length === 0) return MUST_ACQUIRE;

			// Required = non-optional base ingredients. Substitute rows are alternatives,
			// not additional requirements; a base is satisfied by its own name or any of
			// its substitutes' names being on hand (spec Assumptions, INV-RC-011).
			const missing = ingredients.filter((ing) => {
				if (ing.isOptional || ing.substituteFor !== null) return false;
				if (inputs.pantryIndex.has(normalizeName(ing.name))) return false;
				return !ingredients.some(
					(sub) => sub.substituteFor === ing.id && inputs.pantryIndex.has(normalizeName(sub.name))
				);
			});

			return missing.length === 0
				? CAN_MAKE_IT
				: { state: 'MUST_ACQUIRE', missingIngredients: missing.map((ing) => ing.name) };
		}
	}
}
