// Typed data-access layer for meal logging, built on supabase-js / PostgREST.
// Every call runs under the caller's RLS context — no owner filters; the database
// enforces isolation. Errors surface as LogError with calm messages.
//
// Occurrence facts are append-only (INV-CC-004): the only UPDATE this service ever
// issues touches verdict/notes, matching the DB's annotation-only trigger.

import { supabase } from '$lib/supabaseClient';
import { currentUser } from '$lib/session/session.svelte';
import { plannedMealName } from '$lib/planning/types';
import {
	toMealLog,
	type MealLog,
	type MealLogDraft,
	type MealLogInsert,
	type MealVerdict
} from './types';

/** A normalized application error carrying a friendly message plus the original for logging. */
export class LogError extends Error {
	readonly cause?: unknown;
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'LogError';
		this.cause = cause;
	}
}

/** Return the signed-in user, throwing a LogError if the session has gone. */
async function requireSession() {
	const user = await currentUser();
	if (!user) throw new LogError('Your session has ended. Please sign in again.');
	return user;
}

/** Map a creation draft to insert columns (type↔reference rules live in the draft union). */
export function draftColumns(draft: MealLogDraft): MealLogInsert {
	const verdict = draft.verdict ?? null;
	switch (draft.kind) {
		case 'fromPlan':
			return {
				log_type: 'FROM_PLAN',
				planned_meal_id: draft.plannedMeal.id,
				recipe_id: draft.plannedMeal.recipeId,
				prepped_meal_id: draft.plannedMeal.preppedMealId,
				name_snapshot: plannedMealName(draft.plannedMeal),
				meal_slot: draft.plannedMeal.mealSlot,
				servings: draft.plannedMeal.servings,
				verdict
			};
		case 'fromPrepped':
			return {
				log_type: 'FROM_PREPPED',
				prepped_meal_id: draft.preppedMeal.id,
				name_snapshot: draft.preppedMeal.name,
				meal_slot: draft.slot,
				servings: draft.servings ?? 1,
				verdict
			};
		case 'fromRecipe':
			return {
				log_type: 'FROM_RECIPE',
				recipe_id: draft.recipeId,
				name_snapshot: draft.name,
				meal_slot: draft.slot,
				verdict
			};
		case 'quick':
			return { log_type: 'QUICK_LOG', meal_slot: draft.slot, verdict };
		case 'custom':
			return {
				log_type: 'CUSTOM',
				name_snapshot: draft.name,
				meal_slot: draft.slot,
				verdict
			};
	}
}

/** Insert one meal log from a draft. Returns the persisted, mapped row. */
export async function createLog(draft: MealLogDraft, loggedAt?: string): Promise<MealLog> {
	await requireSession();
	const columns = draftColumns(draft);
	const { data, error } = await supabase
		.from('meal_logs')
		.insert(loggedAt ? { ...columns, logged_at: loggedAt } : columns)
		.select()
		.single();
	if (error) throw new LogError("We couldn't save that log. Please try again.", error);
	return toMealLog(data);
}

/** Set or clear the verdict on an existing log (the annotation window, research R2). */
export async function setVerdict(logId: string, verdict: MealVerdict | null): Promise<MealLog> {
	await requireSession();
	const { data, error } = await supabase
		.from('meal_logs')
		.update({ verdict })
		.eq('id', logId)
		.select()
		.single();
	if (error) throw new LogError("We couldn't save that. Please try again.", error);
	return toMealLog(data);
}

/** Logs with logged_at in [fromISO, toISO), newest first (the Today window). */
export async function fetchLogsBetween(fromISO: string, toISO: string): Promise<MealLog[]> {
	await requireSession();
	const { data, error } = await supabase
		.from('meal_logs')
		.select('*')
		.gte('logged_at', fromISO)
		.lt('logged_at', toISO)
		.order('logged_at', { ascending: false });
	if (error) throw new LogError("We couldn't load today's logs. Please try again.", error);
	return (data ?? []).map(toMealLog);
}

/** Latest non-QUICK_LOG logs for recents/keepers grouping (research R7). */
export async function fetchRecentLogs(limit = 100): Promise<MealLog[]> {
	await requireSession();
	const { data, error } = await supabase
		.from('meal_logs')
		.select('*')
		.neq('log_type', 'QUICK_LOG')
		.order('logged_at', { ascending: false })
		.limit(limit);
	if (error) throw new LogError("We couldn't load your recent meals. Please try again.", error);
	return (data ?? []).map(toMealLog);
}

/**
 * Safe-flip a planned meal PLANNED → LOGGED (FR-TL-010, INV-PL-005). The status
 * predicate makes the transition happen at most once — returns false when another
 * writer (or a second tap) got there first.
 */
export async function markPlannedMealLogged(
	plannedMealId: string,
	loggedAt: string
): Promise<boolean> {
	await requireSession();
	const { data, error } = await supabase
		.from('planned_meals')
		.update({ status: 'LOGGED', logged_at: loggedAt })
		.eq('id', plannedMealId)
		.eq('status', 'PLANNED')
		.select('id');
	if (error) throw new LogError("We couldn't update your plan. Please try again.", error);
	return (data ?? []).length > 0;
}
