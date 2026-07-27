// Client-side pre-checks for the auth form (feature 008). These exist purely to give
// fast, calm feedback before a network round-trip — Supabase Auth remains the authority
// on what it accepts (REQ-SC-002: we never reimplement credential handling). Keep
// MIN_PASSWORD_LENGTH in sync with `minimum_password_length` in supabase/config.toml.

/** Mirrors `auth.minimum_password_length` in supabase/config.toml. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Deliberately permissive: a shape check, not an RFC 5322 parser. Anything that looks
 * like `local@domain.tld` passes and Supabase decides the rest — over-strict client
 * regexes reject valid addresses and are a classic source of lockouts.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
	const trimmed = email.trim();
	if (!trimmed) return 'Enter your email address.';
	if (!EMAIL_SHAPE.test(trimmed)) return "That doesn't look like an email address.";
	return null;
}

export function validatePassword(password: string): string | null {
	if (!password) return 'Enter a password.';
	if (password.length < MIN_PASSWORD_LENGTH) {
		return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
	}
	return null;
}

/**
 * Sign-in only checks presence — an existing account may predate any rule we add later,
 * so length checks here would lock people out of their own data.
 */
export function validateSignIn(email: string, password: string): string | null {
	return validateEmail(email) ?? (password ? null : 'Enter your password.');
}

export function validateSignUp(email: string, password: string): string | null {
	return validateEmail(email) ?? validatePassword(password);
}
