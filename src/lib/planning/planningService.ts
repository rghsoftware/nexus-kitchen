// Typed data-access layer for planning, built on supabase-js / PostgREST. Every call runs
// under the caller's RLS context — the service passes no owner filters; the database
// enforces isolation (FR-PL-017). Errors surface as PlanningError with calm, friendly
// messages — never silently swallowed.
//
// Plans are implicit: one MealPlan per (owner, Monday-start week), acquired via upsert on
// the unique (owner_id, start_date) index so concurrent first-placements can't duplicate
// a week (FR-PL-011). Sort order appends at max(group)+1 with one retry when a concurrent
// writer takes the slot (INV-PL-012 backstop).

import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '$lib/supabaseClient';
import { ensureSession } from '$lib/session/session.svelte';
import { weekRangeOf } from './weekMath';
import {
	toMealPlan,
	toPlannedMeal,
	type ISODate,
	type MealPlan,
	type PlannedMeal,
	type PlannedMealDraft,
	type PlannedMealInsert,
	type PlannedMealPatch,
	type PlannedMealPlacement,
	type PlannedMealRow,
	type PlannedMealUpdate
} from './types';

/** A normalized application error carrying a friendly message plus the original for logging. */
export class PlanningError extends Error {
	readonly cause?: unknown;
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'PlanningError';
		this.cause = cause;
	}
}

type MaybePgError = Partial<PostgrestError> & { code?: string };

function isUniqueViolation(err: MaybePgError | null | undefined): boolean {
	return err?.code === '23505';
}

/** Ensure a session exists, throwing a PlanningError if sign-in failed. */
async function requireSession() {
	const user = await ensureSession();
	if (!user) throw new PlanningError("We couldn't start a session. Try refreshing the page.");
	return user;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

/**
 * Find or create the implicit plan for the week containing `dateISO` (FR-PL-011).
 * Monday-start week (A-009). Upsert on (owner_id, start_date) — race-safe.
 */
export async function getOrCreatePlanForWeek(dateISO: ISODate): Promise<MealPlan> {
	await requireSession();
	const { start, end } = weekRangeOf(dateISO);

	const { data, error } = await supabase
		.from('meal_plans')
		.upsert({ start_date: start, end_date: end }, { onConflict: 'owner_id,start_date' })
		.select()
		.single();
	if (error) throw new PlanningError("We couldn't open that week. Please try again.", error);
	return toMealPlan(data);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * All planned meals with date in [fromISO, toISO], owner-scoped by RLS, ordered by
 * date, slot band (Anytime last), then saved sort order. Feeds every calendar view.
 */
export async function listPlannedMeals(fromISO: ISODate, toISO: ISODate): Promise<PlannedMeal[]> {
	await requireSession();
	const { data, error } = await supabase
		.from('planned_meals')
		.select('*')
		.gte('date', fromISO)
		.lte('date', toISO)
		.order('date')
		.order('meal_slot', { nullsFirst: false })
		.order('sort_order');
	if (error) throw new PlanningError("We couldn't load your plan. Please try again.", error);
	return (data ?? []).map(toPlannedMeal);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/** Next append position within a (plan, date, slot) group (FR-PL-010). */
async function nextSortOrder(
	mealPlanId: string,
	date: ISODate,
	mealSlot: PlannedMeal['mealSlot']
): Promise<number> {
	let query = supabase
		.from('planned_meals')
		.select('sort_order')
		.eq('meal_plan_id', mealPlanId)
		.eq('date', date);
	query = mealSlot === null ? query.is('meal_slot', null) : query.eq('meal_slot', mealSlot);

	const { data, error } = await query.order('sort_order', { ascending: false }).limit(1);
	if (error) throw new PlanningError("We couldn't place that meal. Please try again.", error);
	return data && data.length > 0 ? data[0].sort_order + 1 : 0;
}

/** Map a creation draft to the exactly-one-source insert columns (INV-PL-003). */
function draftColumns(draft: PlannedMealDraft): Partial<PlannedMealInsert> {
	switch (draft.source) {
		case 'RECIPE':
			return {
				source: 'RECIPE',
				recipe_id: draft.recipeId,
				recipe_title_snapshot: draft.recipeTitle
			};
		case 'PREPPED':
			// Like RECIPE, the required reference is the name snapshot; the id FK may
			// null out if the portion is later deleted (migration 0006, FR-FS-011).
			return {
				source: 'PREPPED',
				prepped_meal_id: draft.preppedMealId,
				prepped_name_snapshot: draft.preppedName
			};
		case 'STORE_BOUGHT':
			return { source: 'STORE_BOUGHT', store_bought_name: draft.storeBoughtName };
		case 'QUICK':
			return { source: 'QUICK', quick_meal_name: draft.quickMealName };
	}
}

/**
 * Create a planned meal at `placement` (FR-PL-005..010). Resolves the target week's
 * implicit plan, appends to the (date, slot) group, retries once if a concurrent
 * writer takes the same sort position.
 */
export async function addPlannedMeal(
	draft: PlannedMealDraft,
	placement: PlannedMealPlacement
): Promise<PlannedMeal> {
	const plan = await getOrCreatePlanForWeek(placement.date);

	const insertOnce = async (): Promise<{ data: PlannedMealRow | null; error: unknown }> => {
		const sortOrder = await nextSortOrder(plan.id, placement.date, placement.mealSlot);
		const payload: PlannedMealInsert = {
			meal_plan_id: plan.id,
			date: placement.date,
			meal_slot: placement.mealSlot,
			servings: draft.servings,
			sort_order: sortOrder,
			...draftColumns(draft)
		} as PlannedMealInsert;
		return supabase.from('planned_meals').insert(payload).select().single();
	};

	let { data, error } = await insertOnce();
	if (isUniqueViolation(error as MaybePgError)) {
		({ data, error } = await insertOnce());
	}
	if (error || !data) {
		throw new PlanningError("We couldn't add that meal. Please try again.", error);
	}
	return toPlannedMeal(data);
}

/** Map a camelCase patch to snake_case update columns. */
function patchColumns(patch: PlannedMealPatch): PlannedMealUpdate {
	const out: PlannedMealUpdate = {};
	if (patch.servings !== undefined) out.servings = patch.servings;
	if (patch.mealSlot !== undefined) out.meal_slot = patch.mealSlot;
	if (patch.storeBoughtName !== undefined) out.store_bought_name = patch.storeBoughtName;
	if (patch.quickMealName !== undefined) out.quick_meal_name = patch.quickMealName;
	if (patch.recipeId !== undefined) out.recipe_id = patch.recipeId;
	if (patch.recipeTitleSnapshot !== undefined)
		out.recipe_title_snapshot = patch.recipeTitleSnapshot;
	return out;
}

/** Fetch a single planned meal row (internal helper for slot/move re-homing). */
async function getPlannedMealRow(id: string): Promise<PlannedMealRow> {
	const { data, error } = await supabase.from('planned_meals').select('*').eq('id', id).single();
	if (error || !data) {
		throw new PlanningError("We couldn't find that meal — it may have been removed.", error);
	}
	return data;
}

/**
 * Patch servings / slot / source details of an existing meal (FR-PL-012).
 * A slot change re-appends within the new (date, slot) group to keep INV-PL-012.
 */
export async function updatePlannedMeal(id: string, patch: PlannedMealPatch): Promise<PlannedMeal> {
	await requireSession();
	const columns = patchColumns(patch);

	const applyOnce = async (): Promise<{ data: PlannedMealRow | null; error: unknown }> => {
		if (patch.mealSlot !== undefined) {
			const current = await getPlannedMealRow(id);
			columns.sort_order = await nextSortOrder(current.meal_plan_id, current.date, patch.mealSlot);
		}
		return supabase.from('planned_meals').update(columns).eq('id', id).select().single();
	};

	let { data, error } = await applyOnce();
	if (patch.mealSlot !== undefined && isUniqueViolation(error as MaybePgError)) {
		({ data, error } = await applyOnce());
	}
	if (error || !data) {
		throw new PlanningError("We couldn't save those changes. Please try again.", error);
	}
	return toPlannedMeal(data);
}

/**
 * Move a meal to a new date and/or slot (FR-PL-013, FR-PL-015). Cross-week moves
 * re-home to the target week's implicit plan (auto-creating it), so INV-PL-002 holds.
 */
export async function movePlannedMeal(
	id: string,
	target: PlannedMealPlacement
): Promise<PlannedMeal> {
	const plan = await getOrCreatePlanForWeek(target.date);

	const applyOnce = async (): Promise<{ data: PlannedMealRow | null; error: unknown }> => {
		const sortOrder = await nextSortOrder(plan.id, target.date, target.mealSlot);
		return supabase
			.from('planned_meals')
			.update({
				meal_plan_id: plan.id,
				date: target.date,
				meal_slot: target.mealSlot,
				sort_order: sortOrder
			})
			.eq('id', id)
			.select()
			.single();
	};

	let { data, error } = await applyOnce();
	if (isUniqueViolation(error as MaybePgError)) {
		({ data, error } = await applyOnce());
	}
	if (error || !data) {
		throw new PlanningError("We couldn't move that meal. Please try again.", error);
	}
	return toPlannedMeal(data);
}

/** Delete a planned meal (FR-PL-014). */
export async function removePlannedMeal(id: string): Promise<void> {
	await requireSession();
	const { error } = await supabase.from('planned_meals').delete().eq('id', id);
	if (error) throw new PlanningError("We couldn't remove that meal. Please try again.", error);
}
