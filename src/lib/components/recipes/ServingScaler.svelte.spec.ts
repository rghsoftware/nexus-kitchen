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
});
