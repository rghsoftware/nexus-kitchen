// Domain types for the recipes feature. These are camelCase application shapes mapped from the
// snake_case database rows in `$lib/database.types`. Repository functions return these.

import type { Tables, TablesInsert, TablesUpdate } from '$lib/database.types';

// App-level unions that refine the DB's CHECK-constrained text columns. `supabase gen types`
// emits these as `string` (the schema uses CHECK constraints, not Postgres enums), so the strict
// option sets live here as the app's source of truth.
// SYNC REQUIRED: these members must match the CHECK constraints in supabase/migrations/0001_recipes.sql.
export type NutritionSource = 'COMPUTED' | 'MANUAL' | 'EXTERNAL';
export type TagCategory = 'DIETARY' | 'CUISINE' | 'MEAL_TYPE' | 'COOKING_METHOD' | 'CUSTOM';

/** Narrow a raw DB string to NutritionSource; throws on unknown value rather than silently casting. */
function toNutritionSource(v: string): NutritionSource {
	if (v === 'COMPUTED' || v === 'MANUAL' || v === 'EXTERNAL') return v;
	throw new Error(`Unknown nutrition_source value from DB: ${v}`);
}

/** Narrow a raw DB string to TagCategory; throws on unknown value rather than silently casting. */
function toTagCategory(v: string): TagCategory {
	if (
		v === 'DIETARY' ||
		v === 'CUISINE' ||
		v === 'MEAL_TYPE' ||
		v === 'COOKING_METHOD' ||
		v === 'CUSTOM'
	)
		return v;
	throw new Error(`Unknown tag category value from DB: ${v}`);
}

// Row/Insert aliases derived from the generated Database type so the rest of the app never
// imports the generated file directly — `database.types.ts` stays a pure, re-generatable dump.
export type RecipeRow = Tables<'recipes'>;
export type RecipeIngredientRow = Tables<'recipe_ingredients'>;
export type RecipeStepRow = Tables<'recipe_steps'>;
export type RecipeTagRow = Tables<'recipe_tags'>;
export type UserRecipeMetaRow = Tables<'user_recipe_meta'>;
export type RecipeInsert = TablesInsert<'recipes'>;
export type RecipeUpdate = TablesUpdate<'recipes'>;
export type RecipeIngredientInsert = TablesInsert<'recipe_ingredients'>;
export type RecipeStepInsert = TablesInsert<'recipe_steps'>;
export type RecipeTagInsert = TablesInsert<'recipe_tags'>;

export interface NutritionInfo {
	calories: number;
	proteinGrams: number;
	carbsGrams: number;
	fatGrams: number;
	fiberGrams?: number;
	sugarGrams?: number;
	sodiumMg?: number;
	saturatedFatGrams?: number;
	cholesterolMg?: number;
}

export interface Recipe {
	id: string;
	ownerId: string;
	householdId: string | null;
	title: string;
	description: string | null;
	servings: number;
	prepTimeMinutes: number | null;
	cookTimeMinutes: number | null;
	activeTimeMinutes: number | null;
	totalTimeMinutes: number;
	cuisineType: string | null;
	mealTypes: string[];
	notes: string | null;
	imageUrl: string | null;
	sourceUrl: string | null;
	nutritionPerServing: NutritionInfo | null;
	nutritionSource: NutritionSource;
	createdAt: string;
	updatedAt: string;
}

export interface RecipeIngredient {
	id: string;
	recipeId: string;
	ingredientId: string | null;
	name: string;
	quantity: number;
	unit: string;
	preparation: string | null;
	isOptional: boolean;
	substituteFor: string | null;
	sortOrder: number;
}

export interface RecipeStep {
	id: string;
	recipeId: string;
	instruction: string;
	durationMinutes: number | null;
	timerMinutes: number | null;
	timerLabel: string | null;
	imageUrl: string | null;
	sortOrder: number;
}

export interface RecipeTag {
	id: string;
	recipeId: string;
	name: string;
	category: TagCategory;
}

export interface UserRecipeMeta {
	id: string;
	userId: string;
	recipeId: string;
	isFavorite: boolean;
	rating: number | null;
	timesCooked: number;
	lastCookedAt: string | null;
}

/** A recipe summary as shown in the library grid (joined with the caller's meta + its tags). */
export interface RecipeSummary extends Recipe {
	meta: UserRecipeMeta | null;
	tags: RecipeTag[];
}

/** A fully-loaded recipe for the detail/edit views. */
export interface RecipeWithDetail extends Recipe {
	ingredients: RecipeIngredient[];
	steps: RecipeStep[];
	tags: RecipeTag[];
	meta: UserRecipeMeta | null;
}

// --- Input shapes (no server-managed fields) -------------------------------------------------

export interface RecipeIngredientInput {
	/** Stable client-only key for list rendering/reordering (not persisted). */
	uid?: string;
	ingredientId?: string | null;
	name: string;
	quantity: number;
	unit: string;
	preparation?: string | null;
	isOptional?: boolean;
	/** Index into the same input's ingredients array this is a substitute for, or null. */
	substituteForIndex?: number | null;
	sortOrder: number;
}

export interface RecipeStepInput {
	/** Stable client-only key for list rendering/reordering (not persisted). */
	uid?: string;
	instruction: string;
	durationMinutes?: number | null;
	timerMinutes?: number | null;
	timerLabel?: string | null;
	imageUrl?: string | null;
	sortOrder: number;
}

export interface RecipeTagInput {
	name: string;
	category: TagCategory;
}

export interface RecipeInput {
	title: string;
	description?: string | null;
	servings: number;
	prepTimeMinutes?: number | null;
	cookTimeMinutes?: number | null;
	activeTimeMinutes?: number | null;
	cuisineType?: string | null;
	mealTypes?: string[];
	notes?: string | null;
	imageUrl?: string | null;
	sourceUrl?: string | null;
	nutritionPerServing?: NutritionInfo | null;
	nutritionSource?: NutritionSource;
	ingredients: RecipeIngredientInput[];
	steps: RecipeStepInput[];
	tags: RecipeTagInput[];
}

// --- Row → domain mappers --------------------------------------------------------------------

export function mapRecipe(row: RecipeRow): Recipe {
	return {
		id: row.id,
		ownerId: row.owner_id,
		householdId: row.household_id,
		title: row.title,
		description: row.description,
		servings: row.servings,
		prepTimeMinutes: row.prep_time_minutes,
		cookTimeMinutes: row.cook_time_minutes,
		activeTimeMinutes: row.active_time_minutes,
		totalTimeMinutes: row.total_time_minutes ?? 0, // generated col (gen types widens to nullable; formula never yields null)
		cuisineType: row.cuisine_type,
		mealTypes: row.meal_types,
		notes: row.notes,
		imageUrl: row.image_url,
		sourceUrl: row.source_url,
		nutritionPerServing: (row.nutrition_per_serving as NutritionInfo | null) ?? null,
		nutritionSource: toNutritionSource(row.nutrition_source),
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function mapIngredient(row: RecipeIngredientRow): RecipeIngredient {
	return {
		id: row.id,
		recipeId: row.recipe_id,
		ingredientId: row.ingredient_id,
		name: row.name,
		quantity: Number(row.quantity),
		unit: row.unit,
		preparation: row.preparation,
		isOptional: row.is_optional,
		substituteFor: row.substitute_for,
		sortOrder: row.sort_order
	};
}

export function mapStep(row: RecipeStepRow): RecipeStep {
	return {
		id: row.id,
		recipeId: row.recipe_id,
		instruction: row.instruction,
		durationMinutes: row.duration_minutes,
		timerMinutes: row.timer_minutes,
		timerLabel: row.timer_label,
		imageUrl: row.image_url,
		sortOrder: row.sort_order
	};
}

export function mapTag(row: RecipeTagRow): RecipeTag {
	return {
		id: row.id,
		recipeId: row.recipe_id,
		name: row.name,
		category: toTagCategory(row.category)
	};
}

export function mapMeta(row: UserRecipeMetaRow): UserRecipeMeta {
	return {
		id: row.id,
		userId: row.user_id,
		recipeId: row.recipe_id,
		isFavorite: row.is_favorite,
		rating: row.rating,
		timesCooked: row.times_cooked,
		lastCookedAt: row.last_cooked_at
	};
}
