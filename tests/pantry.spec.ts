import { expect, test, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PANTRY_URL = '/pantry';

async function waitForPantryTab(page: Page) {
	await page.goto(PANTRY_URL);
	await page.waitForLoadState('networkidle');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Pantry – empty state', () => {
	test('shows empty state when no items', async ({ page }) => {
		await waitForPantryTab(page);
		// Either "empty" message or the add-item CTA should be visible
		const emptyOrAdd = page.locator('text=/empty|Add your first/i').first();
		await expect(emptyOrAdd).toBeVisible({ timeout: 5000 });
	});

	test('tab bar renders all five tabs', async ({ page }) => {
		await waitForPantryTab(page);
		for (const label of ['All', 'Fridge', 'Freezer', 'Pantry', 'Prepped']) {
			await expect(page.getByRole('tab', { name: label })).toBeVisible();
		}
	});
});

test.describe('Pantry – add item manually', () => {
	test('opens add form via FAB and saves a new item', async ({ page }) => {
		await waitForPantryTab(page);

		// Open the form
		await page.getByRole('button', { name: /add pantry item/i }).click();
		await expect(page.getByRole('dialog')).toBeVisible();

		// Fill in name and quantity
		await page.getByLabel(/name/i).fill('Oat milk');
		await page.getByLabel(/quantity/i).fill('2');

		// Save
		await page.getByRole('button', { name: /save/i }).click();

		// Form should close
		await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
	});
});

test.describe('Pantry – prepped meals tab', () => {
	test('switches to Prepped tab and shows empty state', async ({ page }) => {
		await waitForPantryTab(page);
		await page.getByRole('tab', { name: 'Prepped' }).click();
		const emptyOrAdd = page.locator('text=/No prepped meals|Add a prepped meal/i').first();
		await expect(emptyOrAdd).toBeVisible({ timeout: 3000 });
	});

	test('opens add prepped meal form', async ({ page }) => {
		await waitForPantryTab(page);
		await page.getByRole('tab', { name: 'Prepped' }).click();
		const addBtn = page.getByRole('button', { name: /Add a prepped meal/i }).first();
		await addBtn.click();
		await expect(page.getByRole('dialog')).toBeVisible();
	});
});

test.describe('Pantry – navigation', () => {
	test('Fridge tab filters to show fridge items label', async ({ page }) => {
		await waitForPantryTab(page);
		await page.getByRole('tab', { name: 'Fridge' }).click();
		// After switching, the active tab should be Fridge
		const fridgeTab = page.getByRole('tab', { name: 'Fridge' });
		await expect(fridgeTab).toHaveAttribute('aria-selected', 'true');
	});

	test('page renders without JS errors', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (err) => errors.push(err.message));
		await waitForPantryTab(page);
		expect(errors.filter((e) => !e.includes('PUBLIC_SUPABASE'))).toHaveLength(0);
	});
});
