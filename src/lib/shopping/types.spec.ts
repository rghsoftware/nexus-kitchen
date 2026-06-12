import { describe, expect, it } from 'vitest';
import { itemStatusPayload, storeBoughtConversionPayload } from './shoppingService';
import {
	parseNeededFor,
	toItemInsert,
	toShoppingItem,
	toShoppingList,
	type ShoppingItemRow,
	type ShoppingListRow
} from './types';

function listRow(overrides: Partial<ShoppingListRow> = {}): ShoppingListRow {
	return {
		id: 'sl-1',
		owner_id: 'user-1',
		household_id: null,
		name: 'Weekly shopping',
		source_type: 'MANUAL',
		generated_range_start: null,
		generated_range_end: null,
		status: 'ACTIVE',
		completed_at: null,
		created_at: '2026-06-11T00:00:00Z',
		updated_at: '2026-06-11T00:00:00Z',
		...overrides
	};
}

function itemRow(overrides: Partial<ShoppingItemRow> = {}): ShoppingItemRow {
	return {
		id: 'it-1',
		shopping_list_id: 'sl-1',
		ingredient_id: null,
		name: 'Onions',
		quantity: 4,
		unit: 'x',
		category: 'PRODUCE',
		needed_for: [],
		source_planned_meal_id: null,
		status: 'PENDING',
		checked_at: null,
		checked_by_user_id: null,
		sort_order: 0,
		created_at: '2026-06-11T00:00:00Z',
		updated_at: '2026-06-11T00:00:00Z',
		...overrides
	};
}

describe('toShoppingList', () => {
	it('maps snake_case rows to camelCase, including generation range', () => {
		const list = toShoppingList(
			listRow({
				source_type: 'FROM_PLAN',
				generated_range_start: '2026-06-11',
				generated_range_end: '2026-06-17'
			})
		);
		expect(list.sourceType).toBe('FROM_PLAN');
		expect(list.generatedRangeStart).toBe('2026-06-11');
		expect(list.generatedRangeEnd).toBe('2026-06-17');
		expect(list.completedAt).toBeNull();
	});
});

describe('toShoppingItem / parseNeededFor', () => {
	it('coerces numeric quantity and parses attribution entries', () => {
		const item = toShoppingItem(
			itemRow({
				quantity: '2.5' as unknown as number, // PostgREST numerics can arrive as strings
				needed_for: [
					{ recipeId: 'r-1', title: 'Marinara' },
					{ recipeId: null, title: 'Soup' }
				]
			})
		);
		expect(item.quantity).toBe(2.5);
		expect(item.neededFor).toEqual([
			{ recipeId: 'r-1', title: 'Marinara' },
			{ recipeId: null, title: 'Soup' }
		]);
	});

	it('drops malformed needed_for entries instead of crashing', () => {
		expect(parseNeededFor('not-an-array')).toEqual([]);
		expect(parseNeededFor([{ title: '' }, { recipeId: 'r-1' }, 42, null, { title: 'Ok' }])).toEqual(
			[{ recipeId: null, title: 'Ok' }]
		);
	});
});

describe('toItemInsert', () => {
	it('serializes attribution and defaults optional fields', () => {
		const insert = toItemInsert('sl-9', {
			name: 'Crushed tomatoes',
			quantity: 2,
			unit: 'cans',
			category: 'CANNED',
			neededFor: [{ recipeId: 'r-1', title: 'Marinara' }]
		});
		expect(insert.shopping_list_id).toBe('sl-9');
		expect(insert.needed_for).toEqual([{ recipeId: 'r-1', title: 'Marinara' }]);
		expect(insert.source_planned_meal_id).toBeNull();
		expect(insert.sort_order).toBe(0);
	});
});

describe('itemStatusPayload (INV-SH-003 pairing)', () => {
	it('stamps checked_at when checking', () => {
		const payload = itemStatusPayload('CHECKED', '2026-06-11T18:00:00Z');
		expect(payload).toEqual({ status: 'CHECKED', checked_at: '2026-06-11T18:00:00Z' });
	});

	it('clears checked_at for every non-CHECKED status', () => {
		expect(itemStatusPayload('PENDING').checked_at).toBeNull();
		expect(itemStatusPayload('UNAVAILABLE').checked_at).toBeNull();
		expect(itemStatusPayload('REMOVED').checked_at).toBeNull();
	});
});

describe('storeBoughtConversionPayload (FR-SH-018, INV-PL-003)', () => {
	it('satisfies the exactly-one-source PREPPED arm in a single write', () => {
		const payload = storeBoughtConversionPayload('pp-1', 'Rotisserie chicken');
		// PREPPED arm requires the snapshot and forbids store_bought_name (0006 CHECK).
		expect(payload.source).toBe('PREPPED');
		expect(payload.prepped_meal_id).toBe('pp-1');
		expect(payload.prepped_name_snapshot).toBe('Rotisserie chicken');
		expect(payload.store_bought_name).toBeNull();
	});
});
