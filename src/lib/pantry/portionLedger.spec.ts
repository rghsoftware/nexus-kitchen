import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { insertPortionEvent, PortionLedgerError } from './portionLedger';

vi.mock('$lib/supabaseClient', () => ({
	supabase: {
		from: vi.fn(),
		auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
		storage: { from: vi.fn() }
	}
}));

import { supabase } from '$lib/supabaseClient';

// ---------------------------------------------------------------------------
// Insert chain builder — portionLedger only uses from().insert() → await
// ---------------------------------------------------------------------------

function makeInsertChain(result: { error: { message: string } | null }) {
	const chain: Record<string, unknown> = {};
	// insert() returns chain; awaiting chain resolves to result
	(chain as Record<string, unknown>).insert = vi.fn().mockReturnValue(chain);
	// Thenable: plain `await chain` resolves to result
	(chain as Record<string, unknown>).then = (resolve: (v: unknown) => unknown) =>
		Promise.resolve(result).then(resolve);
	return chain;
}

describe('portionLedger — insertPortionEvent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// -------------------------------------------------------------------------
	// Client-side invariant guards (never touch supabase)
	// -------------------------------------------------------------------------

	it('throws PortionLedgerError with "non-zero" message when delta = 0 (INV-INV-010)', async () => {
		expect.hasAssertions();

		await expect(
			insertPortionEvent({ preppedMealId: 'meal-1', deltaPortions: 0, kind: 'CONSUMED' })
		).rejects.toThrow(expect.objectContaining({ message: expect.stringContaining('non-zero') }));
	});

	it('throws PortionLedgerError when delta > 0 and kind = CONSUMED (INV-INV-011)', async () => {
		expect.hasAssertions();

		await expect(
			insertPortionEvent({ preppedMealId: 'meal-1', deltaPortions: 1, kind: 'CONSUMED' })
		).rejects.toThrow(PortionLedgerError);
	});

	it('throws PortionLedgerError when delta > 0 and kind = INITIALIZED (INV-INV-011)', async () => {
		expect.hasAssertions();

		await expect(
			insertPortionEvent({ preppedMealId: 'meal-1', deltaPortions: 2, kind: 'INITIALIZED' })
		).rejects.toThrow(PortionLedgerError);
	});

	// -------------------------------------------------------------------------
	// Valid inserts
	// -------------------------------------------------------------------------

	it('resolves without throwing when delta < 0 and kind = CONSUMED', async () => {
		expect.hasAssertions();

		const chain = makeInsertChain({ error: null });
		(supabase.from as Mock).mockReturnValue(chain);

		await expect(
			insertPortionEvent({ preppedMealId: 'meal-1', deltaPortions: -1, kind: 'CONSUMED' })
		).resolves.toBeUndefined();
	});

	it('resolves without throwing when delta > 0 and kind = ADJUSTED', async () => {
		expect.hasAssertions();

		const chain = makeInsertChain({ error: null });
		(supabase.from as Mock).mockReturnValue(chain);

		await expect(
			insertPortionEvent({ preppedMealId: 'meal-1', deltaPortions: 2, kind: 'ADJUSTED' })
		).resolves.toBeUndefined();
	});

	// -------------------------------------------------------------------------
	// Supabase error handling
	// -------------------------------------------------------------------------

	it('throws PortionLedgerError on generic supabase insert error', async () => {
		expect.hasAssertions();

		const chain = makeInsertChain({ error: { message: 'db error' } });
		(supabase.from as Mock).mockReturnValue(chain);

		await expect(
			insertPortionEvent({ preppedMealId: 'meal-1', deltaPortions: -1, kind: 'CONSUMED' })
		).rejects.toThrow(PortionLedgerError);
	});

	it('throws PortionLedgerError with "portions remaining" message on INV-INV-004 DB error', async () => {
		expect.hasAssertions();

		// The DB trigger embeds "INV-INV-004" in its error message to signal negative balance
		const chain = makeInsertChain({ error: { message: 'violates check constraint INV-INV-004' } });
		(supabase.from as Mock).mockReturnValue(chain);

		await expect(
			insertPortionEvent({ preppedMealId: 'meal-1', deltaPortions: -99, kind: 'CONSUMED' })
		).rejects.toThrow(
			expect.objectContaining({ message: expect.stringContaining('portions remaining') })
		);
	});
});
