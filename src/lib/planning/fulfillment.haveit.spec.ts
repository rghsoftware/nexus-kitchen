import { describe, expect, it } from 'vitest';
import { deriveFulfillment, inputsFromSnapshot } from './fulfillment';
import type { PlannedMeal } from './types';
import type { PreppedMeal, PreppedMealOrigin } from '$lib/pantry/types';

// ---------------------------------------------------------------------------
// Make-ahead guard (feature 006, FR-PP-001).
//
// A prepped portion is the canonical HAVE_IT source. This locks the guarantee that
// closing the make-ahead loop produces HAVE_IT *regardless of how the portion was
// created* — direct entry, store-bought, or a batch prep session — exercised through
// the documented inputsFromSnapshot seam (not by poking the derivation's internals).
//
// It also stands as a regression for the portion-creation fix (Design A): a portion that
// was successfully created with portions_remaining > 0 must read HAVE_IT.
// ---------------------------------------------------------------------------

function plannedFromPrepped(preppedMealId: string): PlannedMeal {
	return {
		id: 'pm-1',
		mealPlanId: 'plan-1',
		date: '2026-06-16',
		mealSlot: 'DINNER',
		source: 'PREPPED',
		recipeId: null,
		recipeTitleSnapshot: null,
		preppedMealId,
		preppedNameSnapshot: 'Leftovers',
		storeBoughtName: null,
		quickMealName: null,
		servings: 1,
		status: 'PLANNED',
		sortOrder: 0,
		createdAt: '',
		updatedAt: ''
	};
}

function preppedPortion(
	id: string,
	origin: PreppedMealOrigin,
	portionsRemaining: number
): PreppedMeal {
	return {
		id,
		owner_id: 'user-1',
		household_id: null,
		origin,
		name: 'Portion',
		recipe_id: origin === 'PREP_SESSION' ? 'r-1' : null,
		recipe_name: origin === 'PREP_SESSION' ? 'Chili' : null,
		meal_prep_session_id: origin === 'PREP_SESSION' ? 'mps-1' : null,
		portions_remaining: portionsRemaining,
		original_portions: Math.max(portionsRemaining, 1),
		storage_location: 'FRIDGE',
		container_label: null,
		prepared_date: '2026-06-13',
		expiration_date: '2026-06-20',
		defrost_state: 'NOT_APPLICABLE',
		defrost_started_at: null,
		estimated_ready_at: null,
		photo_url: null,
		created_at: '',
		updated_at: '',
		isExpiringSoon: false,
		isExpired: false,
		isReadyToEat: true
	};
}

describe('make-ahead → HAVE_IT (origin-independent, FR-PP-001)', () => {
	const origins: PreppedMealOrigin[] = ['DIRECT_ENTRY', 'STORE_BOUGHT', 'PREP_SESSION'];

	for (const origin of origins) {
		it(`a ${origin} portion with portions remaining derives HAVE_IT`, () => {
			const inputs = inputsFromSnapshot(
				{ pantryItems: [], preppedMeals: [preppedPortion('pp-1', origin, 2)] },
				new Map()
			);
			expect(deriveFulfillment(plannedFromPrepped('pp-1'), inputs)).toEqual({ state: 'HAVE_IT' });
		});

		it(`an exhausted ${origin} portion (0 remaining) derives MUST_ACQUIRE`, () => {
			const inputs = inputsFromSnapshot(
				{ pantryItems: [], preppedMeals: [preppedPortion('pp-1', origin, 0)] },
				new Map()
			);
			expect(deriveFulfillment(plannedFromPrepped('pp-1'), inputs)?.state).toBe('MUST_ACQUIRE');
		});
	}
});
