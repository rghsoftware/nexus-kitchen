import { supabase } from '$lib/supabaseClient';
import type { PortionEventKind } from './types';

export interface PortionEventInput {
	preppedMealId: string;
	deltaPortions: number;
	kind: PortionEventKind;
	triggeredBy?: string;
}

/**
 * Insert a portion event into the ledger. The DB trigger
 * (trg_sync_portions_remaining) atomically updates portions_remaining
 * (and original_portions on ADJUSTED events) and rejects negative balances.
 *
 * Client-side pre-validation provides fast feedback before the round-trip.
 */
export async function insertPortionEvent(event: PortionEventInput): Promise<void> {
	if (event.deltaPortions === 0) {
		throw new PortionLedgerError('delta_portions must be non-zero (INV-INV-010)');
	}
	if (event.deltaPortions > 0 && event.kind !== 'ADJUSTED') {
		throw new PortionLedgerError(
			'Positive delta is only allowed for ADJUSTED events (INV-INV-011)'
		);
	}

	const { error } = await supabase.from('portion_events').insert({
		prepped_meal_id: event.preppedMealId,
		delta_portions: event.deltaPortions,
		kind: event.kind,
		triggered_by: event.triggeredBy ?? null
	});

	if (error) {
		if (error.message.includes('INV-INV-004')) {
			throw new PortionLedgerError('Not enough portions remaining', error);
		}
		throw new PortionLedgerError('Failed to record portion event', error);
	}
}

export class PortionLedgerError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown
	) {
		super(message);
		this.name = 'PortionLedgerError';
	}
}
