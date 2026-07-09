// Runes-based store for meal logging (feature 006). Holds today's logs plus the
// recent-log pool for recents/keepers/recap, with optimistic writes and server
// reconciliation (P15). `logMeal` orchestrates the multi-write flows: log first
// (the user's truth), then follow-ups — portion consumption for prepped meals,
// the PLANNED → LOGGED flip for planned meals. Follow-up failures keep the log
// and surface a calm notice instead of throwing (research R5, FR-TL-014).

import { optimisticConsumePortions } from '$lib/pantry/preppedMealStore.svelte';
import { markMealLoggedLocally } from '$lib/planning/planStore.svelte';
import { plannedMealName } from '$lib/planning/types';
import {
	createLog,
	fetchLogsBetween,
	fetchRecentLogs,
	markPlannedMealLogged,
	setVerdict
} from './logService';
import { localDayBounds } from './slots';
import { groupLogSources, type LoggedSource } from './derive';
import type { MealLog, MealLogDraft, MealVerdict } from './types';

// ---------------------------------------------------------------------------
// Module-level reactive state (Svelte 5 runes)
// ---------------------------------------------------------------------------

let _todayLogs = $state<MealLog[]>([]);
let _recentLogs = $state<MealLog[]>([]);
let _loading = $state(false);
let _error = $state<string | null>(null);
let _notice = $state<string | null>(null);

let tempCounter = 0;
// Double-tap guard — bookkeeping only, nothing renders from it.
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const inFlight = new Set<string>();

// ---------------------------------------------------------------------------
// Public accessors (getter functions so consumers can read reactive state)
// ---------------------------------------------------------------------------

export function todayLogs(): MealLog[] {
	return _todayLogs;
}
export function recentLogs(): MealLog[] {
	return _recentLogs;
}
export function recentSources(): LoggedSource[] {
	return groupLogSources(_recentLogs);
}
export function logLoading(): boolean {
	return _loading;
}
export function logError(): string | null {
	return _error;
}
/** Calm partial-failure notice (FR-TL-014); cleared via clearLogNotice. */
export function logNotice(): string | null {
	return _notice;
}
export function clearLogError(): void {
	_error = null;
}
export function clearLogNotice(): void {
	_notice = null;
}

// ---------------------------------------------------------------------------
// Loads
// ---------------------------------------------------------------------------

// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient timestamp, never reactive state
export async function loadToday(now: Date = new Date()): Promise<void> {
	_loading = true;
	_error = null;
	try {
		const { fromISO, toISO } = localDayBounds(now);
		_todayLogs = await fetchLogsBetween(fromISO, toISO);
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't load today's logs.";
	} finally {
		_loading = false;
	}
}

export async function loadRecents(): Promise<void> {
	try {
		_recentLogs = await fetchRecentLogs();
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't load your recent meals.";
	}
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Identity for the double-tap guard: same source, same moment ⇒ one log. */
function draftGuardKey(draft: MealLogDraft): string {
	switch (draft.kind) {
		case 'fromPlan':
			return `plan:${draft.plannedMeal.id}`;
		case 'fromPrepped':
			return `prepped:${draft.preppedMeal.id}`;
		case 'fromRecipe':
			return `recipe:${draft.recipeId}`;
		case 'quick':
		case 'custom':
			return `once:${draft.kind}`;
	}
}

function upsertLocal(log: MealLog, replaceId?: string): void {
	const swap = (list: MealLog[]) => {
		const without = replaceId ? list.filter((l) => l.id !== replaceId) : list;
		return [log, ...without.filter((l) => l.id !== log.id)];
	};
	_todayLogs = swap(_todayLogs);
	if (log.logType !== 'QUICK_LOG') _recentLogs = swap(_recentLogs);
}

function removeLocal(id: string): void {
	_todayLogs = _todayLogs.filter((l) => l.id !== id);
	_recentLogs = _recentLogs.filter((l) => l.id !== id);
}

/**
 * One-tap log (FR-TL-009/012/013/014). Optimistic append; insert failure rolls the
 * optimistic row back and sets logError. Follow-up failures (portion event, plan
 * flip) keep the log and set logNotice. Returns the saved log, or null when the
 * insert failed or an identical log is already in flight (double-tap guard).
 */
export async function logMeal(draft: MealLogDraft): Promise<MealLog | null> {
	const guard = draftGuardKey(draft);
	if (inFlight.has(guard)) return null;
	inFlight.add(guard);

	const tempId = `temp-${++tempCounter}`;
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient timestamp, never reactive state
	const nowISO = new Date().toISOString();
	const optimistic = optimisticLog(draft, tempId, nowISO);
	upsertLocal(optimistic);
	_error = null;

	try {
		let saved: MealLog;
		try {
			saved = await createLog(draft, nowISO);
		} catch (err) {
			removeLocal(tempId);
			_error = err instanceof Error ? err.message : "We couldn't save that log.";
			return null;
		}
		upsertLocal(saved, tempId);

		if (draft.kind === 'fromPrepped') {
			try {
				await optimisticConsumePortions(draft.preppedMeal.id, draft.servings ?? 1, {
					triggeredBy: saved.id
				});
			} catch {
				_notice = "Logged! We couldn't update the pantry count — it'll sort itself out online.";
			}
		} else if (draft.kind === 'fromPlan') {
			try {
				await markPlannedMealLogged(draft.plannedMeal.id, saved.loggedAt);
				markMealLoggedLocally(draft.plannedMeal.id);
			} catch {
				_notice = "Logged! We couldn't mark it in your plan — it'll catch up next refresh.";
			}
			// A planned meal backed by a prepped portion is consumption too (INV-XD-003).
			if (draft.plannedMeal.preppedMealId) {
				try {
					await optimisticConsumePortions(draft.plannedMeal.preppedMealId, saved.servings, {
						triggeredBy: saved.id
					});
				} catch {
					_notice = "Logged! We couldn't update the pantry count — it'll sort itself out online.";
				}
			}
		}
		return saved;
	} finally {
		inFlight.delete(guard);
	}
}

/** Optimistic set/clear of a verdict on a log (FR-TL-015/016). */
export async function rateLog(logId: string, verdict: MealVerdict | null): Promise<void> {
	const beforeToday = _todayLogs;
	const beforeRecent = _recentLogs;
	const patch = (list: MealLog[]) => list.map((l) => (l.id === logId ? { ...l, verdict } : l));
	_todayLogs = patch(_todayLogs);
	_recentLogs = patch(_recentLogs);

	try {
		const saved = await setVerdict(logId, verdict);
		const reconcile = (list: MealLog[]) => list.map((l) => (l.id === logId ? saved : l));
		_todayLogs = reconcile(_todayLogs);
		_recentLogs = reconcile(_recentLogs);
	} catch (err) {
		_todayLogs = beforeToday;
		_recentLogs = beforeRecent;
		_error = err instanceof Error ? err.message : "We couldn't save that.";
	}
}

// ---------------------------------------------------------------------------
// Optimistic shapes
// ---------------------------------------------------------------------------

function optimisticLog(draft: MealLogDraft, id: string, loggedAt: string): MealLog {
	const base = {
		id,
		ownerId: 'me', // placeholder; reconciled with the server row
		plannedMealId: null as string | null,
		recipeId: null as string | null,
		preppedMealId: null as string | null,
		nameSnapshot: null as string | null,
		mealSlot: null as MealLog['mealSlot'],
		servings: 1,
		loggedAt,
		verdict: draft.verdict ?? null,
		notes: null,
		createdAt: loggedAt,
		updatedAt: loggedAt
	};
	switch (draft.kind) {
		case 'fromPlan':
			return {
				...base,
				logType: 'FROM_PLAN',
				plannedMealId: draft.plannedMeal.id,
				recipeId: draft.plannedMeal.recipeId,
				preppedMealId: draft.plannedMeal.preppedMealId,
				nameSnapshot: plannedMealName(draft.plannedMeal),
				mealSlot: draft.plannedMeal.mealSlot,
				servings: draft.plannedMeal.servings
			};
		case 'fromPrepped':
			return {
				...base,
				logType: 'FROM_PREPPED',
				preppedMealId: draft.preppedMeal.id,
				nameSnapshot: draft.preppedMeal.name,
				mealSlot: draft.slot,
				servings: draft.servings ?? 1
			};
		case 'fromRecipe':
			return {
				...base,
				logType: 'FROM_RECIPE',
				recipeId: draft.recipeId,
				nameSnapshot: draft.name,
				mealSlot: draft.slot
			};
		case 'quick':
			return { ...base, logType: 'QUICK_LOG', mealSlot: draft.slot };
		case 'custom':
			return { ...base, logType: 'CUSTOM', nameSnapshot: draft.name, mealSlot: draft.slot };
	}
}
