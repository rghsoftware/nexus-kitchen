import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MealPrepSessionForm from './MealPrepSessionForm.svelte';
import type { RecipeSummary } from '$lib/recipes';

// Mock the recipes module: only listRecipes is used by the form.
const listRecipes = vi.fn<() => Promise<RecipeSummary[]>>(async () => []);
vi.mock('$lib/recipes', () => ({
	recipesRepository: {
		listRecipes: () => listRecipes()
	}
}));

// Mock the store action so no network/service is touched.
const createSessionAction = vi.fn(async () => ({
	id: 'session-1',
	status: 'PLANNED' as const,
	prepDay: '2026-06-20',
	completedAt: null,
	recipes: []
}));
vi.mock('$lib/planning/mealPrep/mealPrepStore.svelte', () => ({
	createSessionAction: (...args: unknown[]) =>
		createSessionAction(...(args as Parameters<typeof createSessionAction>))
}));

function makeRecipe(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
	return {
		id: 'recipe-1',
		title: 'Chili',
		servings: 4,
		...overrides
	} as RecipeSummary;
}

describe('MealPrepSessionForm.svelte', () => {
	it('disables the submit button when no recipes are chosen', async () => {
		listRecipes.mockResolvedValueOnce([makeRecipe()]);
		render(MealPrepSessionForm, { onClose: () => {} });

		const submit = page.getByRole('button', { name: 'Plan this session' });
		await expect.element(submit).toBeDisabled();
	});

	it('shows a validation error for a prep day in the past', async () => {
		listRecipes.mockResolvedValueOnce([makeRecipe()]);
		render(MealPrepSessionForm, { onClose: () => {} });

		const dateInput = page.getByLabelText('When will you prep?');
		await dateInput.fill('2000-01-01');

		await expect.element(page.getByText('Pick today or a day in the future.')).toBeInTheDocument();
	});
});
