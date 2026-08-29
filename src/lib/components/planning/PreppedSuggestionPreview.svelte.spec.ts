import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import PreppedSuggestionPreview from './PreppedSuggestionPreview.svelte';
import type { PreppedMeal } from '$lib/pantry/types';

function makePortion(overrides: Partial<PreppedMeal> = {}): PreppedMeal {
	return {
		id: 'pp-1',
		owner_id: 'user-1',
		household_id: null,
		origin: 'PREP_SESSION',
		name: 'Chili',
		recipe_id: 'r-1',
		recipe_name: 'Chili',
		meal_prep_session_id: 'mps-1',
		portions_remaining: 3,
		original_portions: 3,
		storage_location: 'FREEZER',
		container_label: null,
		prepared_date: '2026-06-13',
		expiration_date: '2026-06-20',
		defrost_state: 'FROZEN',
		defrost_started_at: null,
		estimated_ready_at: null,
		photo_url: null,
		created_at: '2026-06-13T00:00:00Z',
		updated_at: '2026-06-13T00:00:00Z',
		isExpiringSoon: false,
		isExpired: false,
		isReadyToEat: false,
		...overrides
	};
}

describe('PreppedSuggestionPreview (REQ-PP-025/026)', () => {
	it('renders prepped portions with name and an expiry indicator', async () => {
		expect.hasAssertions();
		const { getByText } = render(PreppedSuggestionPreview, {
			portions: [makePortion({ isExpiringSoon: true })]
		});
		expect(getByText('Chili')).toBeTruthy();
		expect(getByText(/3 portions/)).toBeTruthy();
		expect(getByText(/Eat by/)).toBeTruthy();
	});

	it('is non-forcing: it renders no buttons or selection controls', async () => {
		expect.hasAssertions();
		const { container } = render(PreppedSuggestionPreview, { portions: [makePortion()] });
		// A passive suggestion surface never auto-selects or offers an action (REQ-PP-026).
		expect(container.querySelectorAll('button').length).toBe(0);
		expect(container.querySelectorAll('input').length).toBe(0);
	});

	it('renders nothing when there is no prepped inventory', async () => {
		expect.hasAssertions();
		const { container } = render(PreppedSuggestionPreview, { portions: [] });
		expect(container.querySelector('section')).toBeNull();
	});
});
