import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

// Mock the service seam, not supabase-js: these specs are about what the form shows,
// and the service's own behaviour is covered in authService.spec.ts.
const { signIn, signUp, requestPasswordReset, resendConfirmation } = vi.hoisted(() => ({
	signIn: vi.fn(),
	signUp: vi.fn(),
	requestPasswordReset: vi.fn(),
	resendConfirmation: vi.fn()
}));

vi.mock('$lib/auth', async (importOriginal) => {
	// Keep the real validation + AuthFailure so the form's guard clauses are exercised.
	const actual = await importOriginal<typeof import('$lib/auth')>();
	return { ...actual, signIn, signUp, requestPasswordReset, resendConfirmation };
});

import AuthForm from './AuthForm.svelte';
import { AuthFailure } from '$lib/auth';

beforeEach(() => {
	vi.clearAllMocks();
});

describe('AuthForm.svelte', () => {
	it('opens in sign-in mode', async () => {
		render(AuthForm);
		await expect.element(page.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
	});

	it('switches to sign-up and back', async () => {
		render(AuthForm);
		await page.getByRole('button', { name: 'Create an account' }).click();
		await expect
			.element(page.getByRole('heading', { name: 'Set up your kitchen' }))
			.toBeInTheDocument();

		await page.getByRole('button', { name: 'Sign in', exact: true }).click();
		await expect.element(page.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
	});

	it('blocks submission and explains why when the email is malformed', async () => {
		render(AuthForm);
		await page.getByLabelText('Email').fill('not-an-email');
		await page.getByLabelText('Password').fill('password1');
		await page.getByRole('button', { name: 'Sign in' }).click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent("That doesn't look like an email address.");
		expect(signIn).not.toHaveBeenCalled();
	});

	it('enforces the length rule on sign-up but not on sign-in', async () => {
		render(AuthForm);
		await page.getByLabelText('Email').fill('cook@example.com');
		await page.getByLabelText('Password').fill('short');

		// Sign-in accepts it — an existing account may predate the rule.
		signIn.mockResolvedValue({ id: 'user-1' });
		await page.getByRole('button', { name: 'Sign in' }).click();
		expect(signIn).toHaveBeenCalledOnce();

		await page.getByRole('button', { name: 'Create an account' }).click();
		await page.getByLabelText('Email').fill('cook@example.com');
		await page.getByLabelText('Password').fill('short');
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect.element(page.getByRole('alert')).toHaveTextContent('Use at least 8 characters.');
		expect(signUp).not.toHaveBeenCalled();
	});

	it('calls signIn with the entered credentials', async () => {
		signIn.mockResolvedValue({ id: 'user-1' });
		render(AuthForm);
		await page.getByLabelText('Email').fill('cook@example.com');
		await page.getByLabelText('Password').fill('password1');
		await page.getByRole('button', { name: 'Sign in' }).click();

		expect(signIn).toHaveBeenCalledWith('cook@example.com', 'password1');
	});

	it('surfaces a failed sign-in in the product voice', async () => {
		signIn.mockRejectedValue(new AuthFailure('That email and password don’t match.'));
		render(AuthForm);
		await page.getByLabelText('Email').fill('cook@example.com');
		await page.getByLabelText('Password').fill('password1');
		await page.getByRole('button', { name: 'Sign in' }).click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('That email and password don’t match.');
	});

	it('shows the check-your-inbox state when sign-up needs confirmation', async () => {
		signUp.mockResolvedValue({ status: 'confirmation-required', email: 'cook@example.com' });
		render(AuthForm);
		await page.getByRole('button', { name: 'Create an account' }).click();
		await page.getByLabelText('Email').fill('cook@example.com');
		await page.getByLabelText('Password').fill('password1');
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect
			.element(page.getByRole('heading', { name: 'Check your inbox' }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Resend the link' })).toBeInTheDocument();
	});

	it('stays put when sign-up returns an active session — the guard navigates', async () => {
		signUp.mockResolvedValue({ status: 'active', user: { id: 'user-1' } });
		render(AuthForm);
		await page.getByRole('button', { name: 'Create an account' }).click();
		await page.getByLabelText('Email').fill('cook@example.com');
		await page.getByLabelText('Password').fill('password1');
		await page.getByRole('button', { name: 'Create account' }).click();

		expect(signUp).toHaveBeenCalledOnce();
		await expect
			.element(page.getByRole('heading', { name: 'Set up your kitchen' }))
			.toBeInTheDocument();
	});

	it('resends the confirmation link on request', async () => {
		signUp.mockResolvedValue({ status: 'confirmation-required', email: 'cook@example.com' });
		resendConfirmation.mockResolvedValue(undefined);
		render(AuthForm);
		await page.getByRole('button', { name: 'Create an account' }).click();
		await page.getByLabelText('Email').fill('cook@example.com');
		await page.getByLabelText('Password').fill('password1');
		await page.getByRole('button', { name: 'Create account' }).click();
		await page.getByRole('button', { name: 'Resend the link' }).click();

		expect(resendConfirmation).toHaveBeenCalledWith('cook@example.com');
	});

	it('hides the password field in reset mode and only needs an email', async () => {
		requestPasswordReset.mockResolvedValue(undefined);
		render(AuthForm);
		await page.getByRole('button', { name: 'Forgot it?' }).click();

		await expect
			.element(page.getByRole('heading', { name: 'Reset your password' }))
			.toBeInTheDocument();
		expect(document.querySelector('#auth-password')).toBeNull();

		await page.getByLabelText('Email').fill('cook@example.com');
		await page.getByRole('button', { name: 'Send reset link' }).click();

		expect(requestPasswordReset).toHaveBeenCalledOnce();
		await expect
			.element(page.getByRole('heading', { name: 'Check your inbox' }))
			.toBeInTheDocument();
	});

	it('does not confirm whether the address exists when resetting', async () => {
		requestPasswordReset.mockResolvedValue(undefined);
		render(AuthForm);
		await page.getByRole('button', { name: 'Forgot it?' }).click();
		await page.getByLabelText('Email').fill('stranger@example.com');
		await page.getByRole('button', { name: 'Send reset link' }).click();

		// Deliberately conditional phrasing — a definite "we sent it" would leak
		// which addresses have accounts.
		await expect.element(page.getByText(/If an account exists/)).toBeInTheDocument();
	});
});
