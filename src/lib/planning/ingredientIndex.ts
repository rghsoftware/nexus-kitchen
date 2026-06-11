// Batched read of recipe ingredients for fulfillment matching (one PostgREST query per
// range load instead of N+1 getRecipe calls). Owner scoping comes from the existing
// recipe_ingredients RLS policy; this is a small read-only projection.

import { supabase } from '$lib/supabaseClient';
import { PlanningError } from './planningService';
import type { IngredientForMatch } from './fulfillment';

// Session-scoped cache: ingredient lists rarely change mid-session, and a stale "can
// make it" resolves on the next reload (online-first, cached reads — P15).
const cache = new Map<string, IngredientForMatch[]>();

/**
 * Fetch ingredients for the given recipe ids (skipping ids already cached) and return
 * a map covering every requested id. Ids with no rows map to an empty array, which the
 * derivation treats as "cannot verify" → MUST_ACQUIRE.
 */
export async function loadIngredientIndex(
	recipeIds: readonly string[]
): Promise<Map<string, IngredientForMatch[]>> {
	const wanted = [...new Set(recipeIds)];
	const uncached = wanted.filter((id) => !cache.has(id));

	if (uncached.length > 0) {
		const { data, error } = await supabase
			.from('recipe_ingredients')
			.select('id, recipe_id, name, is_optional, substitute_for')
			.in('recipe_id', uncached);
		if (error) {
			throw new PlanningError("We couldn't check your ingredients. Please try again.", error);
		}

		for (const id of uncached) cache.set(id, []);
		for (const row of data ?? []) {
			const list = cache.get(row.recipe_id);
			if (list) {
				list.push({
					id: row.id,
					name: row.name,
					isOptional: row.is_optional,
					substituteFor: row.substitute_for
				});
			} else {
				// PostgREST returned a recipe_id that wasn't in our .in() filter — RLS
				// rewrite or a data anomaly. Log for observability; don't let it corrupt cache.
				console.error('[ingredientIndex] unexpected recipe_id in response:', row.recipe_id);
			}
		}
	}

	return new Map(wanted.map((id) => [id, cache.get(id) ?? []]));
}

/** Drop all cached ingredient lists (tests, or forcing a refetch on reload). */
export function clearIngredientIndex(): void {
	cache.clear();
}
