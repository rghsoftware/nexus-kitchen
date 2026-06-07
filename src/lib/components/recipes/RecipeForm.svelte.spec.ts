import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RecipeForm from './RecipeForm.svelte';
import type { RecipeInput } from '$lib/recipes/types';

describe('RecipeForm.svelte', () => {
	it('does not submit when required fields are missing and shows guidance', async () => {
		const onSubmit = vi.fn(async () => {});
		render(RecipeForm, { onSubmit });

		// Defaults include one empty ingredient + one empty step, and no title → invalid.
		await page.getByRole('button', { name: 'Save recipe' }).click();

		expect(onSubmit).not.toHaveBeenCalled();
		await expect
			.element(page.getByText('Give your recipe a title so you can find it later.'))
			.toBeInTheDocument();
	});

	it('submits a valid recipe with the expected shape', async () => {
		let received: RecipeInput | null = null;
		const onSubmit = vi.fn(async (input: RecipeInput) => {
			received = input;
		});
		render(RecipeForm, { onSubmit });

		await page.getByLabelText('Title').fill('Weeknight Curry');
		await page.getByLabelText('Name for ingredient 1').fill('chicken thighs');
		await page.getByLabelText('Unit for ingredient 1').fill('lb');
		await page.getByLabelText('Quantity for ingredient 1').fill('2');
		await page.getByLabelText('Instruction for step 1').fill('Simmer everything together.');

		await page.getByRole('button', { name: 'Save recipe' }).click();

		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(received).not.toBeNull();
		const input = received as unknown as RecipeInput;
		expect(input.title).toBe('Weeknight Curry');
		expect(input.servings).toBe(4);
		expect(input.ingredients).toHaveLength(1);
		expect(input.ingredients[0]).toMatchObject({
			name: 'chicken thighs',
			unit: 'lb',
			quantity: 2,
			sortOrder: 0
		});
		expect(input.steps).toHaveLength(1);
		expect(input.steps[0]).toMatchObject({
			instruction: 'Simmer everything together.',
			sortOrder: 0
		});
	});

	it('rejects an invalid quantity (INV-RC-005)', async () => {
		const onSubmit = vi.fn(async () => {});
		render(RecipeForm, { onSubmit });

		await page.getByLabelText('Title').fill('Bad Recipe');
		await page.getByLabelText('Name for ingredient 1').fill('flour');
		await page.getByLabelText('Unit for ingredient 1').fill('cup');
		await page.getByLabelText('Quantity for ingredient 1').fill('0');
		await page.getByLabelText('Instruction for step 1').fill('Mix.');

		await page.getByRole('button', { name: 'Save recipe' }).click();

		expect(onSubmit).not.toHaveBeenCalled();
		await expect
			.element(page.getByText('Quantity should be greater than zero.'))
			.toBeInTheDocument();
	});
});
