import { expect, test, type Page, type Route } from '@playwright/test';
import { signIn } from './support/session';

// ---------------------------------------------------------------------------
// Planning — end-to-end calendar flows (SC-001..004).
//
// Runs against the static SPA built with stub Supabase env (see
// playwright.config.ts). Auth and PostgREST are mocked with a STATEFUL
// in-test backend (plain objects in the Node test process), so create /
// edit / move / remove flows behave like a real server — including
// page.reload() persistence — while staying fully deterministic.
// ---------------------------------------------------------------------------

interface Row {
	[key: string]: unknown;
	id: string;
}

interface MockDb {
	meal_plans: Row[];
	planned_meals: Row[];
	recipes: Row[];
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

function makeRecipeRow(): Row {
	return {
		id: 'recipe-1',
		owner_id: USER_ID,
		household_id: null,
		title: 'Chicken Stir Fry',
		description: null,
		servings: 2,
		prep_time_minutes: 10,
		cook_time_minutes: 15,
		active_time_minutes: null,
		total_time_minutes: 25,
		cuisine_type: null,
		meal_types: [],
		notes: null,
		image_url: null,
		source_url: null,
		nutrition_per_serving: null,
		nutrition_source: 'MANUAL',
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		user_recipe_meta: [],
		recipe_tags: []
	};
}

/** Parse PostgREST query filters (eq / gte / lte / is.null) into a row predicate. */
function rowPredicate(url: URL): (row: Row) => boolean {
	const checks: ((row: Row) => boolean)[] = [];
	for (const [key, raw] of url.searchParams.entries()) {
		if (key === 'select' || key === 'order' || key === 'limit') continue;
		const dot = raw.indexOf('.');
		if (dot === -1) continue;
		const op = raw.slice(0, dot);
		const value = raw.slice(dot + 1);
		if (op === 'eq') checks.push((row) => String(row[key]) === value);
		else if (op === 'gte') checks.push((row) => String(row[key]) >= value);
		else if (op === 'lte') checks.push((row) => String(row[key]) <= value);
		else if (op === 'is' && value === 'null') checks.push((row) => row[key] === null);
	}
	return (row) => checks.every((c) => c(row));
}

/** Apply PostgREST `order=` and `limit=` params. */
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
				if (av === null) return 1; // nullslast
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

/**
 * Stateful PostgREST + GoTrue mock. State lives in the Node test process, so it
 * survives page.reload() — letting the specs assert real persistence semantics.
 */
async function mockBackend(page: Page): Promise<MockDb> {
	const db: MockDb = { meal_plans: [], planned_meals: [], recipes: [makeRecipeRow()] };
	let idCounter = 0;
	const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

	// GoTrue: anonymous sign-in + user lookup
	await page.route(/auth\/v1\/(signup|token|user)/, (route) => {
		if (route.request().url().includes('/user')) {
			return fulfillJson(route, makeSession().user);
		}
		return fulfillJson(route, makeSession());
	});

	// PostgREST tables
	await page.route(/rest\/v1\/(meal_plans|planned_meals|recipes)(\?|$)/, async (route) => {
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
			// Upsert support for the implicit week plan (on_conflict=owner_id,start_date)
			if (table === 'meal_plans') {
				const existing = rows.find((r) => r.start_date === body.start_date);
				if (existing) return fulfillJson(route, wantsSingleObject(route) ? existing : [existing]);
			}
			const created: Row = {
				owner_id: USER_ID,
				household_id: null,
				name: null,
				status: 'PLANNED',
				logged_at: null,
				recipe_id: null,
				recipe_title_snapshot: null,
				prepped_meal_id: null,
				store_bought_name: null,
				quick_meal_name: null,
				meal_slot: null,
				created_at: '2026-01-01T00:00:00Z',
				updated_at: '2026-01-01T00:00:00Z',
				...body,
				id: nextId(table === 'meal_plans' ? 'plan' : 'meal')
			};
			rows.push(created);
			return fulfillJson(route, wantsSingleObject(route) ? created : [created], 201);
		}

		if (method === 'PATCH') {
			const body = request.postDataJSON() as Row;
			const target = rows.find(matches);
			if (!target) return fulfillJson(route, wantsSingleObject(route) ? null : [], 404);
			Object.assign(target, body);
			return fulfillJson(route, wantsSingleObject(route) ? target : [target]);
		}

		if (method === 'DELETE') {
			db[table] = rows.filter((r) => !matches(r)) as MockDb[typeof table];
			return fulfillJson(route, []);
		}

		return fulfillJson(route, []);
	});

	return db;
}

/** Open /plan in week view and wait for the calendar shell. */
async function gotoPlan(page: Page) {
	await page.goto('/plan');
	await expect(page.getByRole('group', { name: 'Calendar view' })).toBeVisible();
	const weekButton = page.getByRole('button', { name: 'Week', exact: true });
	await weekButton.click();
}

/** The visible "+ add" button for a (weekday, band) cell in the current week. */
function addButton(page: Page, band: RegExp) {
	return page.getByRole('button', { name: band }).first();
}

test.describe('Plan — calendar shell', () => {
	test('renders the week view with all slot bands and no uncaught errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));
		await mockBackend(page);
		await signIn(page);
		await gotoPlan(page);

		// One cell per (day, slot): 7 add affordances per band incl. the Anytime row.
		// Empty cells invite with a dashed "Add" — gaps without judgment (design readme).
		for (const band of ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Anytime']) {
			expect(
				await page.getByRole('button', { name: new RegExp(`^Add a meal to ${band} on `) }).count()
			).toBe(7);
		}
		await expect(page.getByRole('group', { name: 'Week planner' })).toBeVisible();

		const unexpected = errors.filter((e) => !/supabase|fetch|network/i.test(e));
		expect(unexpected).toEqual([]);
	});

	test('switches between day, week, and month views', async ({ page }) => {
		await mockBackend(page);
		await signIn(page);
		await gotoPlan(page);

		await page.getByRole('button', { name: 'Day', exact: true }).click();
		await expect(page.getByRole('heading', { level: 3 })).toContainText(/, /);

		await page.getByRole('button', { name: 'Month', exact: true }).click();
		await expect(page.getByLabel('Month grid')).toBeVisible();

		await page.getByRole('button', { name: 'Week', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
	});
});

test.describe('Plan — placing meals (SC-001, SC-002)', () => {
	test('plans a recipe, a store-bought, and a quick meal; multiple meals share a slot', async ({
		page
	}) => {
		const db = await mockBackend(page);
		await signIn(page);
		await gotoPlan(page);

		// 1. Recipe meal into Monday's Dinner
		await addButton(page, /^Add a meal to Dinner/).click();
		await expect(page.getByRole('dialog', { name: 'Add a meal' })).toBeVisible();
		await page.getByRole('button', { name: /Chicken Stir Fry/ }).click();
		await page.getByRole('button', { name: 'Add to plan' }).click();
		await expect(page.getByRole('dialog', { name: 'Add a meal' })).toBeHidden();
		await expect(page.getByRole('button', { name: /Chicken Stir Fry, Recipe/ })).toBeVisible();

		// 2. Store-bought meal ("a meal to acquire by buying", REQ-MP-011)
		await addButton(page, /^Add a meal to Dinner/).click();
		await page.getByRole('tab', { name: 'Store-bought' }).click();
		await page.getByLabel('What will you buy?').fill('Frozen lasagna');
		await page.getByRole('button', { name: 'Add to plan' }).click();
		await expect(page.getByRole('button', { name: /Frozen lasagna, To buy/ })).toBeVisible();

		// 3. Quick meal — one-tap option (FR-PL-021)
		await addButton(page, /^Add a meal to Lunch/).click();
		await page.getByRole('tab', { name: 'Quick' }).click();
		await page.getByRole('button', { name: 'Takeout', exact: true }).click();
		await expect(page.getByRole('button', { name: /Takeout, Quick/ })).toBeVisible();

		// Both dinner meals share the same band (slots are bands, not limits — REQ-MP-002).
		// Poll: the optimistic card shows before the POST lands in the mock backend.
		await expect.poll(() => db.planned_meals.length).toBe(3);
		const dinnerMeals = db.planned_meals.filter((m) => m.meal_slot === 'DINNER');
		expect(dinnerMeals).toHaveLength(2);
		expect(new Set(dinnerMeals.map((m) => m.sort_order)).size).toBe(2); // INV-PL-012

		// One implicit weekly plan was created and shared (FR-PL-011)
		expect(db.meal_plans).toHaveLength(1);
	});

	test('places an unslotted meal in the Anytime group', async ({ page }) => {
		const db = await mockBackend(page);
		await signIn(page);
		await gotoPlan(page);

		await addButton(page, /^Add a meal to Anytime/).click();
		await page.getByRole('tab', { name: 'Quick' }).click();
		await page.getByRole('button', { name: 'Leftovers', exact: true }).click();
		await expect(page.getByRole('button', { name: /Leftovers, Quick/ })).toBeVisible();
		await expect.poll(() => db.planned_meals.length).toBe(1);
		expect(db.planned_meals[0].meal_slot).toBeNull();
	});
});

test.describe('Plan — editing, moving, removing (SC-004)', () => {
	test('edits servings, tap-moves across days, and removes a meal', async ({ page }) => {
		const db = await mockBackend(page);
		await signIn(page);
		await gotoPlan(page);

		// Seed via the UI: quick meal in Monday's Dinner
		await addButton(page, /^Add a meal to Dinner/).click();
		await page.getByRole('tab', { name: 'Quick' }).click();
		await page.getByRole('button', { name: 'Takeout', exact: true }).click();
		const card = page.getByRole('button', { name: /Takeout, Quick/ });
		await expect(card).toBeVisible();
		await expect.poll(() => db.planned_meals.length).toBe(1);
		const originalDate = db.planned_meals[0].date as string;

		// Edit servings (FR-PL-012)
		await card.click();
		await expect(page.getByRole('dialog', { name: 'Meal details' })).toBeVisible();
		await page.getByLabel('Servings').fill('3');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Meal details' })).toBeHidden();
		await expect.poll(() => db.planned_meals[0].servings).toBe(3);

		// Tap-move to two days later (FR-PL-013/015 accessible path)
		await page.getByRole('button', { name: /Takeout, Quick/ }).click();
		await page.getByRole('button', { name: 'Move', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Move meal' })).toBeVisible();
		const targetDate = new Date(`${originalDate}T12:00:00Z`);
		targetDate.setUTCDate(targetDate.getUTCDate() + 2);
		const targetISO = targetDate.toISOString().slice(0, 10);
		await page.getByLabel('New day').fill(targetISO);
		await page.getByRole('button', { name: 'Move meal', exact: true }).click();
		await expect(page.getByRole('dialog', { name: 'Move meal' })).toBeHidden();
		await expect.poll(() => db.planned_meals[0]?.date).toBe(targetISO);
		await expect(page.getByRole('button', { name: /Takeout, Quick/ })).toBeVisible();

		// Remove with the single lightweight confirm (FR-PL-014)
		await page.getByRole('button', { name: /Takeout, Quick/ }).click();
		await page.getByRole('button', { name: 'Remove', exact: true }).click();
		await page.getByRole('button', { name: 'Really remove?' }).click();
		await expect(page.getByRole('dialog', { name: 'Meal details' })).toBeHidden();
		await expect(page.getByRole('button', { name: /Takeout, Quick/ })).toBeHidden();
		await expect.poll(() => db.planned_meals.length).toBe(0);
	});
});

test.describe('Plan — persistence (SC-003)', () => {
	test('planned meals survive a reload with details intact', async ({ page }) => {
		const db = await mockBackend(page);
		await signIn(page);
		await gotoPlan(page);

		await addButton(page, /^Add a meal to Breakfast/).click();
		await page.getByRole('tab', { name: 'Store-bought' }).click();
		await page.getByLabel('What will you buy?').fill('Overnight oats cup');
		await page.getByRole('button', { name: 'Add to plan' }).click();
		await expect(page.getByRole('button', { name: /Overnight oats cup, To buy/ })).toBeVisible();

		// The add renders optimistically; wait for the insert to land server-side
		// before reloading, or the reload aborts the in-flight write.
		await expect.poll(() => db.planned_meals.length).toBe(1);

		await page.reload();
		await expect(page.getByRole('group', { name: 'Calendar view' })).toBeVisible();
		await expect(page.getByRole('button', { name: /Overnight oats cup, To buy/ })).toBeVisible();
	});
});
