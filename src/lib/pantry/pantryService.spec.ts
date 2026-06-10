import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
	getPantryItems,
	addPantryItem,
	updatePantryItem,
	deletePantryItem,
	PantryServiceError
} from './pantryService';

vi.mock('$lib/supabaseClient', () => ({
	supabase: {
		from: vi.fn(),
		auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
		storage: { from: vi.fn() }
	}
}));

// Import mocked supabase after vi.mock is hoisted
import { supabase } from '$lib/supabaseClient';

// ---------------------------------------------------------------------------
// Chainable mock builder — thenable so plain `await builder` works too
// ---------------------------------------------------------------------------

function makeChain(result: { data: unknown; error: unknown }) {
	const chain: Record<string, unknown> = {};
	const methods = ['select', 'order', 'insert', 'update', 'delete', 'eq', 'or', 'upsert'];
	for (const m of methods) {
		chain[m] = vi.fn().mockReturnValue(chain);
	}
	// single() and maybeSingle() return a resolved Promise
	(chain as Record<string, unknown>).single = vi.fn().mockResolvedValue(result);
	(chain as Record<string, unknown>).maybeSingle = vi.fn().mockResolvedValue(result);
	// Thenable: plain `await chain` resolves to result
	(chain as Record<string, unknown>).then = (resolve: (v: unknown) => unknown) =>
		Promise.resolve(result).then(resolve);
	return chain;
}

// A minimal pantry_items row sufficient for toPantryItem
function makePantryRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 'item-1',
		name: 'Olive Oil',
		quantity: 500,
		unit: 'ml',
		storage_location: 'PANTRY',
		owner_id: 'user-1',
		household_id: null,
		expiration_date: null,
		minimum_quantity: null,
		ingredient_id: null,
		barcode: null,
		photo_url: null,
		thumbnail_url: null,
		purchase_date: null,
		opened_date: null,
		custom_location: null,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		...overrides
	};
}

describe('pantryService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// -------------------------------------------------------------------------
	// getPantryItems
	// -------------------------------------------------------------------------

	describe('getPantryItems', () => {
		it('returns array of PantryItems with derived fields', async () => {
			expect.hasAssertions();

			const rows = [makePantryRow({ id: 'item-1' }), makePantryRow({ id: 'item-2', name: 'Salt' })];
			const chain = makeChain({ data: rows, error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			const result = await getPantryItems();

			expect(result).toHaveLength(2);
			for (const item of result) {
				expect(item).toHaveProperty('isRunningLow');
				expect(item).toHaveProperty('isExpiringSoon');
				expect(item).toHaveProperty('isExpired');
			}
		});

		it('throws PantryServiceError on supabase error', async () => {
			expect.hasAssertions();

			const chain = makeChain({ data: null, error: { message: 'db error' } });
			(supabase.from as Mock).mockReturnValue(chain);

			await expect(getPantryItems()).rejects.toThrow(PantryServiceError);
		});
	});

	// -------------------------------------------------------------------------
	// addPantryItem
	// -------------------------------------------------------------------------

	describe('addPantryItem', () => {
		it('returns PantryItem with id on success', async () => {
			expect.hasAssertions();

			const row = makePantryRow({ id: 'new-item-1', name: 'Flour' });
			const chain = makeChain({ data: row, error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			const result = await addPantryItem({
				name: 'Flour',
				unit: 'g',
				quantity: 1000,
				owner_id: 'user-1',
				storage_location: 'PANTRY'
			});

			expect(result).toHaveProperty('id', 'new-item-1');
		});

		it('throws PantryServiceError on supabase error', async () => {
			expect.hasAssertions();

			const chain = makeChain({ data: null, error: { message: 'insert failed' } });
			(supabase.from as Mock).mockReturnValue(chain);

			await expect(
				addPantryItem({
					name: 'Flour',
					unit: 'g',
					quantity: 1000,
					owner_id: 'user-1',
					storage_location: 'PANTRY'
				})
			).rejects.toThrow(PantryServiceError);
		});
	});

	// -------------------------------------------------------------------------
	// updatePantryItem
	// -------------------------------------------------------------------------

	describe('updatePantryItem', () => {
		it('returns updated PantryItem with matching name', async () => {
			expect.hasAssertions();

			const updatedName = 'Extra Virgin Olive Oil';
			const row = makePantryRow({ id: 'item-1', name: updatedName });
			const chain = makeChain({ data: row, error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			const result = await updatePantryItem('item-1', { name: updatedName });

			expect(result.name).toBe(updatedName);
		});
	});

	// -------------------------------------------------------------------------
	// deletePantryItem
	// -------------------------------------------------------------------------

	describe('deletePantryItem', () => {
		it('resolves without throwing on successful delete', async () => {
			expect.hasAssertions();

			const chain = makeChain({ data: null, error: null });
			(supabase.from as Mock).mockReturnValue(chain);

			await expect(deletePantryItem('item-1')).resolves.toBeUndefined();
		});

		it('throws PantryServiceError on supabase error', async () => {
			expect.hasAssertions();

			const chain = makeChain({ data: null, error: { message: 'delete failed' } });
			(supabase.from as Mock).mockReturnValue(chain);

			await expect(deletePantryItem('item-1')).rejects.toThrow(PantryServiceError);
		});
	});
});
