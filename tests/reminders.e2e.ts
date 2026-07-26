import { expect, test, type Page, type Route } from '@playwright/test';
import { signIn } from './support/session';

// ---------------------------------------------------------------------------
// Reminders — the "Gentle nudges" setup screen (feature 007, REQ-MR-001..003).
//
// Same in-Node mock backend approach as today.e2e.ts, reduced to the one table
// this screen touches. The mock's POST implements PostgREST upsert semantics on
// (meal_slot) — one row per slot, matching the DB's UNIQUE (owner, slot).
// Delivery itself is server-side (Cron → Edge Function → Pushover) and out of
// e2e scope; what matters here is that preferences round-trip.
// ---------------------------------------------------------------------------

interface Row {
	[key: string]: unknown;
	id: string;
}

const USER_ID = 'user-e2e';

function makeSession() {
	return {
		access_token: 'header.payload.signature',
		token_type: 'bearer',
		expires_in: 86400,
		expires_at: Math.floor(Date.now() / 1000) + 86400,
		refresh_token: 'refresh-e2e',
		user: {
			id: USER_ID,
			aud: 'authenticated',
			role: 'authenticated',
			email: '',
			is_anonymous: true,
			app_metadata: {},
			user_metadata: {},
			created_at: '2026-01-01T00:00:00Z'
		}
	};
}

function fulfillJson(route: Route, body: unknown, status = 200) {
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockBackend(page: Page): Promise<{ meal_reminders: Row[] }> {
	const db: { meal_reminders: Row[] } = { meal_reminders: [] };
	let idCounter = 0;

	await page.route(/auth\/v1\/(signup|token|user)/, (route) => {
		if (route.request().url().includes('/user')) {
			return fulfillJson(route, makeSession().user);
		}
		return fulfillJson(route, makeSession());
	});

	await page.route(/rest\/v1\/meal_reminders(\?|$)/, async (route) => {
		const request = route.request();
		const method = request.method();

		if (method === 'GET') {
			return fulfillJson(route, db.meal_reminders);
		}

		if (method === 'POST') {
			// Bulk upsert on (owner, meal_slot) — the saveReminders batch.
			const body = request.postDataJSON() as Row | Row[];
			const incoming = Array.isArray(body) ? body : [body];
			const nowISO = new Date().toISOString();
			const saved = incoming.map((cols) => {
				const existing = db.meal_reminders.find((r) => r.meal_slot === cols.meal_slot);
				if (existing) {
					Object.assign(existing, cols, { updated_at: nowISO });
					return existing;
				}
				const created: Row = {
					owner_id: USER_ID,
					household_id: null,
					pre_alert_minutes: null,
					is_enabled: true,
					days_of_week: [1, 2, 3, 4, 5, 6, 7],
					notification_type: 'PUSH',
					created_at: nowISO,
					updated_at: nowISO,
					...cols,
					id: `rem-${++idCounter}`
				};
				db.meal_reminders.push(created);
				return created;
			});
			return fulfillJson(route, saved, 201);
		}

		return fulfillJson(route, []);
	});

	return db;
}

test.describe('Reminders — Gentle nudges setup (REQ-MR-001..003)', () => {
	test('renders the four slot rows with the design defaults', async ({ page }) => {
		await mockBackend(page);
		await signIn(page);
		await page.goto('/reminders');

		await expect(page.getByRole('heading', { name: 'When would you like a nudge?' })).toBeVisible();
		await expect(page.getByLabel('Breakfast', { exact: true })).toHaveValue('08:00');
		await expect(page.getByLabel('Lunch', { exact: true })).toHaveValue('12:30');
		await expect(page.getByLabel('Dinner', { exact: true })).toHaveValue('18:30');
		await expect(page.getByLabel('Snacks', { exact: true })).toHaveValue('15:00');

		// Mockup defaults: dinner carries the 30-minute pre-alert, snacks start off.
		await expect(page.getByLabel('Dinner pre-alert')).toHaveValue('30');
		await expect(page.getByRole('button', { name: 'Breakfast reminder' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(page.getByRole('button', { name: 'Snacks reminder' })).toHaveAttribute(
			'aria-pressed',
			'false'
		);
	});

	test('Set reminders persists all four slots and confirms calmly', async ({ page }) => {
		const db = await mockBackend(page);
		await signIn(page);
		await page.goto('/reminders');
		await expect(page.getByRole('heading', { name: 'When would you like a nudge?' })).toBeVisible();

		await page.getByRole('button', { name: 'Set reminders' }).click();
		await expect(page.getByText('Saved. Nudges will follow these times.')).toBeVisible();

		expect(db.meal_reminders).toHaveLength(4);
		const dinner = db.meal_reminders.find((r) => r.meal_slot === 'DINNER');
		expect(dinner).toMatchObject({ reminder_time: '18:30', pre_alert_minutes: 30 });
		// The device's IANA zone rides along so server-side delivery math follows it.
		expect(typeof dinner?.timezone).toBe('string');
		expect((dinner?.timezone as string).length).toBeGreaterThan(0);
	});

	test('edits round-trip: toggle snacks on, change its time, save, reload', async ({ page }) => {
		const db = await mockBackend(page);
		await signIn(page);
		await page.goto('/reminders');
		await expect(page.getByRole('heading', { name: 'When would you like a nudge?' })).toBeVisible();

		await page.getByRole('button', { name: 'Snacks reminder' }).click();
		await page.getByLabel('Snacks', { exact: true }).fill('16:00');
		await page.getByRole('button', { name: 'Set reminders' }).click();
		await expect(page.getByText('Saved. Nudges will follow these times.')).toBeVisible();

		const snack = db.meal_reminders.find((r) => r.meal_slot === 'SNACK');
		expect(snack).toMatchObject({ is_enabled: true, reminder_time: '16:00' });

		await page.reload();
		await expect(page.getByLabel('Snacks', { exact: true })).toHaveValue('16:00');
		await expect(page.getByRole('button', { name: 'Snacks reminder' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('is reachable from the Today header bell, and Maybe later exits back', async ({ page }) => {
		await mockBackend(page);
		await signIn(page);
		// The bell needs no other Today data — empty states are fine.
		await page.route(/rest\/v1\/(?!meal_reminders)/, (route) => fulfillJson(route, []));
		await page.goto('/today');

		await page.getByRole('link', { name: 'Gentle nudges' }).click();
		await page.waitForURL(/\/reminders$/);
		await expect(page.getByRole('heading', { name: 'When would you like a nudge?' })).toBeVisible();

		await page.getByRole('button', { name: 'Maybe later' }).click();
		await page.waitForURL(/\/today$/);
	});
});
