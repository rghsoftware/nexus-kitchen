import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import PreppedMealCard from './PreppedMealCard.svelte';
import type { PreppedMeal } from '$lib/pantry/types';

function makeMeal(overrides: Partial<PreppedMeal> = {}): PreppedMeal {
	return {
		id: 'meal-1',
		owner_id: 'user-1',
		household_id: null,
		origin: 'DIRECT_ENTRY',
		name: 'Chili',
		recipe_id: null,
		recipe_name: null,
		meal_prep_session_id: null,
		portions_remaining: 4,
		original_portions: 4,
		storage_location: 'FRIDGE',
		container_label: null,
		prepared_date: '2026-06-09',
		expiration_date: '2026-06-13',
		defrost_state: 'NOT_APPLICABLE',
		defrost_started_at: null,
		estimated_ready_at: null,
		photo_url: null,
		created_at: '2026-06-09T00:00:00Z',
		updated_at: '2026-06-09T00:00:00Z',
		isExpiringSoon: false,
		isExpired: false,
		isReadyToEat: true,
		...overrides
	};
}

describe('PreppedMealCard', () => {
	it('renders meal name and portions', async () => {
		expect.hasAssertions();
		const { getByText } = render(PreppedMealCard, { meal: makeMeal() });
		expect(getByText('Chili')).toBeTruthy();
		expect(getByText(/4/)).toBeTruthy();
	});

	it('shows "Made" badge for DIRECT_ENTRY origin', async () => {
		expect.hasAssertions();
		const { container } = render(PreppedMealCard, {
			meal: makeMeal({ origin: 'DIRECT_ENTRY' })
		});
		expect(container.textContent).toMatch(/Made/i);
	});

	it('shows "Bought" badge for STORE_BOUGHT origin', async () => {
		expect.hasAssertions();
		const { container } = render(PreppedMealCard, {
			meal: makeMeal({ origin: 'STORE_BOUGHT' })
		});
		expect(container.textContent).toMatch(/Bought/i);
	});

	it('shows Defrost button when FROZEN', async () => {
		expect.hasAssertions();
		const { container } = render(PreppedMealCard, {
			meal: makeMeal({ storage_location: 'FREEZER', defrost_state: 'FROZEN', isReadyToEat: false })
		});
		const buttons = Array.from(container.querySelectorAll('button'));
		const defrostBtn = buttons.find((b) => /defrost/i.test(b.textContent ?? ''));
		expect(defrostBtn).toBeTruthy();
	});

	it('shows Ready button and countdown when DEFROSTING', async () => {
		expect.hasAssertions();
		const estimatedReady = new Date(Date.now() + 10 * 3600 * 1000).toISOString();
		const { container } = render(PreppedMealCard, {
			meal: makeMeal({
				defrost_state: 'DEFROSTING',
				defrost_started_at: new Date().toISOString(),
				estimated_ready_at: estimatedReady,
				isReadyToEat: false
			})
		});
		const buttons = Array.from(container.querySelectorAll('button'));
		const readyBtn = buttons.find((b) => /ready/i.test(b.textContent ?? ''));
		expect(readyBtn).toBeTruthy();
	});

	it('disables Eat button when 0 portions remain', async () => {
		expect.hasAssertions();
		const { container } = render(PreppedMealCard, {
			meal: makeMeal({ portions_remaining: 0 })
		});
		const buttons = Array.from(container.querySelectorAll('button'));
		const eatBtn = buttons.find((b) => /eat/i.test(b.textContent ?? ''));
		expect(eatBtn?.disabled).toBe(true);
	});

	it('shows warning expiry style when isExpiringSoon', async () => {
		expect.hasAssertions();
		const { container } = render(PreppedMealCard, {
			meal: makeMeal({ isExpiringSoon: true })
		});
		const warning =
			container.querySelector('.nk-badge--warning') ??
			container.querySelector('[class*="warning"]');
		expect(warning).toBeTruthy();
	});

	it('calls onStartDefrost when Defrost button clicked', async () => {
		expect.hasAssertions();
		let called = false;
		const { container } = render(PreppedMealCard, {
			meal: makeMeal({ storage_location: 'FREEZER', defrost_state: 'FROZEN', isReadyToEat: false }),
			onStartDefrost: () => {
				called = true;
			}
		});
		const buttons = Array.from(container.querySelectorAll('button'));
		const defrostBtn = buttons.find((b) => /defrost/i.test(b.textContent ?? ''));
		defrostBtn?.click();
		expect(called).toBe(true);
	});
});
