import { describe, expect, it } from 'vitest';
import { placeablePreppedPortions } from '$lib/pantry/types';

// ---------------------------------------------------------------------------
// PREPPED picker placeability contract (feature 006, FR-PP-002).
//
// The Add-meal sheet (AddMealSheet.svelte, feature 004) lets a user place a prepped
// portion as a PREPPED-source planned meal — the path that reads HAVE_IT. The one
// picker-specific rule (only portions with portions remaining > 0 are offerable) was
// inline in the component; it now lives in `placeablePreppedPortions` and is locked here.
// The PREPPED draft → planned-meal mapping itself is covered in planningService.spec.ts.
// ---------------------------------------------------------------------------

const portion = (id: string, remaining: number) => ({ id, portions_remaining: remaining });

describe('placeablePreppedPortions (FR-PP-002)', () => {
	it('offers only portions with remaining > 0', () => {
		const result = placeablePreppedPortions([portion('a', 3), portion('b', 0), portion('c', 1)]);
		expect(result.map((p) => p.id)).toEqual(['a', 'c']);
	});

	it('excludes exhausted portions (they would derive MUST_ACQUIRE, not HAVE_IT)', () => {
		expect(placeablePreppedPortions([portion('x', 0)])).toEqual([]);
	});

	it('returns an empty list when there is no prepped inventory', () => {
		expect(placeablePreppedPortions([])).toEqual([]);
	});
});
