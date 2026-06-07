// Maps Supabase/PostgREST errors into calm, shame-free, user-facing messages. Raw Postgres
// errors (constraint names, SQL state) never reach the UI. Errors are surfaced, never swallowed.

import type { PostgrestError } from '@supabase/supabase-js';

/** A normalized application error carrying a friendly message plus the original for logging. */
export class RecipeError extends Error {
	readonly cause?: unknown;
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'RecipeError';
		this.cause = cause;
	}
}

type MaybePgError = Partial<PostgrestError> & { code?: string; message?: string };

/** Translate a known constraint/RLS failure into a friendly message. */
export function friendlyMessage(err: MaybePgError | null | undefined): string {
	if (!err) return 'Something went wrong. Please try again.';

	const code = err.code ?? '';
	const detail = `${err.message ?? ''}`.toLowerCase();

	// RLS denial / not authorized
	if (
		code === '42501' ||
		detail.includes('row-level security') ||
		detail.includes('permission denied')
	) {
		return 'You don’t have access to this recipe.';
	}
	// Unique violation (duplicate sort order, duplicate meta, duplicate tag)
	if (code === '23505') {
		if (detail.includes('sort_order'))
			return 'Those steps or ingredients got out of order — try again.';
		return 'That already exists.';
	}
	// Check constraint (servings, quantity, rating, active<=total, lengths)
	if (code === '23514') {
		if (detail.includes('rating')) return 'Rating can be from 1 to 5.';
		if (detail.includes('servings')) return 'Servings can be between 1 and 100.';
		if (detail.includes('quantity')) return 'Quantity should be greater than zero.';
		if (detail.includes('active_le_total')) return 'Hands-on time can’t exceed the total time.';
		return 'Some details need a quick fix before saving.';
	}
	// Foreign key / not null
	if (code === '23503') return 'That recipe could not be found.';
	if (code === '23502') return 'Something required is missing — please fill it in.';
	// Network / unknown
	return 'Something went wrong saving your recipe. Please try again.';
}

/** Wrap a thrown/returned error as a RecipeError with a friendly message. */
export function toRecipeError(err: unknown): RecipeError {
	if (err instanceof RecipeError) return err;
	const pg = err as MaybePgError | null;
	return new RecipeError(friendlyMessage(pg), err);
}
