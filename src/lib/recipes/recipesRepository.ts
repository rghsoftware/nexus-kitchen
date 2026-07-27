// Typed data-access layer for recipes, built on supabase-js / PostgREST. Every call runs under
// the caller's RLS context (auth.uid() from anonymous sign-in). Errors are surfaced as
// RecipeError with friendly messages — never silently swallowed.
//
// Atomicity: PostgREST has no client transaction across tables, so create/update insert the
// recipe then its children, with a compensating delete (CASCADE) on child failure. INV-RC-001/002
// (>=1 ingredient/step) are enforced before any write via recipeValidation.

import { supabase } from '$lib/supabaseClient';
import { currentUser } from '$lib/session/session.svelte';
import { RecipeError, toRecipeError } from './recipeErrors';
import { validateRecipeInput, validateRating } from './recipeValidation';
import {
	mapRecipe,
	mapIngredient,
	mapStep,
	mapTag,
	mapMeta,
	type RecipeSummary,
	type RecipeWithDetail,
	type RecipeInput,
	type UserRecipeMeta
} from './types';
import type {
	RecipeRow,
	RecipeIngredientRow,
	RecipeStepRow,
	RecipeTagRow,
	UserRecipeMetaRow,
	RecipeInsert,
	RecipeIngredientInsert,
	RecipeStepInsert,
	RecipeTagInsert
} from './types';

/** Return the signed-in user, throwing a RecipeError if the session has gone. */
async function requireSession() {
	const user = await currentUser();
	if (!user) throw new RecipeError('Your session has ended. Please sign in again.');
	return user;
}

const RECIPE_DETAIL_SELECT =
	'*, recipe_ingredients(*), recipe_steps(*), recipe_tags(*), user_recipe_meta(*)';

type RecipeRowWithChildren = RecipeRow & {
	recipe_ingredients: RecipeIngredientRow[];
	recipe_steps: RecipeStepRow[];
	recipe_tags: RecipeTagRow[];
	user_recipe_meta: UserRecipeMetaRow[];
};

function assembleDetail(row: RecipeRowWithChildren): RecipeWithDetail {
	const ingredients = [...(row.recipe_ingredients ?? [])]
		.map(mapIngredient)
		.sort((a, b) => a.sortOrder - b.sortOrder);
	const steps = [...(row.recipe_steps ?? [])]
		.map(mapStep)
		.sort((a, b) => a.sortOrder - b.sortOrder);
	const tags = [...(row.recipe_tags ?? [])].map(mapTag);
	const meta = (row.user_recipe_meta ?? [])[0];
	return {
		...mapRecipe(row),
		ingredients,
		steps,
		tags,
		meta: meta ? mapMeta(meta) : null
	};
}

/** List the caller's recipes for the library grid (newest first), with their per-user meta. */
export async function listRecipes(): Promise<RecipeSummary[]> {
	await requireSession();
	const { data, error } = await supabase
		.from('recipes')
		.select('*, user_recipe_meta(*), recipe_tags(*)')
		.order('created_at', { ascending: false });

	if (error) throw toRecipeError(error);

	return (data ?? []).map((row) => {
		const typed = row as RecipeRow & {
			user_recipe_meta: UserRecipeMetaRow[];
			recipe_tags: RecipeTagRow[];
		};
		const meta = (typed.user_recipe_meta ?? [])[0];
		return {
			...mapRecipe(row as RecipeRow),
			meta: meta ? mapMeta(meta) : null,
			tags: (typed.recipe_tags ?? []).map(mapTag)
		};
	});
}

/** Load a single recipe with ingredients, steps, tags, and the caller's meta. */
export async function getRecipe(id: string): Promise<RecipeWithDetail> {
	await requireSession();
	const { data, error } = await supabase
		.from('recipes')
		.select(RECIPE_DETAIL_SELECT)
		.eq('id', id)
		.maybeSingle();

	if (error) throw toRecipeError(error);
	if (!data) throw new RecipeError('That recipe could not be found.');
	return assembleDetail(data as unknown as RecipeRowWithChildren);
}

function recipeInsertFromInput(input: RecipeInput): RecipeInsert {
	return {
		title: input.title.trim(),
		description: input.description ?? null,
		servings: input.servings,
		prep_time_minutes: input.prepTimeMinutes ?? null,
		cook_time_minutes: input.cookTimeMinutes ?? null,
		active_time_minutes: input.activeTimeMinutes ?? null,
		cuisine_type: input.cuisineType ?? null,
		meal_types: input.mealTypes ?? [],
		notes: input.notes ?? null,
		image_url: input.imageUrl ?? null,
		source_url: input.sourceUrl ?? null,
		nutrition_per_serving: (input.nutritionPerServing ??
			null) as RecipeInsert['nutrition_per_serving'],
		nutrition_source: input.nutritionSource ?? 'MANUAL'
		// owner_id defaults to auth.uid()
	};
}

/** Insert the children of a recipe (ingredients, steps, tags), resolving substitute links. */
async function insertChildren(recipeId: string, input: RecipeInput): Promise<void> {
	// Steps
	if (input.steps.length > 0) {
		const stepRows: RecipeStepInsert[] = input.steps.map((s) => ({
			recipe_id: recipeId,
			instruction: s.instruction.trim(),
			duration_minutes: s.durationMinutes ?? null,
			timer_minutes: s.timerMinutes ?? null,
			timer_label: s.timerLabel ?? null,
			image_url: s.imageUrl ?? null,
			sort_order: s.sortOrder
		}));
		const { error } = await supabase.from('recipe_steps').insert(stepRows);
		if (error) throw toRecipeError(error);
	}

	// Tags
	if (input.tags.length > 0) {
		const tagRows: RecipeTagInsert[] = input.tags.map((t) => ({
			recipe_id: recipeId,
			name: t.name.trim().toLowerCase(),
			category: t.category
		}));
		const { error } = await supabase.from('recipe_tags').insert(tagRows);
		if (error) throw toRecipeError(error);
	}

	// Ingredients — two passes so substitute_for can reference sibling ids.
	if (input.ingredients.length > 0) {
		const ingredientRows: RecipeIngredientInsert[] = input.ingredients.map((ing) => ({
			recipe_id: recipeId,
			ingredient_id: ing.ingredientId ?? null,
			name: ing.name.trim(),
			quantity: ing.quantity,
			unit: ing.unit.trim(),
			preparation: ing.preparation ?? null,
			is_optional: ing.isOptional ?? false,
			substitute_for: null,
			sort_order: ing.sortOrder
		}));
		const { data: inserted, error } = await supabase
			.from('recipe_ingredients')
			.insert(ingredientRows)
			.select('id, sort_order');
		if (error) throw toRecipeError(error);

		// Resolve substitute links by input index → inserted id (matched on sort_order).
		const idBySortOrder = new Map<number, string>();
		for (const r of inserted ?? []) idBySortOrder.set(r.sort_order, r.id);

		const updates = input.ingredients
			.filter((ing) => ing.substituteForIndex != null)
			.map((ing) => {
				const selfId = idBySortOrder.get(ing.sortOrder);
				const targetIdx = ing.substituteForIndex as number;
				const targetSort = input.ingredients[targetIdx]?.sortOrder;
				const targetId = targetSort != null ? idBySortOrder.get(targetSort) : undefined;
				return selfId && targetId ? { selfId, targetId } : null;
			})
			.filter((x): x is { selfId: string; targetId: string } => x != null);

		for (const u of updates) {
			const { error: upErr } = await supabase
				.from('recipe_ingredients')
				.update({ substitute_for: u.targetId })
				.eq('id', u.selfId);
			if (upErr) throw toRecipeError(upErr);
		}
	}
}

/** Create a recipe with its children. Validates invariants first; compensates on child failure. */
export async function createRecipe(input: RecipeInput): Promise<RecipeWithDetail> {
	await requireSession();

	const errors = validateRecipeInput(input);
	if (errors.length > 0) throw new RecipeError(errors[0].message);

	const { data: recipeRow, error } = await supabase
		.from('recipes')
		.insert(recipeInsertFromInput(input))
		.select('*')
		.single();
	if (error) throw toRecipeError(error);

	const recipeId = (recipeRow as RecipeRow).id;
	try {
		await insertChildren(recipeId, input);
	} catch (childErr) {
		// Compensating delete — children cascade with the parent.
		const { error: deleteErr } = await supabase.from('recipes').delete().eq('id', recipeId);
		if (deleteErr) {
			console.error('[createRecipe] Compensating delete failed — orphaned recipe row', {
				recipeId,
				deleteError: deleteErr,
				childError: childErr
			});
		}
		throw toRecipeError(childErr);
	}

	return getRecipe(recipeId);
}

/** Update a recipe; replaces its children (add/remove/reorder) preserving unique sort orders. */
export async function updateRecipe(id: string, input: RecipeInput): Promise<RecipeWithDetail> {
	await requireSession();

	const errors = validateRecipeInput(input);
	if (errors.length > 0) throw new RecipeError(errors[0].message);

	const { error: updErr } = await supabase
		.from('recipes')
		.update(recipeInsertFromInput(input))
		.eq('id', id);
	if (updErr) throw toRecipeError(updErr);

	// Replace children: delete then re-insert (avoids sort_order unique conflicts on reorder).
	for (const table of ['recipe_ingredients', 'recipe_steps', 'recipe_tags'] as const) {
		const { error: delErr } = await supabase.from(table).delete().eq('recipe_id', id);
		if (delErr) throw toRecipeError(delErr);
	}
	await insertChildren(id, input);

	return getRecipe(id);
}

/** Delete a recipe; children cascade (INV-DB-008). */
export async function deleteRecipe(id: string): Promise<void> {
	await requireSession();
	const { error } = await supabase.from('recipes').delete().eq('id', id);
	if (error) throw toRecipeError(error);
}

/** Upsert the caller's meta for a recipe and return it. */
async function upsertMeta(
	recipeId: string,
	patch: { is_favorite?: boolean; rating?: number | null }
): Promise<UserRecipeMeta> {
	await requireSession();
	const { data, error } = await supabase
		.from('user_recipe_meta')
		.upsert({ recipe_id: recipeId, ...patch }, { onConflict: 'user_id,recipe_id' })
		.select('*')
		.single();
	if (error) throw toRecipeError(error);
	return mapMeta(data as UserRecipeMetaRow);
}

/** Mark/unmark a recipe as a favorite (FR-008). */
export function setFavorite(recipeId: string, isFavorite: boolean): Promise<UserRecipeMeta> {
	return upsertMeta(recipeId, { is_favorite: isFavorite });
}

/** Set or clear a recipe rating 1–5 (FR-009, INV-RC-009). */
export function setRating(recipeId: string, rating: number | null): Promise<UserRecipeMeta> {
	const errs = validateRating(rating);
	if (errs.length > 0) return Promise.reject(new RecipeError(errs[0].message));
	return upsertMeta(recipeId, { rating });
}

/**
 * Upload one primary image to the owner-prefixed Storage path and return the stored object
 * PATH (e.g. `{uid}/{recipeId}/primary.jpg`). The bucket is private, so callers render images
 * via `signImageUrl(path)` rather than a public URL. The path is what gets stored in
 * `recipes.image_url`.
 */
export async function uploadRecipeImage(recipeId: string, file: File): Promise<string> {
	const user = await requireSession();

	const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
	const path = `${user.id}/${recipeId}/primary.${ext}`;
	const { error } = await supabase.storage
		.from('recipe-images')
		.upload(path, file, { upsert: true, contentType: file.type || undefined });
	if (error) throw toRecipeError(error);

	return path;
}

/**
 * Resolve a stored image PATH to a short-lived signed URL for display (private bucket).
 * Returns null if the path is empty or signing fails — callers fall back to the food tile.
 */
export async function signImageUrl(path: string | null, expiresIn = 3600): Promise<string | null> {
	if (!path) return null;
	const { data, error } = await supabase.storage
		.from('recipe-images')
		.createSignedUrl(path, expiresIn);
	if (error || !data) {
		console.error('[signImageUrl] Failed to sign storage URL', { path, error });
		return null;
	}
	return data.signedUrl;
}

/** Patch only a recipe's image path (used after an image upload). */
export async function setImageUrl(id: string, imageUrl: string | null): Promise<void> {
	await requireSession();
	const { error } = await supabase.from('recipes').update({ image_url: imageUrl }).eq('id', id);
	if (error) throw toRecipeError(error);
}
