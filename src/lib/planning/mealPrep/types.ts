// Domain types for the meal-prep batch-session feature (006). CamelCase application shapes
// mapped from the snake_case database rows. The service layer returns these.
//
// Canonical shapes: Domain Specification §2.x (Planning Context, Meal Prep Session).
// A session selects recipes + servings and, on completion, yields PREP_SESSION-origin
// prepped portions into inventory (yield-to-inventory-only; distribution deferred).

import type { Enums, Tables, TablesInsert } from '$lib/database.types';
import type { StorageLocation } from '$lib/pantry/types';

export type MealPrepSessionStatus = Enums<'meal_prep_session_status'>;

export type MealPrepSessionRow = Tables<'meal_prep_sessions'>;
export type MealPrepSessionRecipeRow = Tables<'meal_prep_session_recipes'>;
export type MealPrepSessionInsert = TablesInsert<'meal_prep_sessions'>;
export type MealPrepSessionRecipeInsert = TablesInsert<'meal_prep_session_recipes'>;

export interface MealPrepSessionRecipe {
	id: string;
	recipeId: string;
	recipeName: string;
	servingsToPrep: number;
}

export interface MealPrepSession {
	id: string;
	status: MealPrepSessionStatus;
	prepDay: string; // ISO date
	completedAt: string | null;
	recipes: MealPrepSessionRecipe[];
}

/** Input for creating a session together with its first recipes (INV-PL-006: length >= 1). */
export interface NewMealPrepSession {
	prepDay: string;
	recipes: NewSessionRecipe[];
}

export interface NewSessionRecipe {
	recipeId: string;
	recipeName: string;
	servingsToPrep: number;
}

/** Per-recipe storage choice captured at completion (drives shelf life / freezer state). */
export interface YieldChoice {
	sessionRecipeId: string;
	storageLocation: StorageLocation;
}

/** Pure prep→shopping output (prepShoppingList.ts). */
export interface PrepShoppingGapItem {
	name: string;
	unit: string;
	quantity: number;
	forRecipes: string[]; // recipe names that contribute this item
}

// ---------------------------------------------------------------------------
// Row → application-shape mappers
// ---------------------------------------------------------------------------

export function toMealPrepSessionRecipe(row: MealPrepSessionRecipeRow): MealPrepSessionRecipe {
	return {
		id: row.id,
		recipeId: row.recipe_id,
		recipeName: row.recipe_name,
		servingsToPrep: row.servings_to_prep
	};
}

export function toMealPrepSession(
	row: MealPrepSessionRow,
	recipeRows: readonly MealPrepSessionRecipeRow[]
): MealPrepSession {
	return {
		id: row.id,
		status: row.status,
		prepDay: row.prep_day,
		completedAt: row.completed_at,
		recipes: recipeRows.map(toMealPrepSessionRecipe)
	};
}
