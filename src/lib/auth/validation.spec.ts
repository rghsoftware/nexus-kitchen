import { describe, expect, it } from 'vitest';
import {
	MIN_PASSWORD_LENGTH,
	validateEmail,
	validatePassword,
	validateSignIn,
	validateSignUp
} from './validation';

describe('validateEmail', () => {
	it('accepts an ordinary address', () => {
		expect(validateEmail('cook@example.com')).toBeNull();
	});

	it('accepts addresses with plus tags and subdomains', () => {
		expect(validateEmail('cook+meal@mail.example.co.uk')).toBeNull();
	});

	it('trims surrounding whitespace before judging', () => {
		expect(validateEmail('  cook@example.com  ')).toBeNull();
	});

	it('asks for an address when empty', () => {
		expect(validateEmail('')).toBe('Enter your email address.');
		expect(validateEmail('   ')).toBe('Enter your email address.');
	});

	it.each(['cook', 'cook@', '@example.com', 'cook@example', 'a b@example.com'])(
		'rejects malformed input: %s',
		(input) => {
			expect(validateEmail(input)).toBe("That doesn't look like an email address.");
		}
	);
});

describe('validatePassword', () => {
	it('accepts a password at the minimum length', () => {
		expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
	});

	it('rejects one character short of the minimum', () => {
		expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBe(
			`Use at least ${MIN_PASSWORD_LENGTH} characters.`
		);
	});

	it('asks for a password when empty', () => {
		expect(validatePassword('')).toBe('Enter a password.');
	});
});

describe('validateSignIn', () => {
	it('passes a well-formed pair', () => {
		expect(validateSignIn('cook@example.com', 'x')).toBeNull();
	});

	it('reports the email problem first', () => {
		expect(validateSignIn('nope', '')).toBe("That doesn't look like an email address.");
	});

	it('requires a password', () => {
		expect(validateSignIn('cook@example.com', '')).toBe('Enter your password.');
	});

	it('does NOT enforce a length rule — an older account may predate it', () => {
		expect(validateSignIn('cook@example.com', 'short')).toBeNull();
	});
});

describe('validateSignUp', () => {
	it('passes a well-formed pair', () => {
		expect(validateSignUp('cook@example.com', 'a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
	});

	it('enforces the length rule, unlike sign-in', () => {
		expect(validateSignUp('cook@example.com', 'short')).toBe(
			`Use at least ${MIN_PASSWORD_LENGTH} characters.`
		);
	});

	it('reports the email problem first', () => {
		expect(validateSignUp('nope', 'short')).toBe("That doesn't look like an email address.");
	});
});
