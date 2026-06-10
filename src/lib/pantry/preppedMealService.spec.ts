import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
	getPreppedMeals,
	addPreppedMeal,
	consumePortions,
	correctPortions,
	startDefrost,
	markDefrostReady,
	PreppedMealServiceError
} from './preppedMealService';

vi.mock('$lib/supabaseClient', () => ({
	supabase: {
		from: vi.fn(),
		auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
		storage: { from: vi.fn() }
	}
}));

vi.mock('./portionLedger', () => ({
	insertPortionEvent: vi.fn().mockResolvedValue(undefined),
	PortionLedgerError: class PortionLedgerError extends Error {}
}));

import { supabase } from '$lib/supabaseClient';
import { insertPortionEvent } from './portionLedger';

// ---------------------------------------------------------------------------
// Chainable mock builder — thenable so plain `await builder` works too
// ---------------------------------------------------------------------------

function makeChain(result: { data: unknown; error: unknown }) {
	const chain: Record<string, unknown> = {};
	const methods = ['select', 'order', 'insert', 'update', 'delete', 'eq', 'or', 'upsert'];
	for (const m of methods) {
		chain[m] = vi.fn().mockReturnValue(chain);
	}
	(chain as Record<string, unknown>).single = vi.fn().mockResolvedValue(result);
	(chain as Record<string, unknown>).maybeSingle = vi.fn().mockResolvedValue(result);
	// Thenable: plain `await chain` resolves to result
	(chain as Record<string, unknown>).then = (resolve: (v: unknown) => unknown) =>
		Promise.resolve(result).then(resolve);
	return chain;
}

// A minimal prepped_meals row sufficient for toPreppedMeal
function makePreppedMealRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 'meal-1',
		name: 'Chicken Curry',
		owner_id: 'user-1',
		household_id: null,
		recipe_id: null,
		recipe_name: null,
		meal_prep_session_id: null,
		origin: 'DIRECT_ENTRY',
		storage_location: 'FRIDGE',
		original_portions: 4,
		portions_remaining: 4,
		prepared_date: '2026-06-01',
		expiration_date: '2026-06-05',
		defrost_state: 'NOT_APPLICABLE',
		defrost_started_at: null,
		estimated_ready_at: null,
		container_label: null,
		photo_url: null,
		created_at: '2026-06-01T00:00:00Z',
		updated_at: '2026-06-01T00:00:00Z',
		...overrides
	};
}

describe('preppedMealService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// -------------------------------------------------------------------------
	// getPreppedMeals
	// -------------------------------------------------------------------------

	describe('getPreppedMeals', () => {
		it('returns PreppedMeals with isExpiringSoon, isExpired, isReadyToEat fields', async () => {
			expect.hasAssertions();

			const rows = [
				makePreppedMealRow({ id: 'meal-1' }),
				makePreppedMealRow({ id: 'meal-2', name: 'Pasta Bake' })
			];
			const chain = makeChain({ data: rows, error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			const result = await getPreppedMeals();

			expect(result).toHaveLength(2);
			for (const meal of result) {
				expect(meal).toHaveProperty('isExpiringSoon');
				expect(meal).toHaveProperty('isExpired');
				expect(meal).toHaveProperty('isReadyToEat');
			}
		});
	});

	// -------------------------------------------------------------------------
	// addPreppedMeal
	// -------------------------------------------------------------------------

	describe('addPreppedMeal', () => {
		it('inserts meal then calls insertPortionEvent with kind INITIALIZED', async () => {
			expect.hasAssertions();

			const row = makePreppedMealRow({ id: 'meal-new', original_portions: 6 });
			// Both the insert+single and the re-fetch+single return the same row
			const chain = makeChain({ data: row, error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			await addPreppedMeal({
				name: 'Chicken Curry',
				owner_id: 'user-1',
				origin: 'DIRECT_ENTRY',
				storage_location: 'FRIDGE',
				original_portions: 6,
				portions_remaining: 6,
				prepared_date: '2026-06-01',
				expiration_date: '2026-06-05'
			});

			expect(insertPortionEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					preppedMealId: 'meal-new',
					deltaPortions: 6,
					kind: 'INITIALIZED'
				})
			);
		});
	});

	// -------------------------------------------------------------------------
	// consumePortions
	// -------------------------------------------------------------------------

	describe('consumePortions', () => {
		it('calls insertPortionEvent with negative deltaPortions and kind CONSUMED', async () => {
			expect.hasAssertions();

			await consumePortions('meal-1', 2);

			expect(insertPortionEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					preppedMealId: 'meal-1',
					deltaPortions: -2,
					kind: 'CONSUMED'
				})
			);
		});

		it('throws PreppedMealServiceError when count <= 0', async () => {
			expect.hasAssertions();

			await expect(consumePortions('meal-1', 0)).rejects.toThrow(PreppedMealServiceError);
		});
	});

	// -------------------------------------------------------------------------
	// correctPortions
	// -------------------------------------------------------------------------

	describe('correctPortions', () => {
		it('calls insertPortionEvent with kind ADJUSTED when delta is non-zero', async () => {
			expect.hasAssertions();

			// currentRemaining=3, newCount=5 → delta=+2
			await correctPortions('meal-1', 3, 5);

			expect(insertPortionEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					preppedMealId: 'meal-1',
					deltaPortions: 2,
					kind: 'ADJUSTED'
				})
			);
		});

		it('does NOT call insertPortionEvent when delta is zero', async () => {
			expect.hasAssertions();

			// currentRemaining === newCount → delta=0, early return
			await correctPortions('meal-1', 4, 4);

			expect(insertPortionEvent).not.toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// startDefrost
	// -------------------------------------------------------------------------

	describe('startDefrost', () => {
		it('updates defrost_state to DEFROSTING and sets defrost_started_at', async () => {
			expect.hasAssertions();

			const row = makePreppedMealRow({
				defrost_state: 'DEFROSTING',
				defrost_started_at: new Date().toISOString(),
				storage_location: 'FRIDGE'
			});
			const chain = makeChain({ data: row, error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			const result = await startDefrost('meal-1');

			// Assert update was called with the correct state transition payload
			const updateFn = (chain as Record<string, Mock>).update;
			expect(updateFn).toHaveBeenCalledWith(
				expect.objectContaining({
					defrost_state: 'DEFROSTING',
					defrost_started_at: expect.any(String)
				})
			);
			expect(result.defrost_state).toBe('DEFROSTING');
		});
	});

	// -------------------------------------------------------------------------
	// markDefrostReady
	// -------------------------------------------------------------------------

	describe('markDefrostReady', () => {
		it('updates defrost_state to READY', async () => {
			expect.hasAssertions();

			const row = makePreppedMealRow({ defrost_state: 'READY' });
			const chain = makeChain({ data: row, error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			const result = await markDefrostReady('meal-1');

			const updateFn = (chain as Record<string, Mock>).update;
			expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ defrost_state: 'READY' }));
			expect(result.defrost_state).toBe('READY');
		});
	});
});
