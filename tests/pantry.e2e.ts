import { expect, test, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Pantry & Inventory — end-to-end UI shell tests.
//
// These run against the static SPA built with stub Supabase env (see
// playwright.config.ts). No live backend is involved: the pantry/prepped
// stores swallow load failures and render their empty states, so every
// assertion below is deterministic. We cover the shell, tab navigation,
// the add-item/add-meal dialogs, client-side validation, and the
// "must be signed in" guard — i.e. everything that does NOT require a
// real authenticated session.
// ---------------------------------------------------------------------------

const PANTRY_URL = '/pantry';

/** Navigate to the pantry tab and wait for the tablist to render. */
async function gotoPantry(page: Page) {
	// Resolve Supabase REST reads with an empty result set (rather than letting
	// them hang against the unreachable stub host). The loads succeed with zero
	// rows, so the stores render their empty states — what these specs assert.
	await page.route(/supabase\.co\/rest\//, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'content-range': '0-0/0' },
			body: '[]'
		})
	);
	await page.goto(PANTRY_URL);
	await expect(page.getByRole('tablist', { name: /pantry sections/i })).toBeVisible();
}

const FAB = (page: Page) => page.getByRole('button', { name: 'Add pantry item' });

test.describe('Pantry — shell & empty state', () => {
	test('renders all five section tabs', async ({ page }) => {
		await gotoPantry(page);
		for (const label of ['All', 'Fridge', 'Freezer', 'Pantry', 'Prepped']) {
			await expect(page.getByRole('tab', { name: label, exact: true })).toBeVisible();
		}
	});

	test('shows the empty pantry state and its CTA', async ({ page }) => {
		await gotoPantry(page);
		await expect(page.getByText(/your pantry is empty/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /add your first item/i })).toBeVisible();
	});

	test('loads without uncaught JS errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));
		await gotoPantry(page);
		// Allow expected network/Supabase failures (stub backend); fail on anything else.
		const unexpected = errors.filter((e) => !/supabase|fetch|network/i.test(e));
		expect(unexpected).toEqual([]);
	});
});

test.describe('Pantry — tab navigation', () => {
	test('selecting Fridge updates aria-selected', async ({ page }) => {
		await gotoPantry(page);
		const fridge = page.getByRole('tab', { name: 'Fridge', exact: true });
		await expect(fridge).toHaveAttribute('aria-selected', 'false');
		await fridge.click();
		await expect(fridge).toHaveAttribute('aria-selected', 'true');
		// "All" should no longer be selected.
		await expect(page.getByRole('tab', { name: 'All', exact: true })).toHaveAttribute(
			'aria-selected',
			'false'
		);
	});

	test('Fridge tab shows the fridge-specific empty state', async ({ page }) => {
		await gotoPantry(page);
		await page.getByRole('tab', { name: 'Fridge', exact: true }).click();
		await expect(page.getByText(/your fridge is empty/i)).toBeVisible();
	});

	test('the add FAB is hidden on the Prepped tab', async ({ page }) => {
		await gotoPantry(page);
		await expect(FAB(page)).toBeVisible();
		await page.getByRole('tab', { name: 'Prepped', exact: true }).click();
		await expect(FAB(page)).toBeHidden();
	});
});

test.describe('Pantry — add-item dialog', () => {
	test('FAB opens the add-item dialog and Cancel closes it', async ({ page }) => {
		await gotoPantry(page);
		await FAB(page).click();

		const dialog = page.getByRole('dialog', { name: /add or edit pantry item/i });
		await expect(dialog).toBeVisible();
		await expect(dialog.getByRole('heading', { name: /add to pantry/i })).toBeVisible();

		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(dialog).toBeHidden();
	});

	test('submitting an empty form shows a validation error and keeps the dialog open', async ({
		page
	}) => {
		await gotoPantry(page);
		await FAB(page).click();
		const dialog = page.getByRole('dialog', { name: /add or edit pantry item/i });

		// Submit with no name — client-side validation should block the save.
		await dialog.getByRole('button', { name: 'Add to pantry' }).click();

		await expect(dialog.getByText(/name is required/i)).toBeVisible();
		await expect(dialog).toBeVisible();
	});

	test('a filled form is blocked by the sign-in guard (no session)', async ({ page }) => {
		await gotoPantry(page);
		await FAB(page).click();
		const dialog = page.getByRole('dialog', { name: /add or edit pantry item/i });

		// Role-scoped to avoid matching the "…fill item name" barcode button.
		await dialog.getByRole('textbox', { name: 'Item name' }).fill('Oat milk');
		await dialog.getByRole('spinbutton', { name: 'Quantity' }).fill('2');
		await dialog.getByRole('button', { name: 'Add to pantry' }).click();

		// With no authenticated user the save is refused with a form-level alert,
		// and the dialog stays open so the entry isn't lost.
		await expect(dialog.getByText(/must be signed in/i)).toBeVisible();
		await expect(dialog).toBeVisible();
	});
});

test.describe('Pantry — prepped meals', () => {
	test('Prepped tab shows its empty state', async ({ page }) => {
		await gotoPantry(page);
		await page.getByRole('tab', { name: 'Prepped', exact: true }).click();
		await expect(page.getByText(/no prepped meals yet/i)).toBeVisible();
	});

	test('opens the add-prepped-meal dialog from the empty-state CTA', async ({ page }) => {
		await gotoPantry(page);
		await page.getByRole('tab', { name: 'Prepped', exact: true }).click();
		await page.getByRole('button', { name: /add a prepped meal/i }).click();
		await expect(page.getByRole('dialog', { name: /add or edit prepped meal/i })).toBeVisible();
	});
});
