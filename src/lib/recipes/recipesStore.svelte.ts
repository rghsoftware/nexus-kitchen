// Runes-based recipe state: a disposable read cache over the authoritative server (P15,
// ADR-0002). The library list and per-recipe detail are cached; favorite/rating use optimistic
// updates that reconcile against the server response and roll back on rejection.

import { SvelteMap } from 'svelte/reactivity';
import * as repo from './recipesRepository';
import { toRecipeError } from './recipeErrors';
import type { RecipeSummary, RecipeWithDetail, RecipeInput, UserRecipeMeta } from './types';

interface RecipesState {
	library: RecipeSummary[];
	libraryLoaded: boolean;
	loading: boolean;
	error: string | null;
}

const state = $state<RecipesState>({
	library: [],
	libraryLoaded: false,
	loading: false,
	error: null
});

const detailCache = new SvelteMap<string, RecipeWithDetail>();

export const recipesState = state;

/** Load (or reload) the library list. */
export async function loadLibrary(force = false): Promise<void> {
	if (state.libraryLoaded && !force) return;
	state.loading = true;
	state.error = null;
	try {
		state.library = await repo.listRecipes();
		state.libraryLoaded = true;
	} catch (err) {
		state.error = toRecipeError(err).message;
	} finally {
		state.loading = false;
	}
}

/** Get a recipe's full detail, from cache when available. */
export async function loadRecipe(id: string, force = false): Promise<RecipeWithDetail | null> {
	if (!force && detailCache.has(id)) return detailCache.get(id) ?? null;
	state.error = null;
	try {
		const recipe = await repo.getRecipe(id);
		detailCache.set(id, recipe);
		return recipe;
	} catch (err) {
		state.error = toRecipeError(err).message;
		return null;
	}
}

/** Peek the cached detail without fetching. */
export function cachedRecipe(id: string): RecipeWithDetail | null {
	return detailCache.get(id) ?? null;
}

/**
 * Create a recipe; prepend it to the library cache. If an image file is provided, upload it
 * (needs the new recipe id) and patch the image_url. Throws RecipeError on failure.
 */
export async function createRecipe(
	input: RecipeInput,
	imageFile?: File | null
): Promise<RecipeWithDetail> {
	try {
		let created = await repo.createRecipe(input);
		if (imageFile) {
			const url = await repo.uploadRecipeImage(created.id, imageFile);
			await repo.setImageUrl(created.id, url);
			created = { ...created, imageUrl: url };
		}
		detailCache.set(created.id, created);
		state.library = [{ ...created, meta: created.meta }, ...state.library];
		return created;
	} catch (err) {
		throw toRecipeError(err);
	}
}

/** Update a recipe; refresh caches. Optionally replace the primary image. */
export async function updateRecipe(
	id: string,
	input: RecipeInput,
	imageFile?: File | null
): Promise<RecipeWithDetail> {
	try {
		let updated = await repo.updateRecipe(id, input);
		if (imageFile) {
			const url = await repo.uploadRecipeImage(id, imageFile);
			await repo.setImageUrl(id, url);
			updated = { ...updated, imageUrl: url };
		}
		detailCache.set(id, updated);
		state.library = state.library.map((r) =>
			r.id === id ? { ...updated, meta: updated.meta } : r
		);
		return updated;
	} catch (err) {
		throw toRecipeError(err);
	}
}

/** Delete a recipe; drop it from caches. Throws RecipeError on failure. */
export async function deleteRecipe(id: string): Promise<void> {
	try {
		await repo.deleteRecipe(id);
		detailCache.delete(id);
		state.library = state.library.filter((r) => r.id !== id);
	} catch (err) {
		throw toRecipeError(err);
	}
}

/** Apply a meta patch to both caches (used for optimistic updates and reconciliation). */
function applyMeta(id: string, meta: UserRecipeMeta | null): void {
	state.library = state.library.map((r) => (r.id === id ? { ...r, meta } : r));
	const cached = detailCache.get(id);
	if (cached) detailCache.set(id, { ...cached, meta });
}

function snapshotMeta(id: string): UserRecipeMeta | null {
	const fromLib = state.library.find((r) => r.id === id)?.meta;
	if (fromLib !== undefined) return fromLib;
	return detailCache.get(id)?.meta ?? null;
}

function optimisticMeta(
	prev: UserRecipeMeta | null,
	recipeId: string,
	patch: Partial<UserRecipeMeta>
): UserRecipeMeta {
	return {
		id: prev?.id ?? `optimistic-${recipeId}`,
		userId: prev?.userId ?? '',
		recipeId,
		isFavorite: prev?.isFavorite ?? false,
		rating: prev?.rating ?? null,
		timesCooked: prev?.timesCooked ?? 0,
		lastCookedAt: prev?.lastCookedAt ?? null,
		...patch
	};
}

/** Toggle favorite optimistically; reconcile or roll back. */
export async function setFavorite(id: string, isFavorite: boolean): Promise<void> {
	const prev = snapshotMeta(id);
	applyMeta(id, optimisticMeta(prev, id, { isFavorite }));
	try {
		const server = await repo.setFavorite(id, isFavorite);
		applyMeta(id, server);
	} catch (err) {
		applyMeta(id, prev); // rollback
		state.error = toRecipeError(err).message;
		throw toRecipeError(err);
	}
}

/** Set/clear rating optimistically; reconcile or roll back. */
export async function setRating(id: string, rating: number | null): Promise<void> {
	const prev = snapshotMeta(id);
	applyMeta(id, optimisticMeta(prev, id, { rating }));
	try {
		const server = await repo.setRating(id, rating);
		applyMeta(id, server);
	} catch (err) {
		applyMeta(id, prev); // rollback
		state.error = toRecipeError(err).message;
		throw toRecipeError(err);
	}
}

/** Test/maintenance helper: clear all cached state. */
export function resetRecipesCache(): void {
	state.library = [];
	state.libraryLoaded = false;
	state.error = null;
	detailCache.clear();
}
