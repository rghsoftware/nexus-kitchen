import { describe, expect, it } from 'vitest';
import { deriveFulfillment, inputsFromSnapshot } from './fulfillment';
import type { PlannedMeal } from './types';
import type { PreppedMeal } from '$lib/pantry/types';

// ---------------------------------------------------------------------------
// Session-yield consume lifecycle (feature 006, FR-PP-031 / REQ-PP-027 / INV-XD-003).
//
// A PREP_SESSION-origin portion decrements through the same CONSUMED portion-event ledger
// as any other origin (proven at the DB level in supabase/tests/portion_creation.test.sql).
// Here we lock the user-facing consequence: while the portion has servings, the planned meal
// reads HAVE_IT; once consumed to 0 it reads MUST_ACQUIRE — closing the make-ahead loop.
//
// NOTE: the *automatic* decrement on meal-LOGGING (REQ-PP-027) is deferred together with the
// meal-logging feature — there is no meal_logs table/flow yet. This guards the consume
// mechanism for session yields, not an auto-on-log trigger.
// ---------------------------------------------------------------------------

function sessionPortion(portionsRemaining: number): PreppedMeal {
	return {
		id: 'pp-sess',
		owner_id: 'user-1',
		household_id: null,
		origin: 'PREP_SESSION',
		name: 'Chili',
		recipe_id: 'r-1',
		recipe_name: 'Chili',
		meal_prep_session_id: 'mps-1',
		portions_remaining: portionsRemaining,
		original_portions: 3,
		storage_location: 'FREEZER',
		container_label: null,
		prepared_date: '2026-06-13',
		expiration_date: '2026-09-11',
		defrost_state: 'FROZEN',
		defrost_started_at: null,
		estimated_ready_at: null,
		photo_url: null,
		created_at: '',
		updated_at: '',
		isExpiringSoon: false,
		isExpired: false,
		isReadyToEat: false
	};
}

const plannedFromSession: PlannedMeal = {
	id: 'pm-1',
	mealPlanId: 'plan-1',
	date: '2026-06-16',
	mealSlot: 'DINNER',
	source: 'PREPPED',
	recipeId: null,
	recipeTitleSnapshot: null,
	preppedMealId: 'pp-sess',
	preppedNameSnapshot: 'Chili',
	storeBoughtName: null,
	quickMealName: null,
	servings: 1,
	status: 'PLANNED',
	sortOrder: 0,
	createdAt: '',
	updatedAt: ''
};

function fulfillmentFor(portionsRemaining: number) {
	const inputs = inputsFromSnapshot(
		{ pantryItems: [], preppedMeals: [sessionPortion(portionsRemaining)] },
		new Map()
	);
	return deriveFulfillment(plannedFromSession, inputs);
}

describe('PREP_SESSION portion consume lifecycle (FR-PP-031)', () => {
	it('reads HAVE_IT while the yielded portion has servings remaining', () => {
		expect(fulfillmentFor(3)).toEqual({ state: 'HAVE_IT' });
		expect(fulfillmentFor(1)).toEqual({ state: 'HAVE_IT' });
	});

	it('flips to MUST_ACQUIRE once the portion is consumed to zero', () => {
		expect(fulfillmentFor(0)?.state).toBe('MUST_ACQUIRE');
	});
});
