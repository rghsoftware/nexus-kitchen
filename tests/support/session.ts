import { expect, type Page, type Route } from '@playwright/test';

// ---------------------------------------------------------------------------
// Shared e2e session helpers (feature 008 — real auth).
//
// The app is gated: every route except /signin redirects to the sign-in wall
// until a session exists. These suites run against stub Supabase env (see
// playwright.config.ts) with no live backend, so we intercept the Auth
// endpoints and drive a real sign-in through the UI — supabase-js then persists
// the session itself, which keeps these tests independent of its storage format.
// ---------------------------------------------------------------------------

export const E2E_USER_ID = 'user-e2e';
export const E2E_EMAIL = 'cook@example.com';
export const E2E_PASSWORD = 'password1';

export function e2eSession(userId: string = E2E_USER_ID) {
	return {
		access_token: 'header.payload.signature',
		token_type: 'bearer',
		expires_in: 86400,
		expires_at: Math.floor(Date.now() / 1000) + 86400,
		refresh_token: 'refresh-e2e',
		user: {
			id: userId,
			aud: 'authenticated',
			role: 'authenticated',
			email: E2E_EMAIL,
			app_metadata: {},
			user_metadata: {},
			created_at: new Date(0).toISOString()
		}
	};
}

function fulfillJson(route: Route, body: unknown, status = 200) {
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/**
 * Intercept Supabase Auth so sign-in succeeds without a backend. Suites that
 * already install their own `auth/v1` route (plan, today, reminders) don't need this.
 */
export async function mockAuthEndpoints(page: Page, userId: string = E2E_USER_ID) {
	await page.route(/auth\/v1\/(signup|token|user|logout)/, (route) => {
		const url = route.request().url();
		if (url.includes('/logout')) return fulfillJson(route, {}, 204);
		if (url.includes('/user')) return fulfillJson(route, e2eSession(userId).user);
		return fulfillJson(route, e2eSession(userId));
	});
}

/**
 * Sign in through the real form, then wait for the layout guard to leave /signin.
 * Call once per page before navigating to a protected route; supabase-js keeps the
 * session in storage for subsequent `page.goto` calls.
 */
export async function signIn(page: Page) {
	await page.goto('/signin');
	await page.getByLabel('Email').fill(E2E_EMAIL);
	await page.getByLabel('Password').fill(E2E_PASSWORD);
	await page.getByRole('button', { name: 'Sign in', exact: true }).click();
	await expect(page).not.toHaveURL(/\/signin/);
}
