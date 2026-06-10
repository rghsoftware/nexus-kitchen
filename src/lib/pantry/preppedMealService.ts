import { supabase } from '$lib/supabaseClient';
import { insertPortionEvent, PortionLedgerError } from './portionLedger';
import {
	toPreppedMeal,
	type NewPreppedMeal,
	type PreppedMeal,
	type PreppedMealUpdate
} from './types';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getPreppedMeals(householdId?: string | null): Promise<PreppedMeal[]> {
	let query = supabase
		.from('prepped_meals')
		.select('*')
		.order('expiration_date', { ascending: true });

	if (householdId) {
		query = query.or(
			`owner_id.eq.${(await supabase.auth.getUser()).data.user?.id},household_id.eq.${householdId}`
		);
	}

	const { data, error } = await query;
	if (error) throw new PreppedMealServiceError('Failed to load prepped meals', error);
	return (data ?? []).map(toPreppedMeal);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function addPreppedMeal(meal: NewPreppedMeal): Promise<PreppedMeal> {
	const { data, error } = await supabase.from('prepped_meals').insert(meal).select().single();
	if (error) throw new PreppedMealServiceError('Failed to add prepped meal', error);

	// Record the initial portion count as an INITIALIZED event
	await insertPortionEvent({
		preppedMealId: data.id,
		deltaPortions: data.original_portions,
		kind: 'INITIALIZED'
	});

	// Re-fetch so portions_remaining reflects the trigger update
	const { data: refreshed, error: refetchError } = await supabase
		.from('prepped_meals')
		.select('*')
		.eq('id', data.id)
		.single();
	if (refetchError)
		throw new PreppedMealServiceError('Failed to fetch new prepped meal', refetchError);
	return toPreppedMeal(refreshed);
}

export async function updatePreppedMeal(
	id: string,
	changes: PreppedMealUpdate
): Promise<PreppedMeal> {
	const { data, error } = await supabase
		.from('prepped_meals')
		.update(changes)
		.eq('id', id)
		.select()
		.single();
	if (error) throw new PreppedMealServiceError('Failed to update prepped meal', error);
	return toPreppedMeal(data);
}

// ---------------------------------------------------------------------------
// Portion operations (all via ledger — never direct column writes)
// ---------------------------------------------------------------------------

export async function consumePortions(preppedMealId: string, count: number): Promise<void> {
	if (count <= 0) throw new PreppedMealServiceError('count must be positive');
	try {
		await insertPortionEvent({
			preppedMealId,
			deltaPortions: -count,
			kind: 'CONSUMED'
		});
	} catch (err) {
		if (err instanceof PortionLedgerError) throw err;
		throw new PreppedMealServiceError('Failed to consume portions', err);
	}
}

export async function correctPortions(
	preppedMealId: string,
	currentRemaining: number,
	newCount: number
): Promise<void> {
	const delta = newCount - currentRemaining;
	if (delta === 0) return;
	try {
		await insertPortionEvent({
			preppedMealId,
			deltaPortions: delta,
			kind: 'ADJUSTED'
		});
	} catch (err) {
		if (err instanceof PortionLedgerError) throw err;
		throw new PreppedMealServiceError('Failed to correct portions', err);
	}
}

// ---------------------------------------------------------------------------
// Defrost transitions (INV-INV-007/008)
// ---------------------------------------------------------------------------

export async function startDefrost(preppedMealId: string): Promise<PreppedMeal> {
	const now = new Date();
	const estimatedReady = new Date(now.getTime() + 24 * 60 * 60 * 1000);

	const { data, error } = await supabase
		.from('prepped_meals')
		.update({
			defrost_state: 'DEFROSTING',
			defrost_started_at: now.toISOString(),
			estimated_ready_at: estimatedReady.toISOString(),
			storage_location: 'FRIDGE'
		})
		.eq('id', preppedMealId)
		.select()
		.single();
	if (error) throw new PreppedMealServiceError('Failed to start defrost', error);
	return toPreppedMeal(data);
}

export async function markDefrostReady(preppedMealId: string): Promise<PreppedMeal> {
	const { data, error } = await supabase
		.from('prepped_meals')
		.update({ defrost_state: 'READY' })
		.eq('id', preppedMealId)
		.select()
		.single();
	if (error) throw new PreppedMealServiceError('Failed to mark defrost ready', error);
	return toPreppedMeal(data);
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class PreppedMealServiceError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown
	) {
		super(message);
		this.name = 'PreppedMealServiceError';
	}
}
