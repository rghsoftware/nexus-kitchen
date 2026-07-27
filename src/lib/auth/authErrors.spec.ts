import { describe, expect, it } from 'vitest';
import { AuthError } from '@supabase/supabase-js';
import { authErrorMessage, isDuplicateAccount } from './authErrors';

/** AuthError's constructor is (message, status?, code?). */
function authError(message: string, code?: string): AuthError {
	return new AuthError(message, 400, code);
}

describe('authErrorMessage', () => {
	it('translates a known code into product voice', () => {
		const message = authErrorMessage(authError('Invalid login credentials', 'invalid_credentials'));
		expect(message).toBe('That email and password don’t match. Want to try again?');
	});

	it('prefers the code over the message text when both are present', () => {
		// Message matches the invalid-credentials row but the code says weak password —
		// code wins, because Supabase's message copy is not a stable contract.
		const message = authErrorMessage(authError('Invalid login credentials', 'weak_password'));
		expect(message).toBe('That password is a little too easy to guess. Try a longer one.');
	});

	it('falls back to message matching when no code is supplied', () => {
		expect(authErrorMessage(authError('Invalid login credentials'))).toBe(
			'That email and password don’t match. Want to try again?'
		);
	});

	it('matches message text case-insensitively', () => {
		expect(authErrorMessage(authError('EMAIL NOT CONFIRMED'))).toBe(
			'Please confirm your email first — check your inbox for the link.'
		);
	});

	// Sign-up must not reveal that an address is taken, so no mapping may turn a duplicate
	// into copy that says so. signUp folds these into an `already-registered` outcome
	// before they ever reach the translator.
	it('has no message that reveals an address is already registered', () => {
		for (const code of ['user_already_exists', 'email_exists']) {
			const message = authErrorMessage(authError('User already registered', code));
			expect(message).not.toMatch(/already an account|already registered/i);
		}
	});
});

describe('isDuplicateAccount', () => {
	it('recognises the duplicate-account codes', () => {
		expect(isDuplicateAccount(authError('User already registered', 'user_already_exists'))).toBe(
			true
		);
		expect(isDuplicateAccount(authError('Email exists', 'email_exists'))).toBe(true);
	});

	it('falls back to the message when no code is supplied', () => {
		expect(isDuplicateAccount(authError('User already registered'))).toBe(true);
	});

	it('does not claim unrelated failures are duplicates', () => {
		expect(isDuplicateAccount(authError('Invalid login credentials', 'invalid_credentials'))).toBe(
			false
		);
		expect(isDuplicateAccount(new Error('kaboom'))).toBe(false);
		expect(isDuplicateAccount(null)).toBe(false);
	});

	it('passes through an unrecognised AuthError message rather than hiding it', () => {
		expect(authErrorMessage(authError('Some brand new failure', 'never_seen_before'))).toBe(
			'Some brand new failure'
		);
	});

	it('translates a network failure, which arrives as a plain TypeError', () => {
		expect(authErrorMessage(new TypeError('Failed to fetch'))).toBe(
			'We couldn’t reach the kitchen. Check your connection and try again.'
		);
	});

	it('falls back for a non-Error value', () => {
		expect(authErrorMessage('just a string')).toBe(
			'Something went sideways signing you in. Please try again.'
		);
	});

	it('falls back for an unrecognised plain Error', () => {
		expect(authErrorMessage(new Error('kaboom'))).toBe(
			'Something went sideways signing you in. Please try again.'
		);
	});
});
