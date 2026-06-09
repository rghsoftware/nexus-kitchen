import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ServingScaler from './ServingScaler.svelte';

// NOTE: ServingScaler has a prop named `target`, which collides with a Svelte mount option,
// so props must be nested under `props` (otherwise `target` is read as the mount target).
describe('ServingScaler.svelte', () => {
	it('shows the current target serving count', async () => {
		render(ServingScaler, { props: { baseServings: 4, target: 4 } });
		await expect.element(page.getByText('4', { exact: true })).toBeInTheDocument();
	});

	it('disables the decrement at the minimum of 1', async () => {
		render(ServingScaler, { props: { baseServings: 4, target: 1 } });
		await expect.element(page.getByRole('button', { name: 'Fewer servings' })).toBeDisabled();
	});

	it('offers a reset when the target differs from the base', async () => {
		render(ServingScaler, { props: { baseServings: 4, target: 8 } });
		await expect.element(page.getByRole('button', { name: /Reset to 4/ })).toBeInTheDocument();
	});

	it('does not offer a reset when target equals base', async () => {
		render(ServingScaler, { props: { baseServings: 4, target: 4 } });
		await expect.element(page.getByRole('button', { name: /Reset/ })).not.toBeInTheDocument();
	});

	it('increments the count when "More servings" is clicked', async () => {
		render(ServingScaler, { props: { baseServings: 4, target: 4 } });
		await page.getByRole('button', { name: 'More servings' }).click();
		await expect.element(page.getByText('5', { exact: true })).toBeInTheDocument();
	});

	it('decrements the count when "Fewer servings" is clicked', async () => {
		render(ServingScaler, { props: { baseServings: 4, target: 4 } });
		await page.getByRole('button', { name: 'More servings' }).click();
		await page.getByRole('button', { name: 'Fewer servings' }).click();
		await expect.element(page.getByText('4', { exact: true })).toBeInTheDocument();
	});

	it('disables "More servings" at the maximum of 100', async () => {
		render(ServingScaler, { props: { baseServings: 100, target: 100 } });
		await expect.element(page.getByRole('button', { name: 'More servings' })).toBeDisabled();
	});

	it('resets to base when the Reset button is clicked', async () => {
		render(ServingScaler, { props: { baseServings: 4, target: 8 } });
		await page.getByRole('button', { name: /Reset to 4/ }).click();
		await expect.element(page.getByText('4', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Reset/ })).not.toBeInTheDocument();
	});

	it('clamps at minimum of 1 — decrement does nothing below 1', async () => {
		render(ServingScaler, { props: { baseServings: 1, target: 1 } });
		await expect.element(page.getByRole('button', { name: 'Fewer servings' })).toBeDisabled();
		await expect.element(page.getByText('1', { exact: true })).toBeInTheDocument();
	});
});
