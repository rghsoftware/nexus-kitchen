import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import PantryItemCard from './PantryItemCard.svelte';
import type { PantryItem } from '$lib/pantry/types';

function makeItem(overrides: Partial<PantryItem> = {}): PantryItem {
	return {
		id: 'item-1',
		owner_id: 'user-1',
		household_id: null,
		ingredient_id: null,
		name: 'Flour',
		quantity: 2,
		unit: 'kg',
		storage_location: 'PANTRY',
		custom_location: null,
		barcode: null,
		purchase_date: null,
		expiration_date: null,
		opened_date: null,
		photo_url: null,
		thumbnail_url: null,
		minimum_quantity: null,
		created_at: '2026-06-09T00:00:00Z',
		updated_at: '2026-06-09T00:00:00Z',
		isRunningLow: false,
		isExpiringSoon: false,
		isExpired: false,
		...overrides
	};
}

describe('PantryItemCard', () => {
	it('renders item name and quantity', async () => {
		expect.hasAssertions();
		const { getByText } = render(PantryItemCard, { item: makeItem() });
		expect(getByText('Flour')).toBeTruthy();
		expect(getByText(/2/)).toBeTruthy();
	});

	it('shows photo when photo_url is set', async () => {
		expect.hasAssertions();
		const { container } = render(PantryItemCard, {
			item: makeItem({ photo_url: 'https://example.com/photo.jpg' })
		});
		const img = container.querySelector('img');
		expect(img).toBeTruthy();
		expect(img?.getAttribute('src')).toBe('https://example.com/photo.jpg');
	});

	it('shows placeholder when photo_url is null', async () => {
		expect.hasAssertions();
		const { container } = render(PantryItemCard, { item: makeItem({ photo_url: null }) });
		const img = container.querySelector('img');
		expect(img).toBeNull();
	});

	it('applies warning badge class when expiring soon', async () => {
		expect.hasAssertions();
		const { container } = render(PantryItemCard, {
			item: makeItem({
				expiration_date: new Date(Date.now() + 3 * 86_400_000).toISOString().split('T')[0],
				isExpiringSoon: true
			})
		});
		const badge = container.querySelector('.nk-badge--warning');
		expect(badge).toBeTruthy();
	});

	it('applies error badge class when expired', async () => {
		expect.hasAssertions();
		const { container } = render(PantryItemCard, {
			item: makeItem({
				expiration_date: '2020-01-01',
				isExpired: true
			})
		});
		const badge = container.querySelector('.nk-badge--error');
		expect(badge).toBeTruthy();
	});

	it('shows running-low badge when isRunningLow is true', async () => {
		expect.hasAssertions();
		const { container } = render(PantryItemCard, {
			item: makeItem({ isRunningLow: true, minimum_quantity: 1, quantity: 0.5 })
		});
		// Low badge should be present (class or text)
		const lowBadge =
			container.querySelector('.nk-badge--low') ?? container.querySelector('[data-low]');
		const lowText = container.textContent?.toLowerCase().includes('low');
		expect(lowBadge !== null || lowText).toBe(true);
	});

	it('calls onclick when clicked', async () => {
		expect.hasAssertions();
		let clicked = false;
		const { container } = render(PantryItemCard, {
			item: makeItem(),
			onclick: () => {
				clicked = true;
			}
		});
		const card = container.querySelector('[role="button"]') as HTMLElement;
		card?.click();
		expect(clicked).toBe(true);
	});
});
