import { loadPreppedMeals } from '$lib/pantry/preppedMealStore.svelte';
import {
	addRecipe,
	cancelSession,
	completeSession,
	createSession,
	generatePrepShoppingList,
	getSessions,
	removeRecipe
} from './mealPrepService';
import type { MealPrepSession, NewMealPrepSession, NewSessionRecipe, YieldChoice } from './types';

// ---------------------------------------------------------------------------
// Module-level reactive state (Svelte 5 runes)
// ---------------------------------------------------------------------------

let _sessions = $state<MealPrepSession[]>([]);
let _loading = $state(false);
let _loaded = $state(false);
let _error = $state<string | null>(null);

// ---------------------------------------------------------------------------
// Public accessors
// ---------------------------------------------------------------------------

export function sessions(): MealPrepSession[] {
	return _sessions;
}
export function sessionsLoading(): boolean {
	return _loading;
}
export function sessionsLoaded(): boolean {
	return _loaded;
}
export function sessionsError(): string | null {
	return _error;
}

// Getter (a $derived cannot be exported from a .svelte.ts module); consumers wrap in $derived.
export function plannedSessions(): MealPrepSession[] {
	return _sessions.filter((s) => s.status === 'PLANNED');
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export async function loadSessions(): Promise<void> {
	_loading = true;
	_error = null;
	try {
		_sessions = await getSessions();
		_loaded = true;
	} catch (err) {
		_error = err instanceof Error ? err.message : 'Failed to load meal prep sessions';
	} finally {
		_loading = false;
	}
}

// ---------------------------------------------------------------------------
// Mutations — server is authoritative; we re-sync the affected session from its
// service result rather than guessing, keeping the optimistic surface honest.
// ---------------------------------------------------------------------------

export async function createSessionAction(draft: NewMealPrepSession): Promise<MealPrepSession> {
	const created = await createSession(draft);
	_sessions = [created, ..._sessions];
	return created;
}

export async function addRecipeAction(
	sessionId: string,
	recipe: NewSessionRecipe
): Promise<MealPrepSession> {
	const updated = await addRecipe(sessionId, recipe);
	replaceSession(updated);
	return updated;
}

export async function removeRecipeAction(
	sessionId: string,
	sessionRecipeId: string
): Promise<MealPrepSession> {
	const updated = await removeRecipe(sessionId, sessionRecipeId);
	replaceSession(updated);
	return updated;
}

export async function completeSessionAction(
	sessionId: string,
	yields: readonly YieldChoice[] = []
): Promise<MealPrepSession> {
	const updated = await completeSession(sessionId, yields);
	replaceSession(updated);
	// Yield landed new portions — refresh the prepped inventory so the Prepped tab reflects it.
	await loadPreppedMeals();
	return updated;
}

export async function cancelSessionAction(sessionId: string): Promise<MealPrepSession> {
	const updated = await cancelSession(sessionId);
	replaceSession(updated);
	return updated;
}

/** Build a FROM_PREP shopping list for the session's ingredient gap (REQ-PP-019..022). */
export async function buildPrepShoppingListAction(
	sessionId: string
): Promise<{ shoppingListId: string; itemCount: number }> {
	return generatePrepShoppingList(sessionId);
}

function replaceSession(updated: MealPrepSession): void {
	_sessions = _sessions.map((s) => (s.id === updated.id ? updated : s));
}
