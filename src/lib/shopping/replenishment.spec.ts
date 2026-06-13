import { describe, expect, it } from 'vitest';
import type { PantryItem, ShoppingListItem } from '$lib/pantry/types';
import { defaultAdditions, planReplenishment } from './replenishment';
import type { ShoppingItem } from './types';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function pantryRow(overrides: Partial<PantryItem> = {}): PantryItem {
	return {
		id: 'p-1',
		owner_id: 'user-1',
		household_id: null,
		ingredient_id: null,
		name: 'Onions',
		barcode: null,
		quantity: 2,
		unit: 'x',
		minimum_quantity: null,
		storage_location: 'PANTRY',
		custom_location: null,
		purchase_date: null,
		expiration_date: null,
		opened_date: null,
		photo_url: null,
		thumbnail_url: null,
		created_at: '',
		updated_at: '',
		...overrides
	} as PantryItem;
}

function purchased(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
	return { id: 'i-1', name: 'Onions', quantity: 4, unit: 'x', ...overrides };
}

function checkedItem(
	overrides: Partial<Omit<ShoppingItem, 'status' | 'checkedAt'>> & {
		status?: ShoppingItem['status'];
	} = {}
): ShoppingItem {
	const { status = 'CHECKED', ...rest } = overrides;
	const base = {
		id: 'it-1',
		shoppingListId: 'sl-1',
		name: 'Onions',
		quantity: 4,
		unit: 'x',
		category: 'PRODUCE' as const,
		neededFor: [],
		sourcePlannedMealId: null,
		sortOrder: 0,
		createdAt: '',
		updatedAt: '',
		...rest
	};
	// The union pairs CHECKED ⇔ checkedAt (INV-SH-003), so the fixture pairs too.
	return status === 'CHECKED'
		? { ...base, status, checkedAt: '2026-06-11T18:00:00Z' }
		: { ...base, status, checkedAt: null };
}

// ---------------------------------------------------------------------------
// planReplenishment (FR-SH-016, research R4)
// ---------------------------------------------------------------------------

describe('planReplenishment', () => {
	it('merges quantities when normalized name AND unit match', () => {
		const plan = planReplenishment(
			[purchased({ name: ' onions ', quantity: 4, unit: 'X' })],
			[pantryRow({ name: 'Onions', unit: 'x', quantity: 2 })]
		);
		expect(plan.merges).toEqual([{ pantryItemId: 'p-1', addQuantity: 4 }]);
		expect(plan.inserts).toHaveLength(0);
	});

	it('inserts a new row on unit mismatch — never invents unit math', () => {
		const plan = planReplenishment(
			[purchased({ unit: 'lb', quantity: 1 })],
			[pantryRow({ name: 'Onions', unit: 'x' })]
		);
		expect(plan.merges).toHaveLength(0);
		expect(plan.inserts).toEqual([
			{ name: 'Onions', quantity: 1, unit: 'lb', storage_location: 'PANTRY' }
		]);
	});

	it('combines duplicate purchases with each other (merges and inserts)', () => {
		const plan = planReplenishment(
			[
				purchased({ id: 'a', quantity: 2 }),
				purchased({ id: 'b', quantity: 3 }),
				purchased({ id: 'c', name: 'Coconut milk', unit: 'cans', quantity: 1 }),
				purchased({ id: 'd', name: 'coconut milk', unit: 'cans', quantity: 2 })
			],
			[pantryRow()]
		);
		expect(plan.merges).toEqual([{ pantryItemId: 'p-1', addQuantity: 5 }]);
		expect(plan.inserts).toEqual([
			{ name: 'Coconut milk', quantity: 3, unit: 'cans', storage_location: 'PANTRY' }
		]);
	});

	it('honors a chosen storage location and skips non-positive quantities', () => {
		const plan = planReplenishment(
			[
				purchased({ name: 'Frozen peas', storageLocation: 'FREEZER' }),
				purchased({ id: 'zero', name: 'Ghost', quantity: 0 })
			],
			[]
		);
		expect(plan.inserts).toEqual([
			{ name: 'Frozen peas', quantity: 4, unit: 'x', storage_location: 'FREEZER' }
		]);
	});
});

// ---------------------------------------------------------------------------
// defaultAdditions (FR-SH-018, research R5)
// ---------------------------------------------------------------------------

describe('defaultAdditions', () => {
	const NOW = Date.parse('2026-06-11T12:00:00Z');

	it('routes store-bought-generated items to portions with fridge + 3-day expiry', () => {
		const { pantry, portions } = defaultAdditions(
			[
				checkedItem({
					id: 'a',
					name: 'Rotisserie chicken',
					quantity: 2,
					sourcePlannedMealId: 'pm-1'
				}),
				checkedItem({ id: 'b', name: 'Onions' })
			],
			NOW
		);
		expect(portions).toEqual([
			{
				itemId: 'a',
				plannedMealId: 'pm-1',
				name: 'Rotisserie chicken',
				portions: 2,
				storageLocation: 'FRIDGE',
				expirationDate: '2026-06-14'
			}
		]);
		expect(pantry).toEqual([
			{ itemId: 'b', name: 'Onions', quantity: 4, unit: 'x', storageLocation: 'PANTRY' }
		]);
	});

	it('floors portions at 1 and ignores non-checked items', () => {
		const { pantry, portions } = defaultAdditions(
			[
				checkedItem({ id: 'a', quantity: 0.5, sourcePlannedMealId: 'pm-1' }),
				checkedItem({ id: 'b', status: 'PENDING' }),
				checkedItem({ id: 'c', status: 'UNAVAILABLE' })
			],
			NOW
		);
		expect(portions[0].portions).toBe(1);
		expect(pantry).toHaveLength(0);
		expect(portions).toHaveLength(1);
	});
});
