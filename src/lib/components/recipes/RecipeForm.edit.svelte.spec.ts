import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RecipeForm from './RecipeForm.svelte';
import type { RecipeInput, RecipeWithDetail } from '$lib/recipes/types';

function existingRecipe(): RecipeWithDetail {
	return {
		id: 'r1',
		ownerId: 'u1',
		householdId: null,
		title: 'Old Title',
		description: 'desc',
		servings: 2,
		prepTimeMinutes: 10,
		cookTimeMinutes: 20,
		activeTimeMinutes: null,
		totalTimeMinutes: 30,
		cuisineType: 'Thai',
		mealTypes: ['dinner'],
		notes: null,
		imageUrl: null,
		sourceUrl: null,
		nutritionPerServing: null,
		nutritionSource: 'MANUAL',
		createdAt: '2026-06-07T00:00:00Z',
		updatedAt: '2026-06-07T00:00:00Z',
		ingredients: [
			{
				id: 'i1',
				recipeId: 'r1',
				ingredientId: null,
				name: 'rice',
				quantity: 1,
				unit: 'cup',
				preparation: null,
				isOptional: false,
				substituteFor: null,
				sortOrder: 0
			}
		],
		steps: [
			{
				id: 's1',
				recipeId: 'r1',
				instruction: 'Cook rice',
				durationMinutes: null,
				timerMinutes: null,
				timerLabel: null,
				imageUrl: null,
				sortOrder: 0
			}
		],
		tags: [{ id: 't1', recipeId: 'r1', name: 'easy', category: 'CUSTOM' }],
		meta: null
	};
}

describe('RecipeForm.svelte (edit mode)', () => {
	it('prefills fields from the initial recipe', async () => {
		render(RecipeForm, {
			initial: existingRecipe(),
			submitLabel: 'Save changes',
			onSubmit: vi.fn(async () => {})
		});
		await expect.element(page.getByLabelText('Title')).toHaveValue('Old Title');
		await expect.element(page.getByLabelText('Name for ingredient 1')).toHaveValue('rice');
		await expect.element(page.getByLabelText('Instruction for step 1')).toHaveValue('Cook rice');
		await expect.element(page.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
	});

	it('submits the edited values with sequential sort orders preserved', async () => {
		let received: RecipeInput | null = null;
		const onSubmit = vi.fn(async (input: RecipeInput) => {
			received = input;
		});
		render(RecipeForm, { initial: existingRecipe(), submitLabel: 'Save changes', onSubmit });

		await page.getByLabelText('Title').fill('New Title');
		await page.getByRole('button', { name: 'Save changes' }).click();

		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		const input = received as unknown as RecipeInput;
		expect(input.title).toBe('New Title');
		expect(input.ingredients[0].sortOrder).toBe(0);
		expect(input.steps[0].sortOrder).toBe(0);
		expect(input.tags).toEqual([{ name: 'easy', category: 'CUSTOM' }]);
	});
});
