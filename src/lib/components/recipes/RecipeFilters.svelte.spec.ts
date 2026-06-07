import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RecipeFilters from './RecipeFilters.svelte';

describe('RecipeFilters.svelte', () => {
	it('renders the mode filters and reflects the active mode', async () => {
		render(RecipeFilters, { mode: 'favorites', activeTags: [], availableTags: [] });
		await expect.element(page.getByRole('button', { name: 'All' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Favorites' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: 'All' }))
			.toHaveAttribute('aria-pressed', 'false');
	});

	it('renders available tag chips', async () => {
		render(RecipeFilters, {
			mode: 'all',
			activeTags: ['vegetarian'],
			availableTags: ['vegetarian', 'quick']
		});
		await expect
			.element(page.getByRole('button', { name: 'vegetarian' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(page.getByRole('button', { name: 'quick' }))
			.toHaveAttribute('aria-pressed', 'false');
	});

	it('marks a filter active after it is clicked', async () => {
		render(RecipeFilters, { mode: 'all', activeTags: [], availableTags: [] });
		await page.getByRole('button', { name: 'Favorites' }).click();
		await expect
			.element(page.getByRole('button', { name: 'Favorites' }))
			.toHaveAttribute('aria-pressed', 'true');
	});
});
