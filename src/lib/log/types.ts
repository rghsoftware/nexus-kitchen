// Domain types for meal logging (feature 006). CamelCase application shapes mapped
// from the snake_case rows in `$lib/database.types`; the service layer returns these.
//
// Canonical shape: Domain Specification `MealLog` (§4.8), amended by the spec's
// 2026-07-09 clarifications — three-way verdict (KEEP/FINE/REST) supersedes the
// four-value MealRating, and only verdict/notes are mutable after insert (INV-CC-004).

import type { Enums, Tables, TablesInsert } from '$lib/database.types';
import type { MealSlot } from '$lib/planning/types';
import type { PlannedMeal } from '$lib/planning/types';
import type { PreppedMeal } from '$lib/pantry/types';

export type MealLogType = Enums<'meal_log_type'>;
export type MealVerdict = Enums<'meal_verdict'>;

export type MealLogRow = Tables<'meal_logs'>;
export type MealLogInsert = TablesInsert<'meal_logs'>;

export interface MealLog {
	id: string;
	ownerId: string;
	logType: MealLogType;
	plannedMealId: string | null;
	recipeId: string | null;
	preppedMealId: string | null;
	nameSnapshot: string | null;
	mealSlot: MealSlot | null;
	servings: number;
	loggedAt: string; // ISO timestamptz
	verdict: MealVerdict | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Discriminated creation draft — makes the type↔reference rules (INV-XD-001/002)
 * unrepresentable client-side. `verdict` may ride along on any draft (log-time capture).
 */
export type MealLogDraft = { verdict?: MealVerdict | null } & (
	| { kind: 'fromPlan'; plannedMeal: PlannedMeal }
	| {
			kind: 'fromPrepped';
			preppedMeal: Pick<PreppedMeal, 'id' | 'name'>;
			slot: MealSlot | null;
			servings?: number;
	  }
	| { kind: 'fromRecipe'; recipeId: string; name: string; slot: MealSlot | null }
	| { kind: 'quick'; slot: MealSlot | null }
	| { kind: 'custom'; name: string; slot: MealSlot | null }
);

/** Display name for a log wherever it resurfaces ("Something" for bare quick logs). */
export function mealLogName(log: Pick<MealLog, 'nameSnapshot' | 'logType'>): string {
	return log.nameSnapshot ?? (log.logType === 'QUICK_LOG' ? 'Something' : 'Meal');
}

/** Human label for a verdict option — icon copy lives with the control. */
export function verdictLabel(verdict: MealVerdict): string {
	switch (verdict) {
		case 'KEEP':
			return 'Again';
		case 'FINE':
			return 'It was fine';
		case 'REST':
			return 'Not for me';
	}
}

/** Map a DB row to the app shape. `servings` is numeric in PG and may arrive as string. */
export function toMealLog(row: MealLogRow): MealLog {
	return {
		id: row.id,
		ownerId: row.owner_id,
		logType: row.log_type,
		plannedMealId: row.planned_meal_id,
		recipeId: row.recipe_id,
		preppedMealId: row.prepped_meal_id,
		nameSnapshot: row.name_snapshot,
		mealSlot: row.meal_slot,
		servings: Number(row.servings),
		loggedAt: row.logged_at,
		verdict: row.verdict,
		notes: row.notes,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}
