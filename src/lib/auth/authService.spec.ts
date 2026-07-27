import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '@supabase/supabase-js';

vi.mock('$lib/supabaseClient', () => ({
	supabase: {
		auth: {
			signInWithPassword: vi.fn(),
			signUp: vi.fn(),
			signOut: vi.fn(),
			resetPasswordForEmail: vi.fn(),
			updateUser: vi.fn(),
			resend: vi.fn()
		}
	}
}));

import { supabase } from '$lib/supabaseClient';
import { AuthFailure, requestPasswordReset, signIn, signOut, signUp } from './authService';

const auth = supabase.auth as unknown as Record<string, ReturnType<typeof vi.fn>>;

const USER = { id: 'user-1', email: 'cook@example.com' };
const SESSION = { access_token: 'token' };

beforeEach(() => {
	vi.clearAllMocks();
});

describe('signIn', () => {
	it('returns the user and trims the email before sending it', async () => {
		auth.signInWithPassword.mockResolvedValue({ data: { user: USER }, error: null });

		await expect(signIn('  cook@example.com  ', 'pw')).resolves.toEqual(USER);
		expect(auth.signInWithPassword).toHaveBeenCalledWith({
			email: 'cook@example.com',
			password: 'pw'
		});
	});

	it('throws AuthFailure carrying a translated message', async () => {
		auth.signInWithPassword.mockResolvedValue({
			data: { user: null },
			error: new AuthError('Invalid login credentials', 400, 'invalid_credentials')
		});

		await expect(signIn('cook@example.com', 'wrong')).rejects.toThrow(AuthFailure);
		await expect(signIn('cook@example.com', 'wrong')).rejects.toThrow(
			'That email and password don’t match. Want to try again?'
		);
	});

	it('preserves the original error as `cause` for debugging', async () => {
		const original = new AuthError('Invalid login credentials', 400, 'invalid_credentials');
		auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: original });

		await expect(signIn('cook@example.com', 'wrong')).rejects.toMatchObject({ cause: original });
	});
});

describe('signUp', () => {
	// The branch the sign-up UX hinges on: whether the project auto-confirms.
	it('reports "active" when a session comes back (confirmations disabled)', async () => {
		auth.signUp.mockResolvedValue({ data: { user: USER, session: SESSION }, error: null });

		await expect(signUp('cook@example.com', 'password1')).resolves.toEqual({
			status: 'active',
			user: USER
		});
	});

	it('reports "confirmation-required" when the session is null (confirmations enabled)', async () => {
		auth.signUp.mockResolvedValue({ data: { user: USER, session: null }, error: null });

		await expect(signUp('cook@example.com', 'password1')).resolves.toEqual({
			status: 'confirmation-required',
			email: 'cook@example.com'
		});
	});

	it('returns the trimmed email in the confirmation outcome', async () => {
		auth.signUp.mockResolvedValue({ data: { user: USER, session: null }, error: null });

		await expect(signUp('  cook@example.com  ', 'password1')).resolves.toEqual({
			status: 'confirmation-required',
			email: 'cook@example.com'
		});
	});

	// The same duplicate reaches us as an error with confirmations off and as a success
	// with them on. Both must produce one outcome, or sign-up would behave differently —
	// and leak differently — depending on project configuration.
	it('reports "already-registered" when Supabase raises a duplicate error', async () => {
		auth.signUp.mockResolvedValue({
			data: { user: null, session: null },
			error: new AuthError('User already registered', 422, 'user_already_exists')
		});

		await expect(signUp('  cook@example.com  ', 'password1')).resolves.toEqual({
			status: 'already-registered',
			email: 'cook@example.com'
		});
	});

	// With confirmations on, Supabase hides the duplicate behind a success response:
	// an obfuscated user, no identities, no session, and no mail sent.
	it('reports "already-registered" for the obfuscated duplicate-signup response', async () => {
		auth.signUp.mockResolvedValue({
			data: { user: { ...USER, identities: [] }, session: null },
			error: null
		});

		await expect(signUp('  cook@example.com  ', 'password1')).resolves.toEqual({
			status: 'already-registered',
			email: 'cook@example.com'
		});
	});

	it('still reports "confirmation-required" when identities are present', async () => {
		auth.signUp.mockResolvedValue({
			data: { user: { ...USER, identities: [{ id: 'identity-1' }] }, session: null },
			error: null
		});

		await expect(signUp('cook@example.com', 'password1')).resolves.toEqual({
			status: 'confirmation-required',
			email: 'cook@example.com'
		});
	});

	it('fails loudly when the response carries no user at all', async () => {
		auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });

		await expect(signUp('cook@example.com', 'password1')).rejects.toThrow(AuthFailure);
	});
});

describe('signOut', () => {
	it('resolves when Supabase clears the session', async () => {
		auth.signOut.mockResolvedValue({ error: null });

		await expect(signOut()).resolves.toBeUndefined();
	});

	// supabase-js defaults to scope 'global', which would revoke every device's refresh
	// token — signing out on a phone would sign the user out of their laptop as well.
	it('signs out this device only', async () => {
		auth.signOut.mockResolvedValue({ error: null });

		await signOut();

		expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
	});

	it('throws AuthFailure when sign-out fails', async () => {
		auth.signOut.mockResolvedValue({ error: new AuthError('nope', 500, 'unexpected_failure') });

		await expect(signOut()).rejects.toThrow(AuthFailure);
	});
});

describe('requestPasswordReset', () => {
	it('forwards the redirect target so the link lands back in the app', async () => {
		auth.resetPasswordForEmail.mockResolvedValue({ error: null });

		await requestPasswordReset('cook@example.com', 'http://localhost:5173/account');

		expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('cook@example.com', {
			redirectTo: 'http://localhost:5173/account'
		});
	});
});
