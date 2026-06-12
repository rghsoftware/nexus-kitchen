import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import IngredientEditor from './IngredientEditor.svelte';
import type { RecipeIngredientInput } from '$lib/recipes/types';

function makeIngredient(
	name: string,
	sortOrder: number,
	extra?: Partial<RecipeIngredientInput>
): RecipeIngredientInput {
	return {
		uid: crypto.randomUUID(),
		name,
		quantity: 1,
		unit: 'cup',
		preparation: '',
		isOptional: false,
		sortOrder,
		...extra
	};
}

describe('IngredientEditor.svelte — substitute picker', () => {
	it('picker disabled with one ingredient', async () => {
		const ingredients: RecipeIngredientInput[] = [makeIngredient('Flour', 0)];
		render(IngredientEditor, { ingredients });

		await expect
			.element(page.getByRole('combobox', { name: 'Substitute for ingredient 1' }))
			.toBeDisabled();
	});

	it('picker enabled with two ingredients', async () => {
		const ingredients: RecipeIngredientInput[] = [
			makeIngredient('Flour', 0),
			makeIngredient('Butter', 1)
		];
		render(IngredientEditor, { ingredients });

		await expect
			.element(page.getByRole('combobox', { name: 'Substitute for ingredient 1' }))
			.not.toBeDisabled();
	});

	it('options list includes siblings but excludes self', async () => {
		const ingredients: RecipeIngredientInput[] = [
			makeIngredient('Flour', 0),
			makeIngredient('Butter', 1),
			makeIngredient('Eggs', 2)
		];
		render(IngredientEditor, { ingredients });

		const select = page.getByRole('combobox', { name: 'Substitute for ingredient 1' });
		// Siblings appear as options
		await expect.element(select.getByRole('option', { name: 'Butter' })).toBeInTheDocument();
		await expect.element(select.getByRole('option', { name: 'Eggs' })).toBeInTheDocument();
		// Self must not appear — neither by name nor by fallback label "Ingredient 1"
		await expect.element(select.getByRole('option', { name: 'Flour' })).not.toBeInTheDocument();
		await expect
			.element(select.getByRole('option', { name: 'Ingredient 1' }))
			.not.toBeInTheDocument();
	});

	it('selecting a sibling sets substituteForIndex on the row', async () => {
		const ingredients: RecipeIngredientInput[] = [
			makeIngredient('Flour', 0),
			makeIngredient('Butter', 1)
		];
		render(IngredientEditor, { ingredients });

		// Select "Flour" (index 0) as the substitute for ingredient 2
		const select = page.getByRole('combobox', { name: 'Substitute for ingredient 2' });
		await select.selectOptions('0');

		// The select's value should now reflect the chosen index
		await expect.element(select).toHaveValue('0');
	});

	it('selecting None clears substituteForIndex on the row', async () => {
		const ingredients: RecipeIngredientInput[] = [
			makeIngredient('Flour', 0),
			makeIngredient('Butter', 1, { substituteForIndex: 0 })
		];
		render(IngredientEditor, { ingredients });

		const select = page.getByRole('combobox', { name: 'Substitute for ingredient 2' });
		// Confirm it starts selected
		await expect.element(select).toHaveValue('0');

		await select.selectOptions('');

		await expect.element(select).toHaveValue('');
	});

	it('removeIngredient for target nulls dependent substituteForIndex (regression)', async () => {
		// B.substituteForIndex = 0 (points at A). Remove A → B's ref must become null (value "").
		const ingredients: RecipeIngredientInput[] = [
			makeIngredient('Ingredient A', 0),
			makeIngredient('Ingredient B', 1, { substituteForIndex: 0 })
		];
		render(IngredientEditor, { ingredients });

		// Remove ingredient 1 (A, index 0)
		await page.getByRole('button', { name: 'Remove ingredient 1' }).click();

		// After removal only one ingredient row remains; the picker is now disabled (1 ingredient)
		// and its value should be "" (null) — not the stale "0"
		const select = page.getByRole('combobox', { name: 'Substitute for ingredient 1' });
		await expect.element(select).toBeDisabled();
		await expect.element(select).toHaveValue('');
	});

	it('removeIngredient for non-target decrements substituteForIndex', async () => {
		// C.substituteForIndex = 1 (points at B, index 1). Remove A (index 0).
		// B shifts to index 0, so C.substituteForIndex must become 0.
		const ingredients: RecipeIngredientInput[] = [
			makeIngredient('Ingredient A', 0),
			makeIngredient('Ingredient B', 1),
			makeIngredient('Ingredient C', 2, { substituteForIndex: 1 })
		];
		render(IngredientEditor, { ingredients });

		// Remove ingredient 1 (A)
		await page.getByRole('button', { name: 'Remove ingredient 1' }).click();

		// C is now row 2 ("ingredient 2" after A removed). Its select should show "0" (B, now index 0).
		const select = page.getByRole('combobox', { name: 'Substitute for ingredient 2' });
		await expect.element(select).toHaveValue('0');
	});

	it('move() updates substituteForIndex when swapping the target ingredient (regression)', async () => {
		// B.substituteForIndex = 0 (points at A, index 0). Move A down (swap A↔B).
		// A becomes index 1, B becomes index 0. B's substituteForIndex must update from 0 → 1.
		const ingredients: RecipeIngredientInput[] = [
			makeIngredient('Ingredient A', 0),
			makeIngredient('Ingredient B', 1, { substituteForIndex: 0 })
		];
		render(IngredientEditor, { ingredients });

		// Move ingredient 1 (A) down
		await page.getByRole('button', { name: 'Move ingredient 1 down' }).click();

		// B is now row 1; its select should reference index 1 (A's new position)
		const select = page.getByRole('combobox', { name: 'Substitute for ingredient 1' });
		await expect.element(select).toHaveValue('1');
	});
});
