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

const BY_CODE: Record<string, string> = {
	invalid_credentials: 'That email and password don’t match. Want to try again?',
	email_not_confirmed: 'Please confirm your email first — check your inbox for the link.',
	user_already_exists: 'There’s already an account with that email. Try signing in instead.',
	email_exists: 'There’s already an account with that email. Try signing in instead.',
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
	['already registered', 'There’s already an account with that email. Try signing in instead.'],
	['password should be at least', 'That password is a little too short.'],
	['rate limit', 'Too many attempts just now. Give it a minute, then retry.'],
	['failed to fetch', 'We couldn’t reach the kitchen. Check your connection and try again.']
];

const FALLBACK = 'Something went sideways signing you in. Please try again.';

export function authErrorMessage(error: unknown): string {
	if (error instanceof AuthError) {
		if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
		const lowered = error.message.toLowerCase();
		const matched = BY_MESSAGE.find(([needle]) => lowered.includes(needle));
		if (matched) return matched[1];
		return error.message || FALLBACK;
	}
	// Network failures surface as plain TypeErrors from fetch, not AuthError.
	if (error instanceof Error) {
		const lowered = error.message.toLowerCase();
		const matched = BY_MESSAGE.find(([needle]) => lowered.includes(needle));
		if (matched) return matched[1];
	}
	return FALLBACK;
}
