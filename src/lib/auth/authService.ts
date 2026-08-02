// Thin wrapper over Supabase Auth (feature 008).
//
// Every credential operation is delegated to Supabase Auth — no password hashing, no
// token issuance, no session storage of our own (INV-SEC-001, REQ-SC-002/003). This
// module exists only to (a) normalise the two shapes `signUp` can return and (b) turn
// AuthError into product voice. It holds no state; see session.svelte.ts for that.

import { supabase } from '$lib/supabaseClient';
import type { Provider, User } from '@supabase/supabase-js';
import { authErrorMessage, isDuplicateAccount } from './authErrors';

/**
 * Identifier of the Authentik OIDC provider configured in Supabase
 * (`auth.custom_oauth_providers`). Custom providers aren't part of supabase-js's
 * `Provider` union — the cast reflects that the SDK's types haven't caught up with the
 * feature, not that this value is unchecked; Supabase rejects an unknown identifier
 * server-side.
 */
const AUTHENTIK_PROVIDER = 'custom:authentik' as Provider;

/**
 * Outcome of a sign-up.
 *
 * `signUp` returns a live session when the project auto-confirms
 * (`auth.email.enable_confirmations = false`, the local-dev default) and a user with a
 * NULL session when confirmations are on. Both are success — they just land the person
 * in different places — so the caller branches on this instead of guessing from config.
 *
 * `already-registered` is the third shape, and the UI must render it exactly like
 * `confirmation-required`: sign-up refuses to confirm whether an address is taken, the
 * same stance the reset flow takes. It's a distinct outcome only so the service can stay
 * honest about what happened — never so the screen can say something different.
 */
export type SignUpOutcome =
	| { status: 'active'; user: User }
	| { status: 'confirmation-required'; email: string }
	| { status: 'already-registered'; email: string };

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

/**
 * Starts the Authentik sign-in redirect. Supabase's `/authorize` endpoint sends the
 * browser to Authentik and back; there's no user to return here because the current page
 * is about to navigate away — the session shows up via `restoreSession`/`onAuthStateChange`
 * once the redirect lands back on `redirectTo` (see `$lib/session/session.svelte.ts`).
 */
export async function signInWithAuthentik(redirectTo?: string): Promise<void> {
	const { error } = await supabase.auth.signInWithOAuth({
		provider: AUTHENTIK_PROVIDER,
		options: { redirectTo }
	});
	if (error) fail(error);
}

export async function signUp(email: string, password: string): Promise<SignUpOutcome> {
	const trimmed = email.trim();
	const { data, error } = await supabase.auth.signUp({ email: trimmed, password });

	// A duplicate sign-up reaches us two different ways depending on configuration: an
	// explicit error when confirmations are off, and a 200 carrying an obfuscated user
	// with no identities (and no mail sent) when they're on. Both collapse into one
	// outcome so behaviour doesn't change with config — and so the caller has nothing
	// left to branch on that would reveal whether the address is taken.
	if (error) {
		if (isDuplicateAccount(error)) return { status: 'already-registered', email: trimmed };
		fail(error);
	}
	// Same guard as signIn: a shape change should surface as a clear failure.
	if (!data.user) fail(new Error('Sign-up returned no user.'));
	if (data.user.identities?.length === 0) return { status: 'already-registered', email: trimmed };

	if (data.session) return { status: 'active', user: data.user };
	return { status: 'confirmation-required', email: trimmed };
}

/**
 * Signs out on this device only.
 *
 * supabase-js defaults to `scope: 'global'`, which revokes refresh tokens for every
 * session on the account — signing out on a phone would sign the user out of their
 * laptop mid-task, contradicting the "keeps everything in sync across your devices"
 * promise the sign-up screen makes.
 */
export async function signOut(): Promise<void> {
	const { error } = await supabase.auth.signOut({ scope: 'local' });
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
