import { describe, it, expect } from 'vitest';
import { RecipeError, friendlyMessage, toRecipeError } from './recipeErrors';

function pgErr(overrides: { code?: string; message?: string; details?: string; hint?: string }) {
	return { code: '', message: '', details: '', hint: '', ...overrides };
}

describe('friendlyMessage', () => {
	it('returns a generic message for null/undefined', () => {
		expect(friendlyMessage(null)).toBe('Something went wrong. Please try again.');
		expect(friendlyMessage(undefined)).toBe('Something went wrong. Please try again.');
	});

	it('maps 42501 (RLS denial) to an access-denied message', () => {
		expect(friendlyMessage(pgErr({ code: '42501' }))).toMatch(/don.t have access/i);
	});

	it('maps RLS denial detected via message text', () => {
		expect(friendlyMessage(pgErr({ message: 'row-level security policy violated' }))).toMatch(
			/don.t have access/i
		);
	});

	it('maps 23505 with sort_order in detail to sort-order message', () => {
		expect(
			friendlyMessage(pgErr({ code: '23505', details: 'Key (sort_order)=(0) already exists.' }))
		).toMatch(/out of order/i);
	});

	it('maps 23505 without sort_order to a generic duplicate message', () => {
		expect(friendlyMessage(pgErr({ code: '23505', message: 'duplicate key value' }))).toBe(
			'That already exists.'
		);
	});

	it('maps 23514 with "rating" in detail to rating message', () => {
		expect(
			friendlyMessage(pgErr({ code: '23514', details: 'Failing row contains rating=6.' }))
		).toMatch(/rating/i);
	});

	it('maps 23514 with "servings" in detail to servings message', () => {
		expect(
			friendlyMessage(pgErr({ code: '23514', details: 'Failing row contains servings=0.' }))
		).toMatch(/servings/i);
	});

	it('maps 23514 with "quantity" in detail to quantity message', () => {
		expect(
			friendlyMessage(pgErr({ code: '23514', details: 'Failing row contains quantity=-1.' }))
		).toMatch(/quantity/i);
	});

	it('maps 23514 with "active_le_total" in detail to active-time message', () => {
		expect(
			friendlyMessage(pgErr({ code: '23514', details: 'Failing row violates active_le_total.' }))
		).toMatch(/hands-on/i);
	});

	it('maps 23514 unknown check constraint to a generic fix message', () => {
		expect(friendlyMessage(pgErr({ code: '23514', message: 'check constraint violated' }))).toMatch(
			/quick fix/i
		);
	});

	it('maps 23503 (foreign key) to not-found message', () => {
		expect(friendlyMessage(pgErr({ code: '23503' }))).toMatch(/could not be found/i);
	});

	it('maps 23502 (not null) to missing-required message', () => {
		expect(friendlyMessage(pgErr({ code: '23502' }))).toMatch(/missing/i);
	});

	it('returns a save-error message for unknown codes', () => {
		expect(friendlyMessage(pgErr({ code: '99999', message: 'some db error' }))).toMatch(
			/something went wrong/i
		);
	});
});

describe('toRecipeError', () => {
	it('passes through an existing RecipeError unchanged', () => {
		const original = new RecipeError('already friendly');
		expect(toRecipeError(original)).toBe(original);
	});

	it('wraps a postgres error with a friendly message', () => {
		const pg = pgErr({ code: '42501' });
		const err = toRecipeError(pg);
		expect(err).toBeInstanceOf(RecipeError);
		expect(err.message).toMatch(/don.t have access/i);
		expect(err.cause).toBe(pg);
	});

	it('wraps a plain Error with a generic message', () => {
		const plain = new Error('network failure');
		const err = toRecipeError(plain);
		expect(err).toBeInstanceOf(RecipeError);
		expect(err.cause).toBe(plain);
	});

	it('wraps null with a generic message', () => {
		const err = toRecipeError(null);
		expect(err).toBeInstanceOf(RecipeError);
		expect(err.message).toBeTruthy();
	});
});
