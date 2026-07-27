// Supabase Auth error → calm, human message (feature 008).
//
// Supabase's raw messages are accurate but terse and occasionally jargon-y
// ("Invalid login credentials", "AuthApiError: User already registered"). The product
// voice is gentle and non-blaming (REQ-UX-009), so we translate the handful we can
// actually anticipate and pass anything else through with a soft fallback.
//
// Matching is on `code` where Supabase provides one and message text otherwise — codes
// are stable, message text is not, so code is always tried first.

import { AuthError } from '@supabase/supabase-js';

// Deliberately absent: anything that would confirm an address is already registered.
// Sign-up folds those responses into an `already-registered` outcome (see signUp) and
// shows the same neutral copy as a new sign-up, matching the reset flow — so there is no
// message here that could leak the difference.
const BY_CODE: Record<string, string> = {
	invalid_credentials: 'That email and password don’t match. Want to try again?',
	email_not_confirmed: 'Please confirm your email first — check your inbox for the link.',
	weak_password: 'That password is a little too easy to guess. Try a longer one.',
	over_email_send_rate_limit:
		'That’s a lot of emails in a short time. Give it a minute, then retry.',
	over_request_rate_limit: 'Too many attempts just now. Give it a minute, then retry.',
	signup_disabled: 'New sign-ups are turned off for this kitchen right now.',
	anonymous_provider_disabled: 'Guest sessions are turned off — please sign in with your email.',
	validation_failed: 'Something in that form didn’t look right. Give it another look?'
};

// Fallbacks for older responses that carry no `code`. Substring match, lowercased.
const BY_MESSAGE: [needle: string, message: string][] = [
	['invalid login credentials', 'That email and password don’t match. Want to try again?'],
	['email not confirmed', 'Please confirm your email first — check your inbox for the link.'],
	['password should be at least', 'That password is a little too short.'],
	['rate limit', 'Too many attempts just now. Give it a minute, then retry.'],
	['failed to fetch', 'We couldn’t reach the kitchen. Check your connection and try again.']
];

const FALLBACK = 'Something went sideways signing you in. Please try again.';

const DUPLICATE_CODES = new Set(['user_already_exists', 'email_exists']);

/**
 * True when Supabase is saying the address is already registered.
 *
 * Never turn this into a user-facing message — that's the whole point of routing it
 * through here. It exists so signUp can fold the "confirmations off" error into the same
 * outcome the "confirmations on" obfuscated response produces, leaving the UI with no way
 * to tell a duplicate sign-up from a new one.
 */
export function isDuplicateAccount(error: unknown): boolean {
	if (!(error instanceof AuthError)) return false;
	if (error.code && DUPLICATE_CODES.has(error.code)) return true;
	return error.message.toLowerCase().includes('already registered');
}

export function authErrorMessage(error: unknown): string {
	// Caught before anything else, including the raw-message pass-through below: Supabase's
	// own text ("User already registered") states outright what the sign-up flow is at
	// pains not to. signUp intercepts these first, so this is a backstop for any future
	// caller that doesn't.
	if (isDuplicateAccount(error)) return FALLBACK;

	if (error instanceof AuthError) {
		if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
		const lowered = error.message.toLowerCase();
		const matched = BY_MESSAGE.find(([needle]) => lowered.includes(needle));
		if (matched) return matched[1];
		return error.message || FALLBACK;
	}
	// Rarely reached for Supabase calls: auth-js wraps fetch failures in
	// AuthRetryableFetchError, which extends AuthError, so a network error from
	// supabase.auth.* matches the 'failed to fetch' row in the branch above. This covers
	// anything that reaches us from outside auth-js.
	if (error instanceof Error) {
		const lowered = error.message.toLowerCase();
		const matched = BY_MESSAGE.find(([needle]) => lowered.includes(needle));
		if (matched) return matched[1];
	}
	return FALLBACK;
}
