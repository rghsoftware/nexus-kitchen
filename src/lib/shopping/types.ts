// Domain types for the shopping feature. CamelCase application shapes mapped from the
// snake_case database rows in `$lib/database.types`. The service layer returns these.
//
// Canonical shapes: Domain Specification §2.5 (Shopping Context); item state machine
// §5.3. Deferred fields (photos, assignment, online ordering, store layouts) are not
// modeled — see spec.md Assumptions.

import type { Enums, Tables, TablesInsert, TablesUpdate } from '$lib/database.types';
import type { ISODate } from '$lib/planning/types';

// Real Postgres enums — the generated types carry the exact unions.
export type ShoppingListSource = Enums<'shopping_list_source'>;
export type ShoppingListStatus = Enums<'shopping_list_status'>;
export type ShoppingItemStatus = Enums<'shopping_item_status'>;
export type ShoppingCategory = Enums<'shopping_category'>;

// Row/Insert aliases so the rest of the app never imports the generated file directly.
export type ShoppingListRow = Tables<'shopping_lists'>;
export type ShoppingItemRow = Tables<'shopping_list_items'>;
export type ShoppingListInsert = TablesInsert<'shopping_lists'>;
export type ShoppingItemInsert = TablesInsert<'shopping_list_items'>;
export type ShoppingListUpdate = TablesUpdate<'shopping_lists'>;
export type ShoppingItemUpdate = TablesUpdate<'shopping_list_items'>;

/** Display order of the fixed built-in categories (FR-SH-019) = enum order, Other last. */
export const SHOPPING_CATEGORIES: readonly ShoppingCategory[] = [
	'PRODUCE',
	'DAIRY',
	'MEAT_SEAFOOD',
	'CANNED',
	'FROZEN',
	'BAKERY',
	'PANTRY_STAPLES',
	'OTHER'
];

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
	PRODUCE: 'Produce',
	DAIRY: 'Dairy',
	MEAT_SEAFOOD: 'Meat & seafood',
	CANNED: 'Canned',
	FROZEN: 'Frozen',
	BAKERY: 'Bakery',
	PANTRY_STAPLES: 'Pantry staples',
	OTHER: 'Other'
};

/** One "For: …" attribution entry (FR-SH-009). Title is a snapshot (survives deletion). */
export interface NeededFor {
	recipeId: string | null;
	title: string;
}

export interface ShoppingList {
	id: string;
	ownerId: string;
	name: string;
	sourceType: ShoppingListSource;
	generatedRangeStart: ISODate | null;
	generatedRangeEnd: ISODate | null;
	status: ShoppingListStatus;
	completedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ShoppingItem {
	id: string;
	shoppingListId: string;
	name: string;
	quantity: number;
	unit: string;
	category: ShoppingCategory;
	neededFor: NeededFor[];
	sourcePlannedMealId: string | null;
	status: ShoppingItemStatus;
	checkedAt: string | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

/** Fields a user can edit on an item in place. */
export interface ShoppingItemPatch {
	name?: string;
	quantity?: number;
	unit?: string;
	category?: ShoppingCategory;
}

/** Input for adding one item (manual add or generation). */
export interface NewShoppingItem {
	name: string;
	quantity: number;
	unit: string;
	category: ShoppingCategory;
	neededFor?: NeededFor[];
	sourcePlannedMealId?: string | null;
	sortOrder?: number;
}

// ---------------------------------------------------------------------------
// Row → app mappers
// ---------------------------------------------------------------------------

export function toShoppingList(row: ShoppingListRow): ShoppingList {
	return {
		id: row.id,
		ownerId: row.owner_id,
		name: row.name,
		sourceType: row.source_type,
		generatedRangeStart: row.generated_range_start,
		generatedRangeEnd: row.generated_range_end,
		status: row.status,
		completedAt: row.completed_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/**
 * Parse the `needed_for` jsonb defensively: rows written by this app are
 * `[{ recipeId, title }]`, but jsonb accepts anything — malformed entries are
 * dropped rather than crashing a render.
 */
export function parseNeededFor(value: unknown): NeededFor[] {
	if (!Array.isArray(value)) return [];
	const out: NeededFor[] = [];
	for (const entry of value) {
		if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
			const rec = entry as Record<string, unknown>;
			if (typeof rec.title === 'string' && rec.title.length > 0) {
				out.push({
					recipeId: typeof rec.recipeId === 'string' ? rec.recipeId : null,
					title: rec.title
				});
			}
		}
	}
	return out;
}

export function toShoppingItem(row: ShoppingItemRow): ShoppingItem {
	return {
		id: row.id,
		shoppingListId: row.shopping_list_id,
		name: row.name,
		quantity: Number(row.quantity),
		unit: row.unit,
		category: row.category,
		neededFor: parseNeededFor(row.needed_for),
		sourcePlannedMealId: row.source_planned_meal_id,
		status: row.status,
		checkedAt: row.checked_at,
		sortOrder: row.sort_order,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/** App input → insert row (jsonb attribution serialized). */
export function toItemInsert(listId: string, item: NewShoppingItem): ShoppingItemInsert {
	return {
		shopping_list_id: listId,
		name: item.name,
		quantity: item.quantity,
		unit: item.unit,
		category: item.category,
		needed_for: (item.neededFor ?? []).map((n) => ({ recipeId: n.recipeId, title: n.title })),
		source_planned_meal_id: item.sourcePlannedMealId ?? null,
		sort_order: item.sortOrder ?? 0
	};
}
