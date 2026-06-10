// Domain types for the planning feature. CamelCase application shapes mapped from the
// snake_case database rows in `$lib/database.types`. The service layer returns these.
//
// Canonical shapes: Domain Specification §2.4 (Planning Context). Fulfillment state
// (HAVE_IT / CAN_MAKE_IT / MUST_ACQUIRE) is derived, never stored (INV-PL-017), and is
// not computed in this chunk at all.

import type { Enums, Tables, TablesInsert, TablesUpdate } from '$lib/database.types';

// These are real Postgres enums, so the generated types carry the exact unions.
export type MealSlot = Enums<'meal_slot'>;
export type PlannedMealSource = Enums<'planned_meal_source'>;
export type PlannedMealStatus = Enums<'planned_meal_status'>;

// Row/Insert aliases so the rest of the app never imports the generated file directly.
export type MealPlanRow = Tables<'meal_plans'>;
export type PlannedMealRow = Tables<'planned_meals'>;
export type MealPlanInsert = TablesInsert<'meal_plans'>;
export type PlannedMealInsert = TablesInsert<'planned_meals'>;
export type PlannedMealUpdate = TablesUpdate<'planned_meals'>;

/** Slot bands in display order; the unslotted "Anytime" group renders after these. */
export const MEAL_SLOTS: readonly MealSlot[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

/** A civil date string, YYYY-MM-DD. Never a Date object — see weekMath.ts (A-006). */
export type ISODate = string;

export interface MealPlan {
	id: string;
	ownerId: string;
	name: string | null;
	startDate: ISODate; // Monday (A-009)
	endDate: ISODate; // Sunday
	createdAt: string;
	updatedAt: string;
}

export interface PlannedMeal {
	id: string;
	mealPlanId: string;
	date: ISODate;
	mealSlot: MealSlot | null; // null = unslotted ("Anytime")
	source: PlannedMealSource;
	recipeId: string | null;
	recipeTitleSnapshot: string | null;
	storeBoughtName: string | null;
	quickMealName: string | null;
	servings: number;
	status: PlannedMealStatus;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

/**
 * Discriminated creation draft — makes INV-PL-003 (exactly one source reference)
 * unrepresentable client-side. PREPPED is deliberately absent this chunk (A-003).
 */
export type PlannedMealDraft =
	| { source: 'RECIPE'; recipeId: string; recipeTitle: string; servings: number }
	| { source: 'STORE_BOUGHT'; storeBoughtName: string; servings: number }
	| { source: 'QUICK'; quickMealName: string; servings: number };

/** Where a meal lands on the calendar. */
export interface PlannedMealPlacement {
	date: ISODate;
	mealSlot: MealSlot | null;
}

/** Fields editable in place on an existing planned meal (FR-PL-012). */
export interface PlannedMealPatch {
	servings?: number;
	mealSlot?: MealSlot | null;
	storeBoughtName?: string;
	quickMealName?: string;
	recipeId?: string;
	recipeTitleSnapshot?: string;
}

/** Display name for a planned meal regardless of source (FR-PL-003). */
export function plannedMealName(meal: PlannedMeal): string {
	switch (meal.source) {
		case 'RECIPE':
			return meal.recipeTitleSnapshot ?? 'Recipe';
		case 'STORE_BOUGHT':
			return meal.storeBoughtName ?? 'Store-bought';
		case 'QUICK':
			return meal.quickMealName ?? 'Quick meal';
		case 'PREPPED':
			return 'Prepped meal'; // reserved; not creatable this chunk
	}
}

/** Human label for a slot band; null = the unslotted group. */
export function mealSlotLabel(slot: MealSlot | null): string {
	switch (slot) {
		case 'BREAKFAST':
			return 'Breakfast';
		case 'LUNCH':
			return 'Lunch';
		case 'DINNER':
			return 'Dinner';
		case 'SNACK':
			return 'Snack';
		case null:
			return 'Anytime';
	}
}

/** Map a DB row to the app shape. */
export function toMealPlan(row: MealPlanRow): MealPlan {
	return {
		id: row.id,
		ownerId: row.owner_id,
		name: row.name,
		startDate: row.start_date,
		endDate: row.end_date,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** Map a DB row to the app shape. `servings` is numeric in PG and arrives as a number. */
export function toPlannedMeal(row: PlannedMealRow): PlannedMeal {
	return {
		id: row.id,
		mealPlanId: row.meal_plan_id,
		date: row.date,
		mealSlot: row.meal_slot,
		source: row.source,
		recipeId: row.recipe_id,
		recipeTitleSnapshot: row.recipe_title_snapshot,
		storeBoughtName: row.store_bought_name,
		quickMealName: row.quick_meal_name,
		servings: Number(row.servings),
		status: row.status,
		sortOrder: row.sort_order,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}
