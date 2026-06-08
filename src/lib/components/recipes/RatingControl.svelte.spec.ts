import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RatingControl from './RatingControl.svelte';

describe('RatingControl.svelte', () => {
	it('renders five rating options (INV-RC-009 range)', async () => {
		render(RatingControl, { rating: null });
		for (const v of [1, 2, 3, 4, 5]) {
			await expect.element(page.getByRole('button', { name: `${v} out of 5` })).toBeInTheDocument();
		}
	});

	it('calls onChange with the chosen value', async () => {
		const onChange = vi.fn();
		render(RatingControl, { rating: null, onChange });
		await page.getByRole('button', { name: '4 out of 5' }).click();
		expect(onChange).toHaveBeenCalledWith(4);
	});

	it('clears the rating when the current value is tapped again', async () => {
		const onChange = vi.fn();
		render(RatingControl, { rating: 3, onChange });
		await page.getByRole('button', { name: '3 out of 5' }).click();
		expect(onChange).toHaveBeenCalledWith(null);
	});

	it('disables the controls when readonly (so onChange cannot fire)', async () => {
		const onChange = vi.fn();
		render(RatingControl, { rating: 2, readonly: true, onChange });
		// Readonly renders disabled buttons; a disabled button can't be clicked, so onChange
		// can never fire. Assert the disabled state rather than attempting a (blocked) click.
		await expect.element(page.getByRole('button', { name: '5 out of 5' })).toBeDisabled();
		expect(onChange).not.toHaveBeenCalled();
	});
});
