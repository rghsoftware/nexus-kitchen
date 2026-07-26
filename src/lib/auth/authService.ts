// Thin wrapper over Supabase Auth (feature 008).
//
// Every credential operation is delegated to Supabase Auth — no password hashing, no
// token issuance, no session storage of our own (INV-SEC-001, REQ-SC-002/003). This
// module exists only to (a) normalise the two shapes `signUp` can return and (b) turn
// AuthError into product voice. It holds no state; see session.svelte.ts for that.

import { supabase } from '$lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { authErrorMessage } from './authErrors';

/**
 * Outcome of a sign-up.
 *
 * `signUp` returns a live session when the project auto-confirms
 * (`auth.email.enable_confirmations = false`, the local-dev default) and a user with a
 * NULL session when confirmations are on. Both are success — they just land the person
 * in different places — so the caller branches on this instead of guessing from config.
 */
export type SignUpOutcome =
	| { status: 'active'; user: User }
	| { status: 'confirmation-required'; email: string };

export class AuthFailure extends Error {
	constructor(
		message: string,
		readonly cause?: unknown
	) {
		super(message);
		this.name = 'AuthFailure';
	}
}

function fail(error: unknown): never {
	throw new AuthFailure(authErrorMessage(error), error);
}

export async function signIn(email: string, password: string): Promise<User> {
	const { data, error } = await supabase.auth.signInWithPassword({
		email: email.trim(),
		password
	});
	if (error) fail(error);
	// signInWithPassword always yields a user on success; guard so a shape change
	// surfaces as a clear failure rather than a null deref downstream.
	if (!data.user) fail(new Error('Sign-in returned no user.'));
	return data.user;
}

export async function signUp(email: string, password: string): Promise<SignUpOutcome> {
	const trimmed = email.trim();
	const { data, error } = await supabase.auth.signUp({ email: trimmed, password });
	if (error) fail(error);

	if (data.session && data.user) return { status: 'active', user: data.user };
	return { status: 'confirmation-required', email: trimmed };
}

export async function signOut(): Promise<void> {
	const { error } = await supabase.auth.signOut();
	if (error) fail(error);
}

/**
 * Sends a password-reset link. Supabase redirects to `redirectTo` (or site_url) with the
 * recovery tokens in the URL fragment; supabase-js picks them up via detectSessionInUrl
 * and fires a PASSWORD_RECOVERY auth event, which the session module observes.
 */
export async function requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
	const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
	if (error) fail(error);
}

/** Sets a new password for the currently-authenticated (or recovering) user. */
export async function updatePassword(password: string): Promise<void> {
	const { error } = await supabase.auth.updateUser({ password });
	if (error) fail(error);
}

/** Re-sends the sign-up confirmation email. */
export async function resendConfirmation(email: string): Promise<void> {
	const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
	if (error) fail(error);
}
