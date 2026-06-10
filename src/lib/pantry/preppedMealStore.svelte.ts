import { supabase } from '$lib/supabaseClient';
import {
	addPreppedMeal,
	consumePortions,
	correctPortions,
	getPreppedMeals,
	markDefrostReady,
	startDefrost,
	updatePreppedMeal
} from './preppedMealService';
import {
	toPreppedMeal,
	type NewPreppedMeal,
	type PreppedMeal,
	type PreppedMealUpdate
} from './types';

// ---------------------------------------------------------------------------
// Module-level reactive state (Svelte 5 runes)
// ---------------------------------------------------------------------------

let _meals = $state<PreppedMeal[]>([]);
let _loading = $state(false);
let _error = $state<string | null>(null);

// ---------------------------------------------------------------------------
// Public accessors
// ---------------------------------------------------------------------------

export function preppedMeals(): PreppedMeal[] {
	return _meals;
}
export function preppedMealsLoading(): boolean {
	return _loading;
}
export function preppedMealsError(): string | null {
	return _error;
}

// ---------------------------------------------------------------------------
// Derived views (ordered by expiration_date ascending for eat-this-first)
// ---------------------------------------------------------------------------

// Getter functions — $derived cannot be exported from a .svelte.ts module
// (Svelte compiler error: derived_invalid_export). Consumers wrap these
// calls in a local $derived to get reactive re-evaluation.
export function expiringSoonPrepped(): PreppedMeal[] {
	return _meals.filter((m) => m.isExpiringSoon);
}
export function readyToEat(): PreppedMeal[] {
	return _meals.filter((m) => m.isReadyToEat);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export async function loadPreppedMeals(householdId?: string | null): Promise<void> {
	_loading = true;
	_error = null;
	try {
		_meals = await getPreppedMeals(householdId);
	} catch (err) {
		_error = err instanceof Error ? err.message : 'Failed to load prepped meals';
	} finally {
		_loading = false;
	}
}

// ---------------------------------------------------------------------------
// Optimistic writes
// ---------------------------------------------------------------------------

export async function optimisticAddPreppedMeal(meal: NewPreppedMeal): Promise<PreppedMeal> {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- non-reactive timestamp, not UI state
	const nowIso = new Date(Date.now()).toISOString();
	const placeholder: PreppedMeal = {
		id: crypto.randomUUID(),
		created_at: nowIso,
		updated_at: nowIso,
		owner_id: meal.owner_id,
		origin: meal.origin,
		name: meal.name,
		storage_location: meal.storage_location,
		prepared_date: meal.prepared_date,
		expiration_date: meal.expiration_date,
		portions_remaining: meal.portions_remaining ?? 0,
		original_portions: meal.original_portions,
		defrost_state: meal.defrost_state ?? 'NOT_APPLICABLE',
		household_id: meal.household_id ?? null,
		recipe_id: meal.recipe_id ?? null,
		recipe_name: meal.recipe_name ?? null,
		meal_prep_session_id: meal.meal_prep_session_id ?? null,
		container_label: meal.container_label ?? null,
		defrost_started_at: meal.defrost_started_at ?? null,
		estimated_ready_at: meal.estimated_ready_at ?? null,
		photo_url: meal.photo_url ?? null,
		isExpiringSoon: false,
		isExpired: false,
		isReadyToEat: meal.storage_location !== 'FREEZER'
	};
	_meals = [..._meals, placeholder];

	try {
		const saved = await addPreppedMeal(meal);
		_meals = _meals.map((m) => (m.id === placeholder.id ? saved : m));
		return saved;
	} catch (err) {
		_meals = _meals.filter((m) => m.id !== placeholder.id);
		throw err;
	}
}

export async function optimisticUpdatePreppedMeal(
	id: string,
	changes: PreppedMealUpdate
): Promise<PreppedMeal> {
	const prev = _meals.find((m) => m.id === id);
	if (prev) {
		_meals = _meals.map((m) => (m.id === id ? toPreppedMeal({ ...m, ...changes }) : m));
	}
	try {
		const saved = await updatePreppedMeal(id, changes);
		_meals = _meals.map((m) => (m.id === id ? saved : m));
		return saved;
	} catch (err) {
		if (prev) _meals = _meals.map((m) => (m.id === id ? prev : m));
		throw err;
	}
}

export async function optimisticConsumePortions(
	preppedMealId: string,
	count: number
): Promise<void> {
	const prev = _meals.find((m) => m.id === preppedMealId);
	if (prev) {
		const updated = toPreppedMeal({
			...prev,
			portions_remaining: Math.max(0, prev.portions_remaining - count)
		});
		_meals = _meals.map((m) => (m.id === preppedMealId ? updated : m));
	}
	try {
		await consumePortions(preppedMealId, count);
		// Re-sync from DB after trigger runs (portions_remaining is authoritative there)
		const { data } = await supabase
			.from('prepped_meals')
			.select('*')
			.eq('id', preppedMealId)
			.single();
		if (data) _meals = _meals.map((m) => (m.id === preppedMealId ? toPreppedMeal(data) : m));
	} catch (err) {
		if (prev) _meals = _meals.map((m) => (m.id === preppedMealId ? prev : m));
		throw err;
	}
}

export async function optimisticCorrectPortions(
	preppedMealId: string,
	newCount: number
): Promise<void> {
	const prev = _meals.find((m) => m.id === preppedMealId);
	if (prev) {
		const updated = toPreppedMeal({ ...prev, portions_remaining: newCount });
		_meals = _meals.map((m) => (m.id === preppedMealId ? updated : m));
	}
	try {
		await correctPortions(preppedMealId, prev?.portions_remaining ?? 0, newCount);
		const { data } = await supabase
			.from('prepped_meals')
			.select('*')
			.eq('id', preppedMealId)
			.single();
		if (data) _meals = _meals.map((m) => (m.id === preppedMealId ? toPreppedMeal(data) : m));
	} catch (err) {
		if (prev) _meals = _meals.map((m) => (m.id === preppedMealId ? prev : m));
		throw err;
	}
}

export async function optimisticStartDefrost(preppedMealId: string): Promise<void> {
	const prev = _meals.find((m) => m.id === preppedMealId);
	if (prev) {
		const nowMs = Date.now();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- non-reactive timestamp for ISO string computation
		const defrostNowIso = new Date(nowMs).toISOString();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- non-reactive timestamp for ISO string computation
		const defrostReadyIso = new Date(nowMs + 86_400_000).toISOString();
		_meals = _meals.map((m) =>
			m.id === preppedMealId
				? toPreppedMeal({
						...m,
						defrost_state: 'DEFROSTING',
						defrost_started_at: defrostNowIso,
						estimated_ready_at: defrostReadyIso,
						storage_location: 'FRIDGE'
					})
				: m
		);
	}
	try {
		const saved = await startDefrost(preppedMealId);
		_meals = _meals.map((m) => (m.id === preppedMealId ? saved : m));
	} catch (err) {
		if (prev) _meals = _meals.map((m) => (m.id === preppedMealId ? prev : m));
		throw err;
	}
}

export async function optimisticMarkDefrostReady(preppedMealId: string): Promise<void> {
	const prev = _meals.find((m) => m.id === preppedMealId);
	if (prev) {
		_meals = _meals.map((m) =>
			m.id === preppedMealId ? toPreppedMeal({ ...m, defrost_state: 'READY' }) : m
		);
	}
	try {
		const saved = await markDefrostReady(preppedMealId);
		_meals = _meals.map((m) => (m.id === preppedMealId ? saved : m));
	} catch (err) {
		if (prev) _meals = _meals.map((m) => (m.id === preppedMealId ? prev : m));
		throw err;
	}
}

// ---------------------------------------------------------------------------
// Realtime (wired in T024)
// ---------------------------------------------------------------------------

let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeToHouseholdPreppedMealChanges(
	householdId: string,
	onReconnect?: () => void
): () => void {
	_realtimeChannel?.unsubscribe();

	_realtimeChannel = supabase
		.channel(`prepped-household-${householdId}`)
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'prepped_meals',
				filter: `household_id=eq.${householdId}`
			},
			(payload) => {
				if (payload.eventType === 'DELETE') {
					_meals = _meals.filter((m) => m.id !== (payload.old as { id: string }).id);
				} else {
					const updated = toPreppedMeal(payload.new as Parameters<typeof toPreppedMeal>[0]);
					const idx = _meals.findIndex((m) => m.id === updated.id);
					if (idx >= 0) {
						_meals = _meals.map((m) => (m.id === updated.id ? updated : m));
					} else {
						_meals = [..._meals, updated];
					}
				}
			}
		)
		.on('system', { event: 'reconnect' }, () => {
			onReconnect?.();
		})
		.subscribe();

	return () => {
		_realtimeChannel?.unsubscribe();
		_realtimeChannel = null;
	};
}
