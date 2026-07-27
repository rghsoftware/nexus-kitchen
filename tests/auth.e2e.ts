import { expect, test, type Page, type Route } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD, e2eSession, mockAuthEndpoints, signIn } from './support/session';

// ---------------------------------------------------------------------------
// Auth — the sign-in wall, the route guard, and sign-out (feature 008,
// REQ-SC-001..004).
//
// Runs against stub Supabase env with the Auth endpoints intercepted, so these
// specs exercise our guard and form logic while supabase-js does the real
// session bookkeeping (storage, the token round-trip, onAuthStateChange).
// ---------------------------------------------------------------------------

function fulfillJson(route: Route, body: unknown, status = 200) {
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** Empty REST reads, so protected screens render their empty states once we're in. */
async function mockRest(page: Page) {
	await page.route(/supabase\.co\/rest\//, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'content-range': '0-0/0' },
			body: '[]'
		})
	);
}

test.describe('Auth — the sign-in wall', () => {
	test('an unauthenticated visit to a protected route redirects to /signin', async ({ page }) => {
		await page.goto('/today');
		await expect(page).toHaveURL(/\/signin/);
		await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
	});

	test('the app chrome is hidden on the wall', async ({ page }) => {
		await page.goto('/signin');
		// Nav would leak the shape of the app to someone who cannot use any of it.
		await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
	});

	test('a deep link is remembered and restored after signing in', async ({ page }) => {
		await mockAuthEndpoints(page);
		await mockRest(page);

		await page.goto('/pantry');
		await expect(page).toHaveURL(/\/signin\?next=%2Fpantry/);

		await page.getByLabel('Email').fill(E2E_EMAIL);
		await page.getByLabel('Password').fill(E2E_PASSWORD);
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();

		await expect(page).toHaveURL(/\/pantry/);
	});

	test('an off-site `next` is refused rather than followed', async ({ page }) => {
		await mockAuthEndpoints(page);
		await mockRest(page);

		// A crafted link must not turn the sign-in screen into an open redirect.
		await page.goto('/signin?next=https%3A%2F%2Fevil.example.com');
		await page.getByLabel('Email').fill(E2E_EMAIL);
		await page.getByLabel('Password').fill(E2E_PASSWORD);
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();

		await expect(page).toHaveURL(/\/today/);
	});

	test('a protocol-relative `next` is refused too', async ({ page }) => {
		await mockAuthEndpoints(page);
		await mockRest(page);

		await page.goto('/signin?next=%2F%2Fevil.example.com');
		await page.getByLabel('Email').fill(E2E_EMAIL);
		await page.getByLabel('Password').fill(E2E_PASSWORD);
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();

		await expect(page).toHaveURL(/\/today/);
	});

	test('bad credentials keep you on the wall with a calm message', async ({ page }) => {
		await page.route(/auth\/v1\/token/, (route) =>
			fulfillJson(route, { code: 'invalid_credentials', message: 'Invalid login credentials' }, 400)
		);

		await page.goto('/signin');
		await page.getByLabel('Email').fill(E2E_EMAIL);
		await page.getByLabel('Password').fill('wrong-password');
		await page.getByRole('button', { name: 'Sign in', exact: true }).click();

		await expect(page.getByRole('alert')).toContainText(/don’t match/);
		await expect(page).toHaveURL(/\/signin/);
	});
});

test.describe('Auth — signing up', () => {
	test('a session straight back signs you in (confirmations disabled)', async ({ page }) => {
		await mockAuthEndpoints(page);
		await mockRest(page);

		await page.goto('/signin');
		await page.getByRole('button', { name: 'Create an account' }).click();
		await page.getByLabel('Email').fill(E2E_EMAIL);
		await page.getByLabel('Password').fill(E2E_PASSWORD);
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page).toHaveURL(/\/today/);
	});

	test('a null session asks you to check your inbox (confirmations enabled)', async ({ page }) => {
		// The signup endpoint answering with a bare user (no access_token) is exactly
		// what Supabase returns when email confirmation is required.
		await page.route(/auth\/v1\/signup/, (route) => fulfillJson(route, e2eSession().user));
		await mockRest(page);

		await page.goto('/signin');
		await page.getByRole('button', { name: 'Create an account' }).click();
		await page.getByLabel('Email').fill(E2E_EMAIL);
		await page.getByLabel('Password').fill(E2E_PASSWORD);
		await page.getByRole('button', { name: 'Create account' }).click();

		await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
		await expect(page.getByText(E2E_EMAIL)).toBeVisible();
		await expect(page).toHaveURL(/\/signin/);
	});
});

test.describe('Auth — account & sign-out', () => {
	test('the account screen shows who is signed in', async ({ page }) => {
		await mockAuthEndpoints(page);
		await mockRest(page);
		await signIn(page);

		await page.goto('/account');
		await expect(page.getByText('Signed in as')).toBeVisible();
		// Scoped to the paragraph: the sidebar footer also shows the address.
		await expect(page.getByRole('paragraph').filter({ hasText: E2E_EMAIL })).toBeVisible();
	});

	test('signing out returns to the wall and re-gates the app', async ({ page }) => {
		await mockAuthEndpoints(page);
		await mockRest(page);
		await signIn(page);

		await page.goto('/account');
		await page.getByRole('button', { name: 'Sign out' }).click();
		await expect(page).toHaveURL(/\/signin/);

		// And the session really is gone — not just the screen.
		await page.goto('/today');
		await expect(page).toHaveURL(/\/signin/);
	});

	test('a signed-in visit to /signin bounces to Today', async ({ page }) => {
		await mockAuthEndpoints(page);
		await mockRest(page);
		await signIn(page);

		await page.goto('/signin');
		await expect(page).toHaveURL(/\/today/);
	});
});
