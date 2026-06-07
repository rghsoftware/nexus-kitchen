// Domain types for the recipes feature. These are camelCase application shapes mapped from the
// snake_case database rows in `$lib/database.types`. Repository functions return these.

import type {
	RecipeRow,
	RecipeIngredientRow,
	RecipeStepRow,
	RecipeTagRow,
	UserRecipeMetaRow,
	NutritionSource,
	TagCategory
} from '$lib/database.types';

export type { NutritionSource, TagCategory };

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
		totalTimeMinutes: row.total_time_minutes,
		cuisineType: row.cuisine_type,
		mealTypes: row.meal_types,
		notes: row.notes,
		imageUrl: row.image_url,
		sourceUrl: row.source_url,
		nutritionPerServing: (row.nutrition_per_serving as NutritionInfo | null) ?? null,
		nutritionSource: row.nutrition_source,
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
	return { id: row.id, recipeId: row.recipe_id, name: row.name, category: row.category };
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
