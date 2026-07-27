import { expect, test, type Page, type Route } from '@playwright/test';
import { signIn } from './support/session';

// ---------------------------------------------------------------------------
// Today — dashboard + one-tap logging flows (feature 006, FR-TL-001..018).
//
// Same stateful in-Node mock backend approach as plan.e2e.ts, extended with
// meal_logs, prepped_meals, pantry_items, and portion_events (whose mock
// applies the sync_portions_remaining trigger semantics).
// ---------------------------------------------------------------------------

interface Row {
	[key: string]: unknown;
	id: string;
}

interface MockDb {
	meal_plans: Row[];
	planned_meals: Row[];
	recipes: Row[];
	recipe_ingredients: Row[];
	prepped_meals: Row[];
	pantry_items: Row[];
	meal_logs: Row[];
	portion_events: Row[];
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

/** Local civil date, matching the app's localDateISO (browser and test share a TZ). */
function todayISO(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	const d = String(now.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

function rowPredicate(url: URL): (row: Row) => boolean {
	const checks: ((row: Row) => boolean)[] = [];
	for (const [key, raw] of url.searchParams.entries()) {
		if (key === 'select' || key === 'order' || key === 'limit') continue;
		const dot = raw.indexOf('.');
		if (dot === -1) continue;
		const op = raw.slice(0, dot);
		const value = raw.slice(dot + 1);
		if (op === 'eq') checks.push((row) => String(row[key]) === value);
		else if (op === 'neq') checks.push((row) => String(row[key]) !== value);
		else if (op === 'gte') checks.push((row) => String(row[key]) >= value);
		else if (op === 'lte') checks.push((row) => String(row[key]) <= value);
		else if (op === 'lt') checks.push((row) => String(row[key]) < value);
		else if (op === 'is' && value === 'null') checks.push((row) => row[key] === null);
	}
	return (row) => checks.every((c) => c(row));
}

function applyOrderLimit(rows: Row[], url: URL): Row[] {
	const order = url.searchParams.get('order');
	let out = [...rows];
	if (order) {
		const terms = order.split(',').map((t) => t.split('.'));
		out.sort((a, b) => {
			for (const [key, ...mods] of terms) {
				const dir = mods.includes('desc') ? -1 : 1;
				const av = a[key];
				const bv = b[key];
				if (av === bv) continue;
				if (av === null) return 1;
				if (bv === null) return -1;
				return (String(av) < String(bv) ? -1 : 1) * dir;
			}
			return 0;
		});
	}
	const limit = url.searchParams.get('limit');
	if (limit) out = out.slice(0, Number(limit));
	return out;
}

function wantsSingleObject(route: Route): boolean {
	return (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
}

function fulfillJson(route: Route, body: unknown, status = 200) {
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

const TABLES = [
	'meal_plans',
	'planned_meals',
	'recipes',
	'recipe_ingredients',
	'prepped_meals',
	'pantry_items',
	'meal_logs',
	'portion_events'
] as const;

async function mockBackend(page: Page): Promise<MockDb> {
	const date = todayISO();
	const db: MockDb = {
		meal_plans: [],
		planned_meals: [
			{
				id: 'pm-lunch',
				meal_plan_id: 'plan-1',
				date,
				meal_slot: 'LUNCH',
				source: 'PREPPED',
				recipe_id: null,
				recipe_title_snapshot: null,
				prepped_meal_id: 'prep-1',
				prepped_name_snapshot: 'Marinara pasta',
				store_bought_name: null,
				quick_meal_name: null,
				servings: 1,
				status: 'PLANNED',
				logged_at: null,
				sort_order: 0,
				created_at: '2026-01-01T00:00:00Z',
				updated_at: '2026-01-01T00:00:00Z'
			},
			{
				id: 'pm-dinner',
				meal_plan_id: 'plan-1',
				date,
				meal_slot: 'DINNER',
				source: 'RECIPE',
				recipe_id: 'recipe-1',
				recipe_title_snapshot: 'Sheet-pan salmon',
				prepped_meal_id: null,
				prepped_name_snapshot: null,
				store_bought_name: null,
				quick_meal_name: null,
				servings: 2,
				status: 'PLANNED',
				logged_at: null,
				sort_order: 0,
				created_at: '2026-01-01T00:00:00Z',
				updated_at: '2026-01-01T00:00:00Z'
			}
		],
		recipes: [],
		recipe_ingredients: [],
		prepped_meals: [
			{
				id: 'prep-1',
				owner_id: USER_ID,
				household_id: null,
				origin: 'DIRECT_ENTRY',
				name: 'Marinara pasta',
				recipe_id: null,
				recipe_name: null,
				meal_prep_session_id: null,
				portions_remaining: 3,
				original_portions: 3,
				storage_location: 'FRIDGE',
				container_label: null,
				prepared_date: date,
				expiration_date: '2099-01-01',
				defrost_state: 'NOT_APPLICABLE',
				defrost_started_at: null,
				estimated_ready_at: null,
				photo_url: null,
				created_at: '2026-01-01T00:00:00Z',
				updated_at: '2026-01-01T00:00:00Z'
			}
		],
		pantry_items: [],
		meal_logs: [],
		portion_events: []
	};
	let idCounter = 0;
	const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

	await page.route(/auth\/v1\/(signup|token|user)/, (route) => {
		if (route.request().url().includes('/user')) {
			return fulfillJson(route, makeSession().user);
		}
		return fulfillJson(route, makeSession());
	});

	await page.route(new RegExp(`rest/v1/(${TABLES.join('|')})(\\?|$)`), async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const table = url.pathname.split('/').pop() as keyof MockDb;
		const rows = db[table];
		const method = request.method();
		const matches = rowPredicate(url);

		if (method === 'GET') {
			const result = applyOrderLimit(rows.filter(matches), url);
			return fulfillJson(route, wantsSingleObject(route) ? (result[0] ?? null) : result);
		}

		if (method === 'POST') {
			const body = request.postDataJSON() as Row;
			const nowISO = new Date().toISOString();
			const created: Row = {
				owner_id: USER_ID,
				household_id: null,
				planned_meal_id: null,
				recipe_id: null,
				prepped_meal_id: null,
				name_snapshot: null,
				meal_slot: null,
				servings: 1,
				logged_at: nowISO,
				verdict: null,
				notes: null,
				triggered_by: null,
				created_at: nowISO,
				updated_at: nowISO,
				...body,
				id: nextId(table)
			};
			rows.push(created);
			// Trigger semantics from 0004: a portion event syncs the parent's count.
			if (table === 'portion_events') {
				const parent = db.prepped_meals.find((p) => p.id === created.prepped_meal_id);
				if (parent) {
					parent.portions_remaining =
						Number(parent.portions_remaining) + Number(created.delta_portions);
				}
			}
			return fulfillJson(route, wantsSingleObject(route) ? created : [created], 201);
		}

		if (method === 'PATCH') {
			const body = request.postDataJSON() as Row;
			const targets = rows.filter(matches);
			for (const target of targets) Object.assign(target, body);
			return fulfillJson(route, wantsSingleObject(route) ? (targets[0] ?? null) : targets);
		}

		if (method === 'DELETE') {
			db[table] = rows.filter((r) => !matches(r)) as MockDb[typeof table];
			return fulfillJson(route, []);
		}

		return fulfillJson(route, []);
	});

	return db;
}

async function gotoToday(page: Page) {
	await page.goto('/today');
	await expect(
		page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })
	).toBeVisible();
}

test.describe('Today — dashboard shell (FR-TL-001..008)', () => {
	test('root redirects to /today and the shell renders without errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));
		await mockBackend(page);
		await signIn(page);

		await page.goto('/');
		await page.waitForURL(/\/today$/);
		await expect(
			page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })
		).toBeVisible();

		// Coverage card + both meal cards + quick actions
		await expect(page.getByLabel('Day coverage')).toBeVisible();
		await expect(page.getByRole('article', { name: 'Lunch: Marinara pasta' })).toBeVisible();
		await expect(page.getByRole('article', { name: 'Dinner: Sheet-pan salmon' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Plan the week' })).toBeVisible();

		const unexpected = errors.filter((e) => !/supabase|fetch|network/i.test(e));
		expect(unexpected).toEqual([]);
	});

	test('a MUST_ACQUIRE meal offers Add to list, not Log it (FR-TL-004)', async ({ page }) => {
		await mockBackend(page);
		await signIn(page);
		await gotoToday(page);

		const dinner = page.getByRole('article', { name: 'Dinner: Sheet-pan salmon' });
		await expect(dinner.getByRole('link', { name: 'Add to list' })).toBeVisible();
		await expect(dinner.getByRole('button', { name: 'Log it' })).toBeHidden();
	});
});

test.describe('Today — one-tap logging (FR-TL-009..014)', () => {
	test('logs the prepped lunch in one tap: eaten state, plan flip, portion draw-down', async ({
		page
	}) => {
		const db = await mockBackend(page);
		await signIn(page);
		await gotoToday(page);

		const lunch = page.getByRole('article', { name: 'Lunch: Marinara pasta' });
		await expect(lunch.getByText('Prepped · 3 left')).toBeVisible();
		await lunch.getByRole('button', { name: 'Log it' }).click();

		// Optimistic eaten state + inline verdict prompt
		await expect(lunch.getByText(/Eaten · /)).toBeVisible();
		await expect(lunch.getByText('How was it?')).toBeVisible();

		// Server truth: one FROM_PLAN log, plan flipped, ledger drew down one portion
		await expect.poll(() => db.meal_logs.length).toBe(1);
		expect(db.meal_logs[0].log_type).toBe('FROM_PLAN');
		expect(db.meal_logs[0].planned_meal_id).toBe('pm-lunch');
		await expect.poll(() => db.planned_meals[0].status).toBe('LOGGED');
		expect(db.planned_meals[0].logged_at).not.toBeNull();
		await expect.poll(() => db.portion_events.length).toBe(1);
		expect(db.portion_events[0].kind).toBe('CONSUMED');
		expect(db.portion_events[0].triggered_by).toBe(db.meal_logs[0].id);
		expect(db.prepped_meals[0].portions_remaining).toBe(2);
	});

	test('quick "I ate something" logs with zero detail (REQ-MR-009)', async ({ page }) => {
		const db = await mockBackend(page);
		await signIn(page);
		await gotoToday(page);

		await page.getByRole('button', { name: 'Log a meal' }).first().click();
		const sheet = page.getByRole('dialog', { name: 'Log a meal' });
		await expect(sheet).toBeVisible();
		await sheet.getByRole('button', { name: /I ate something/ }).click();
		await expect(sheet).toBeHidden();

		await expect.poll(() => db.meal_logs.length).toBe(1);
		expect(db.meal_logs[0].log_type).toBe('QUICK_LOG');
		expect(db.meal_logs[0].name_snapshot).toBeNull();
		expect(db.meal_logs[0].verdict).toBeNull();
	});

	test('the sheet closes on Escape without logging anything', async ({ page }) => {
		const db = await mockBackend(page);
		await signIn(page);
		await gotoToday(page);

		await page.getByRole('button', { name: 'Log a meal' }).first().click();
		await expect(page.getByRole('dialog', { name: 'Log a meal' })).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog', { name: 'Log a meal' })).toBeHidden();
		expect(db.meal_logs).toHaveLength(0);
	});

	test('logging a prepped meal from the sheet consumes portions (FR-TL-012)', async ({ page }) => {
		const db = await mockBackend(page);
		await signIn(page);
		await gotoToday(page);

		await page.getByRole('button', { name: 'Log a meal' }).first().click();
		const sheet = page.getByRole('dialog', { name: 'Log a meal' });
		await sheet.getByRole('button', { name: /Marinara pasta/ }).click();
		await expect(sheet).toBeHidden();

		await expect.poll(() => db.meal_logs.length).toBe(1);
		expect(db.meal_logs[0].log_type).toBe('FROM_PREPPED');
		await expect.poll(() => db.prepped_meals[0].portions_remaining).toBe(2);
	});
});

test.describe('Today — verdicts (FR-TL-015..016)', () => {
	test('sets a verdict inline after logging, and can clear it again', async ({ page }) => {
		const db = await mockBackend(page);
		await signIn(page);
		await gotoToday(page);

		const lunch = page.getByRole('article', { name: 'Lunch: Marinara pasta' });
		await lunch.getByRole('button', { name: 'Log it' }).click();
		await expect.poll(() => db.meal_logs.length).toBe(1);

		await lunch.getByRole('button', { name: 'Again' }).click();
		await expect.poll(() => db.meal_logs[0].verdict).toBe('KEEP');
		await expect(lunch.getByText('Keeper')).toBeVisible();
	});

	test('logs survive a reload with the eaten state intact', async ({ page }) => {
		const db = await mockBackend(page);
		await signIn(page);
		await gotoToday(page);

		const lunch = page.getByRole('article', { name: 'Lunch: Marinara pasta' });
		await lunch.getByRole('button', { name: 'Log it' }).click();
		await expect.poll(() => db.meal_logs.length).toBe(1);
		await expect.poll(() => db.planned_meals[0].status).toBe('LOGGED');

		await page.reload();
		await expect(
			page.getByRole('article', { name: 'Lunch: Marinara pasta' }).getByText(/Eaten · /)
		).toBeVisible();
	});
});
