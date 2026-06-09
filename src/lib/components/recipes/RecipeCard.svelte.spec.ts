import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RecipeCard from './RecipeCard.svelte';
import type { RecipeSummary } from '$lib/recipes/types';

function summary(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
	return {
		id: 'r1',
		ownerId: 'u1',
		householdId: null,
		title: 'Chicken Curry',
		description: null,
		servings: 4,
		prepTimeMinutes: 15,
		cookTimeMinutes: 30,
		activeTimeMinutes: null,
		totalTimeMinutes: 45,
		cuisineType: 'Indian',
		mealTypes: ['dinner'],
		notes: null,
		imageUrl: null,
		sourceUrl: null,
		nutritionPerServing: null,
		nutritionSource: 'MANUAL',
		createdAt: '2026-06-07T00:00:00Z',
		updatedAt: '2026-06-07T00:00:00Z',
		meta: null,
		tags: [],
		...overrides
	};
}

describe('RecipeCard.svelte', () => {
	it('renders the title, total time, and a link to the detail page', async () => {
		render(RecipeCard, { recipe: summary() });
		await expect.element(page.getByRole('heading', { name: 'Chicken Curry' })).toBeInTheDocument();
		await expect.element(page.getByText('45 min')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Chicken Curry' }))
			.toHaveAttribute('href', '/recipes/r1');
	});

	it('shows a favorite indicator when favorited', async () => {
		render(RecipeCard, {
			recipe: summary({
				meta: {
					id: 'm1',
					userId: 'u1',
					recipeId: 'r1',
					isFavorite: true,
					rating: 4,
					timesCooked: 0,
					lastCookedAt: null
				}
			})
		});
		await expect.element(page.getByLabelText('Favorite')).toBeInTheDocument();
	});

	it('falls back to a food tile glyph when there is no image (no emoji)', async () => {
		render(RecipeCard, { recipe: summary({ title: 'Tomato Soup', imageUrl: null }) });
		// Initial letter used as the glyph.
		await expect.element(page.getByText('T', { exact: true })).toBeInTheDocument();
	});
});
