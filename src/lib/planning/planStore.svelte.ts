// Runes-based store for the planning calendar. Holds the planned meals for the
// currently-loaded date range with optimistic add/update/move/remove and server
// reconciliation (P15: online-first, server authoritative, rollback on failure).

import {
	addPlannedMeal,
	listPlannedMeals,
	movePlannedMeal,
	removePlannedMeal,
	updatePlannedMeal
} from './planningService';
import type {
	ISODate,
	MealSlot,
	PlannedMeal,
	PlannedMealDraft,
	PlannedMealPatch,
	PlannedMealPlacement
} from './types';

// ---------------------------------------------------------------------------
// Module-level reactive state (Svelte 5 runes)
// ---------------------------------------------------------------------------

let _meals = $state<PlannedMeal[]>([]);
let _range = $state<{ from: ISODate; to: ISODate } | null>(null);
let _loading = $state(false);
let _error = $state<string | null>(null);

let tempCounter = 0;

// ---------------------------------------------------------------------------
// Public accessors (getter functions so consumers can read reactive state)
// ---------------------------------------------------------------------------

export function plannedMeals(): PlannedMeal[] {
	return _meals;
}
export function planLoading(): boolean {
	return _loading;
}
export function planError(): string | null {
	return _error;
}
export function loadedRange(): { from: ISODate; to: ISODate } | null {
	return _range;
}
export function clearPlanError(): void {
	_error = null;
}

// ---------------------------------------------------------------------------
// Derived views (getter functions — consumers wrap in $derived)
// ---------------------------------------------------------------------------

/** Band display order; the unslotted "Anytime" group renders last. */
function slotRank(slot: MealSlot | null): number {
	switch (slot) {
		case 'BREAKFAST':
			return 0;
		case 'LUNCH':
			return 1;
		case 'DINNER':
			return 2;
		case 'SNACK':
			return 3;
		case null:
			return 4;
	}
}

/** All meals on a date, ordered by slot band then saved sort order (INV-PL-012). */
export function mealsOn(date: ISODate): PlannedMeal[] {
	return _meals
		.filter((m) => m.date === date)
		.sort((a, b) => slotRank(a.mealSlot) - slotRank(b.mealSlot) || a.sortOrder - b.sortOrder);
}

/** Meals in one (date, slot) group in saved order. `null` slot = the Anytime group. */
export function mealsInGroup(date: ISODate, slot: MealSlot | null): PlannedMeal[] {
	return _meals
		.filter((m) => m.date === date && m.mealSlot === slot)
		.sort((a, b) => a.sortOrder - b.sortOrder);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export async function loadRange(from: ISODate, to: ISODate): Promise<void> {
	_loading = true;
	_error = null;
	try {
		_meals = await listPlannedMeals(from, to);
		_range = { from, to };
	} catch (err) {
		_error = err instanceof Error ? err.message : 'Failed to load your plan';
	} finally {
		_loading = false;
	}
}

// ---------------------------------------------------------------------------
// Optimistic writes
// ---------------------------------------------------------------------------

function inRange(date: ISODate): boolean {
	return _range !== null && date >= _range.from && date <= _range.to;
}

function nextLocalSortOrder(date: ISODate, slot: MealSlot | null): number {
	const group = mealsInGroup(date, slot);
	return group.length > 0 ? group[group.length - 1].sortOrder + 1 : 0;
}

/** Replace the meal with `id` by `meal`, or drop it when the server row left the range. */
function reconcile(id: string, meal: PlannedMeal): void {
	if (inRange(meal.date)) {
		_meals = _meals.map((m) => (m.id === id ? meal : m));
	} else {
		_meals = _meals.filter((m) => m.id !== id);
	}
}

/**
 * Optimistically add a meal, reconciling with the server row. Returns the created
 * meal, or null on failure (state rolled back, error surfaced via planError()).
 */
export async function addMeal(
	draft: PlannedMealDraft,
	placement: PlannedMealPlacement
): Promise<PlannedMeal | null> {
	const tempId = `temp-${++tempCounter}`;
	const optimistic: PlannedMeal = {
		id: tempId,
		mealPlanId: 'pending',
		date: placement.date,
		mealSlot: placement.mealSlot,
		source: draft.source,
		recipeId: draft.source === 'RECIPE' ? draft.recipeId : null,
		recipeTitleSnapshot: draft.source === 'RECIPE' ? draft.recipeTitle : null,
		storeBoughtName: draft.source === 'STORE_BOUGHT' ? draft.storeBoughtName : null,
		quickMealName: draft.source === 'QUICK' ? draft.quickMealName : null,
		servings: draft.servings,
		status: 'PLANNED',
		sortOrder: nextLocalSortOrder(placement.date, placement.mealSlot),
		createdAt: '',
		updatedAt: ''
	};
	_meals = [..._meals, optimistic];
	_error = null;

	try {
		const created = await addPlannedMeal(draft, placement);
		reconcile(tempId, created);
		return created;
	} catch (err) {
		_meals = _meals.filter((m) => m.id !== tempId);
		_error = err instanceof Error ? err.message : 'Failed to add that meal';
		return null;
	}
}

/** Optimistically patch a meal. Returns the updated meal, or null on rollback. */
export async function updateMeal(id: string, patch: PlannedMealPatch): Promise<PlannedMeal | null> {
	const before = _meals.find((m) => m.id === id);
	if (!before) return null;

	const optimistic: PlannedMeal = {
		...before,
		servings: patch.servings ?? before.servings,
		mealSlot: patch.mealSlot !== undefined ? patch.mealSlot : before.mealSlot,
		storeBoughtName: patch.storeBoughtName ?? before.storeBoughtName,
		quickMealName: patch.quickMealName ?? before.quickMealName,
		recipeId: patch.recipeId ?? before.recipeId,
		recipeTitleSnapshot: patch.recipeTitleSnapshot ?? before.recipeTitleSnapshot
	};
	if (patch.mealSlot !== undefined && patch.mealSlot !== before.mealSlot) {
		optimistic.sortOrder = nextLocalSortOrder(before.date, patch.mealSlot);
	}
	_meals = _meals.map((m) => (m.id === id ? optimistic : m));
	_error = null;

	try {
		const updated = await updatePlannedMeal(id, patch);
		reconcile(id, updated);
		return updated;
	} catch (err) {
		_meals = _meals.map((m) => (m.id === id ? before : m));
		_error = err instanceof Error ? err.message : 'Failed to save those changes';
		return null;
	}
}

/** Optimistically move a meal to a new date/slot. Returns the moved meal, or null. */
export async function moveMeal(
	id: string,
	target: PlannedMealPlacement
): Promise<PlannedMeal | null> {
	const before = _meals.find((m) => m.id === id);
	if (!before) return null;
	if (before.date === target.date && before.mealSlot === target.mealSlot) return before;

	const optimistic: PlannedMeal = {
		...before,
		date: target.date,
		mealSlot: target.mealSlot,
		sortOrder: nextLocalSortOrder(target.date, target.mealSlot)
	};
	_meals = _meals.map((m) => (m.id === id ? optimistic : m));
	_error = null;

	try {
		const moved = await movePlannedMeal(id, target);
		reconcile(id, moved);
		return moved;
	} catch (err) {
		_meals = _meals.map((m) => (m.id === id ? before : m));
		_error = err instanceof Error ? err.message : 'Failed to move that meal';
		return null;
	}
}

/** Optimistically remove a meal. Returns true on success, false on rollback. */
export async function removeMeal(id: string): Promise<boolean> {
	const before = _meals;
	const target = _meals.find((m) => m.id === id);
	if (!target) return false;

	_meals = _meals.filter((m) => m.id !== id);
	_error = null;

	try {
		await removePlannedMeal(id);
		return true;
	} catch (err) {
		_meals = before;
		_error = err instanceof Error ? err.message : 'Failed to remove that meal';
		return false;
	}
}
