import { supabase } from '$lib/supabaseClient';
import { currentUser } from '$lib/session/session.svelte';
import { addPreppedMeal } from '$lib/pantry/preppedMealService';
import { getPantryItems } from '$lib/pantry/pantryService';
import { PREPPED_SHELF_LIFE_DAYS, type StorageLocation } from '$lib/pantry/types';
import { buildPantryNameIndex } from '../fulfillment';
import { recipesRepository } from '$lib/recipes';
import { addItems } from '$lib/shopping/shoppingService';
import type { NewShoppingItem } from '$lib/shopping/types';
import { computePrepShoppingGap, type RecipeForPrep } from './prepShoppingList';
import {
	toMealPrepSession,
	type MealPrepSession,
	type MealPrepSessionRecipeRow,
	type MealPrepSessionRow,
	type NewMealPrepSession,
	type NewSessionRecipe,
	type YieldChoice
} from './types';

// PostgREST embedded-resource select: a session plus its recipe lines in one round-trip.
const SESSION_SELECT = '*, meal_prep_session_recipes(*)';

type SessionWithRecipes = MealPrepSessionRow & {
	meal_prep_session_recipes: MealPrepSessionRecipeRow[];
};

function mapRow(row: SessionWithRecipes): MealPrepSession {
	return toMealPrepSession(row, row.meal_prep_session_recipes ?? []);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getSessions(): Promise<MealPrepSession[]> {
	const { data, error } = await supabase
		.from('meal_prep_sessions')
		.select(SESSION_SELECT)
		// PLANNED first (so the actionable ones lead), then soonest prep day.
		.order('status', { ascending: true })
		.order('prep_day', { ascending: true });
	if (error) throw new MealPrepServiceError('Failed to load meal prep sessions', error);
	return (data ?? []).map((r) => mapRow(r as SessionWithRecipes));
}

export async function getSession(id: string): Promise<MealPrepSession | null> {
	const { data, error } = await supabase
		.from('meal_prep_sessions')
		.select(SESSION_SELECT)
		.eq('id', id)
		.maybeSingle();
	if (error) throw new MealPrepServiceError('Failed to load meal prep session', error);
	return data ? mapRow(data as SessionWithRecipes) : null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createSession(draft: NewMealPrepSession): Promise<MealPrepSession> {
	assertRecipes(draft.recipes);
	assertNotPast(draft.prepDay);

	// owner_id defaults to auth.uid() (migration 0009); status defaults to PLANNED.
	const { data: session, error } = await supabase
		.from('meal_prep_sessions')
		.insert({ prep_day: draft.prepDay })
		.select()
		.single();
	if (error) throw new MealPrepServiceError('Failed to create meal prep session', error);

	const recipeRows = draft.recipes.map((r) => ({
		meal_prep_session_id: session.id,
		recipe_id: r.recipeId,
		recipe_name: r.recipeName,
		servings_to_prep: r.servingsToPrep
	}));
	const { error: recipeError } = await supabase
		.from('meal_prep_session_recipes')
		.insert(recipeRows);
	if (recipeError) {
		// Roll back the orphaned session so an empty session can never exist (INV-PL-006).
		await supabase.from('meal_prep_sessions').delete().eq('id', session.id);
		throw new MealPrepServiceError('Failed to add recipes to the session', recipeError);
	}

	const created = await getSession(session.id);
	if (!created) throw new MealPrepServiceError('Session vanished immediately after creation');
	return created;
}

// ---------------------------------------------------------------------------
// Update (PLANNED sessions)
// ---------------------------------------------------------------------------

export async function addRecipe(
	sessionId: string,
	recipe: NewSessionRecipe
): Promise<MealPrepSession> {
	if (recipe.servingsToPrep <= 0) {
		throw new MealPrepServiceError('Servings to prepare must be greater than zero');
	}
	const { error } = await supabase.from('meal_prep_session_recipes').insert({
		meal_prep_session_id: sessionId,
		recipe_id: recipe.recipeId,
		recipe_name: recipe.recipeName,
		servings_to_prep: recipe.servingsToPrep
	});
	if (error) throw new MealPrepServiceError('Failed to add recipe to the session', error);
	return requireSession(sessionId);
}

export async function removeRecipe(
	sessionId: string,
	sessionRecipeId: string
): Promise<MealPrepSession> {
	const session = await requireSession(sessionId);
	if (session.recipes.length <= 1) {
		// A session must keep at least one recipe (INV-PL-006).
		throw new MealPrepServiceError('A prep session needs at least one recipe');
	}
	const { error } = await supabase
		.from('meal_prep_session_recipes')
		.delete()
		.eq('id', sessionRecipeId);
	if (error) throw new MealPrepServiceError('Failed to remove recipe from the session', error);
	return requireSession(sessionId);
}

export async function updateServings(
	sessionRecipeId: string,
	servingsToPrep: number
): Promise<void> {
	if (servingsToPrep <= 0) {
		throw new MealPrepServiceError('Servings to prepare must be greater than zero');
	}
	const { error } = await supabase
		.from('meal_prep_session_recipes')
		.update({ servings_to_prep: servingsToPrep })
		.eq('id', sessionRecipeId);
	if (error) throw new MealPrepServiceError('Failed to update servings', error);
}

export async function setPrepDay(sessionId: string, prepDay: string): Promise<void> {
	assertNotPast(prepDay);
	const { error } = await supabase
		.from('meal_prep_sessions')
		.update({ prep_day: prepDay })
		.eq('id', sessionId);
	if (error) throw new MealPrepServiceError('Failed to update the prep day', error);
}

// ---------------------------------------------------------------------------
// Cancel (PLANNED -> CANCELLED; no portions created)
// ---------------------------------------------------------------------------

export async function cancelSession(sessionId: string): Promise<MealPrepSession> {
	const { error } = await supabase
		.from('meal_prep_sessions')
		.update({ status: 'CANCELLED' })
		.eq('id', sessionId);
	if (error) throw new MealPrepServiceError('Failed to cancel the session', error);
	return requireSession(sessionId);
}

// ---------------------------------------------------------------------------
// Prep → shopping list (REQ-PP-019..022, INV-XD-004) — FR-PP-020..023
// ---------------------------------------------------------------------------

/**
 * Generate a FROM_PREP shopping list of the ingredient gap for a session: aggregate the
 * ingredients its recipes need (scaled by servings), subtract what's on hand in the pantry,
 * and write a shopping list referencing the session. Available while the session is PLANNED;
 * does not require completion (FR-PP-023). Each item records which recipe(s) need it.
 */
export async function generatePrepShoppingList(
	sessionId: string
): Promise<{ shoppingListId: string; itemCount: number }> {
	const session = await requireSession(sessionId);

	// Load each recipe's ingredients + base yield, scaled by the session's servings.
	const nameToRecipeId = new Map<string, string>();
	const recipesForPrep: RecipeForPrep[] = [];
	for (const line of session.recipes) {
		nameToRecipeId.set(line.recipeName, line.recipeId);
		const detail = await recipesRepository.getRecipe(line.recipeId);
		recipesForPrep.push({
			recipeId: line.recipeId,
			recipeName: line.recipeName,
			baseServings: detail.servings,
			servingsToPrep: line.servingsToPrep,
			ingredients: detail.ingredients.map((ing) => ({
				name: ing.name,
				unit: ing.unit,
				quantity: ing.quantity,
				isOptional: ing.isOptional
			}))
		});
	}

	const pantryIndex = buildPantryNameIndex(await getPantryItems());
	const gap = computePrepShoppingGap(recipesForPrep, pantryIndex);

	// Create the FROM_PREP list (owner_id defaults to auth.uid(); the CHECK requires the
	// session reference for FROM_PREP — INV-XD-004).
	const listName = `Prep — ${session.prepDay}`;
	const { data: list, error } = await supabase
		.from('shopping_lists')
		.insert({
			name: listName,
			source_type: 'FROM_PREP',
			meal_prep_session_id: sessionId
		})
		.select()
		.single();
	if (error) throw new MealPrepServiceError('Failed to create the prep shopping list', error);

	const items: NewShoppingItem[] = gap.map((g, idx) => ({
		name: g.name,
		quantity: g.quantity,
		unit: g.unit,
		category: 'OTHER',
		sortOrder: idx,
		neededFor: g.forRecipes.map((title) => ({
			recipeId: nameToRecipeId.get(title) ?? null,
			title
		}))
	}));

	if (items.length > 0) {
		try {
			await addItems(list.id, items);
		} catch (itemError) {
			// Don't strand a list whose items failed — remove it and surface the failure.
			await supabase.from('shopping_lists').delete().eq('id', list.id);
			throw new MealPrepServiceError('Failed to add items to the prep shopping list', itemError);
		}
	}

	return { shoppingListId: list.id, itemCount: items.length };
}

// ---------------------------------------------------------------------------
// Complete (yield to inventory) — FR-PP-014/015/016
// ---------------------------------------------------------------------------

const DEFAULT_YIELD_STORAGE: StorageLocation = 'FRIDGE';

/**
 * Complete a session: yield one PREP_SESSION-origin prepped portion per recipe into
 * inventory, then mark the session COMPLETED. Idempotent — if portions linked to this
 * session already exist (a prior, possibly partial, completion), no further yield happens
 * (FR-PP-014). Distribution into the meal plan is out of scope (yield-to-inventory-only).
 */
export async function completeSession(
	sessionId: string,
	yields: readonly YieldChoice[] = []
): Promise<MealPrepSession> {
	const session = await requireSession(sessionId);

	// Idempotency guard: the session<->portion link is the key, not a local flag.
	const { data: existing, error: existingError } = await supabase
		.from('prepped_meals')
		.select('id')
		.eq('meal_prep_session_id', sessionId)
		.limit(1);
	if (existingError) {
		throw new MealPrepServiceError('Failed to check existing yield', existingError);
	}
	if ((existing ?? []).length > 0) {
		// Already yielded — make sure the status reflects completion and return.
		if (session.status !== 'COMPLETED') return markCompleted(sessionId);
		return session;
	}

	// prepped_meals.owner_id has no DB default (unlike meal_prep_sessions), so set it explicitly.
	const user = await currentUser();
	if (!user) throw new MealPrepServiceError('You need to be signed in to mark a session prepped');

	const storageByRecipe = new Map(yields.map((y) => [y.sessionRecipeId, y.storageLocation]));
	const preparedDate = todayIso();

	for (const recipe of session.recipes) {
		const storage = storageByRecipe.get(recipe.id) ?? DEFAULT_YIELD_STORAGE;
		await addPreppedMeal({
			owner_id: user.id,
			origin: 'PREP_SESSION',
			name: recipe.recipeName,
			recipe_id: recipe.recipeId,
			recipe_name: recipe.recipeName,
			meal_prep_session_id: sessionId,
			original_portions: recipe.servingsToPrep,
			portions_remaining: recipe.servingsToPrep,
			storage_location: storage,
			prepared_date: preparedDate,
			expiration_date: expirationFor(preparedDate, storage),
			// INV-INV-007: freezer items are FROZEN; fridge items are immediately ready.
			defrost_state: storage === 'FREEZER' ? 'FROZEN' : 'NOT_APPLICABLE'
		});
	}

	return markCompleted(sessionId);
}

async function markCompleted(sessionId: string): Promise<MealPrepSession> {
	const { error } = await supabase
		.from('meal_prep_sessions')
		.update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
		.eq('id', sessionId);
	if (error) throw new MealPrepServiceError('Failed to mark the session complete', error);
	return requireSession(sessionId);
}

function todayIso(): string {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d.toISOString().slice(0, 10);
}

/** prepared_date + the storage-appropriate default shelf life (REQ-PP-012, INV-INV-009). */
function expirationFor(preparedDate: string, storage: StorageLocation): string {
	const days = PREPPED_SHELF_LIFE_DAYS[storage] ?? PREPPED_SHELF_LIFE_DAYS.FRIDGE ?? 4;
	const d = new Date(`${preparedDate}T00:00:00`);
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function requireSession(sessionId: string): Promise<MealPrepSession> {
	const session = await getSession(sessionId);
	if (!session) throw new MealPrepServiceError('That prep session could not be found');
	return session;
}

function assertRecipes(recipes: readonly NewSessionRecipe[]): void {
	if (recipes.length < 1) {
		throw new MealPrepServiceError('A prep session needs at least one recipe');
	}
	if (recipes.some((r) => r.servingsToPrep <= 0)) {
		throw new MealPrepServiceError('Servings to prepare must be greater than zero');
	}
}

/** Reject prep days in the past (compared on the local calendar date). */
function assertNotPast(prepDay: string): void {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const target = new Date(`${prepDay}T00:00:00`);
	if (target.getTime() < today.getTime()) {
		throw new MealPrepServiceError('The prep day cannot be in the past');
	}
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class MealPrepServiceError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown
	) {
		super(message);
		this.name = 'MealPrepServiceError';
	}
}
