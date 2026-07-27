// Typed data-access layer for shopping, built on supabase-js / PostgREST. Every call
// runs under the caller's RLS context — no owner filters in queries; the database
// enforces isolation (FR-SH-020). Errors surface as ShoppingError with calm, friendly
// messages — never silently swallowed.
//
// Status writes follow the §5.3 item state machine: checking sets checked_at,
// unchecking clears it (INV-SH-003 pairing is also a DB CHECK); completing a list
// sets completed_at (INV-SH-004).

import { supabase } from '$lib/supabaseClient';
import { currentUser } from '$lib/session/session.svelte';
import {
	toItemInsert,
	toShoppingItem,
	toShoppingList,
	type NewShoppingItem,
	type ShoppingItem,
	type ShoppingItemPatch,
	type ShoppingItemStatus,
	type ShoppingList
} from './types';
import type { ISODate } from '$lib/planning/types';

export class ShoppingError extends Error {
	readonly cause?: unknown;
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'ShoppingError';
		this.cause = cause;
	}
}

async function requireSession() {
	const user = await currentUser();
	if (!user) throw new ShoppingError('Your session has ended. Please sign in again.');
	return user;
}

/**
 * Mirror the DB CHECKs (quantity > 0 — INV-SH-002; name 1–200 chars) so bad input
 * fails fast with a specific message instead of PostgREST's generic constraint error.
 * Exported pure so the rules are unit-testable.
 */
export function validateItemInput(input: { name?: string; quantity?: number }): void {
	if (input.name !== undefined && (input.name.length < 1 || input.name.length > 200)) {
		throw new ShoppingError('Item names need to be 1–200 characters.');
	}
	if (input.quantity !== undefined && !(input.quantity > 0)) {
		throw new ShoppingError('Quantity needs to be more than zero.');
	}
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/** All of the user's lists, newest first. RLS scopes to owner. */
export async function listShoppingLists(): Promise<ShoppingList[]> {
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_lists')
		.select('*')
		.order('created_at', { ascending: false });
	if (error) throw new ShoppingError("We couldn't load your shopping lists.", error);
	return (data ?? []).map(toShoppingList);
}

export async function createShoppingList(name: string): Promise<ShoppingList> {
	await requireSession();
	const { data, error } = await supabase.from('shopping_lists').insert({ name }).select().single();
	if (error) throw new ShoppingError("We couldn't create that list. Please try again.", error);
	return toShoppingList(data);
}

/** Create a FROM_PLAN list carrying its generation range (FR-SH-014, data-model R1). */
export async function createGeneratedList(
	name: string,
	range: { start: ISODate; end: ISODate }
): Promise<ShoppingList> {
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_lists')
		.insert({
			name,
			source_type: 'FROM_PLAN',
			generated_range_start: range.start,
			generated_range_end: range.end
		})
		.select()
		.single();
	if (error) throw new ShoppingError("We couldn't create the list. Please try again.", error);
	return toShoppingList(data);
}

export async function renameShoppingList(id: string, name: string): Promise<ShoppingList> {
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_lists')
		.update({ name })
		.eq('id', id)
		.select()
		.single();
	if (error) throw new ShoppingError("We couldn't rename that list.", error);
	return toShoppingList(data);
}

export async function archiveShoppingList(id: string): Promise<ShoppingList> {
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_lists')
		.update({ status: 'ARCHIVED' })
		.eq('id', id)
		.select()
		.single();
	if (error) throw new ShoppingError("We couldn't archive that list.", error);
	return toShoppingList(data);
}

/**
 * Hard-delete a list (items cascade). Only used to clean up a just-created generated
 * list whose items failed to insert — user-facing removal archives instead.
 */
export async function deleteShoppingList(id: string): Promise<void> {
	await requireSession();
	const { error } = await supabase.from('shopping_lists').delete().eq('id', id);
	if (error) throw new ShoppingError("We couldn't remove the list.", error);
}

/** Mark the list SHOPPING (entered on first check; cosmetic, FR-SH-002). */
export async function markListShopping(id: string): Promise<ShoppingList> {
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_lists')
		.update({ status: 'SHOPPING' })
		.eq('id', id)
		.select()
		.single();
	if (error) throw new ShoppingError("We couldn't update that list.", error);
	return toShoppingList(data);
}

/** Complete a list — sets completed_at in the same write (INV-SH-004). */
export async function completeShoppingList(id: string): Promise<ShoppingList> {
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_lists')
		.update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
		.eq('id', id)
		.select()
		.single();
	if (error) throw new ShoppingError("We couldn't complete the list.", error);
	return toShoppingList(data);
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** All items of a list (REMOVED rows included; callers filter for display). */
export async function listItems(listId: string): Promise<ShoppingItem[]> {
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_list_items')
		.select('*')
		.eq('shopping_list_id', listId)
		.order('sort_order')
		.order('created_at');
	if (error) throw new ShoppingError("We couldn't load the list's items.", error);
	return (data ?? []).map(toShoppingItem);
}

export async function addItem(listId: string, item: NewShoppingItem): Promise<ShoppingItem> {
	validateItemInput(item);
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_list_items')
		.insert(toItemInsert(listId, item))
		.select()
		.single();
	if (error) throw new ShoppingError("We couldn't add that item.", error);
	return toShoppingItem(data);
}

/** Bulk insert for generation (FR-SH-010); returns rows in insertion order. */
export async function addItems(listId: string, items: NewShoppingItem[]): Promise<ShoppingItem[]> {
	if (items.length === 0) return [];
	for (const item of items) validateItemInput(item);
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_list_items')
		.insert(items.map((item) => toItemInsert(listId, item)))
		.select();
	if (error) throw new ShoppingError("We couldn't add the items.", error);
	return (data ?? []).map(toShoppingItem);
}

export async function updateItem(id: string, patch: ShoppingItemPatch): Promise<ShoppingItem> {
	validateItemInput(patch);
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_list_items')
		.update({
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
			...(patch.unit !== undefined ? { unit: patch.unit } : {}),
			...(patch.category !== undefined ? { category: patch.category } : {})
		})
		.eq('id', id)
		.select()
		.single();
	if (error) throw new ShoppingError("We couldn't update that item.", error);
	return toShoppingItem(data);
}

/**
 * Build the status-transition payload for an item (§5.3 state machine):
 * CHECKED pairs with a checked_at timestamp; leaving CHECKED clears it (INV-SH-003).
 * Exported pure so the pairing rule is unit-testable.
 */
export function itemStatusPayload(
	status: ShoppingItemStatus,
	now: string = new Date().toISOString()
): { status: ShoppingItemStatus; checked_at: string | null } {
	return { status, checked_at: status === 'CHECKED' ? now : null };
}

export async function setItemStatus(id: string, status: ShoppingItemStatus): Promise<ShoppingItem> {
	await requireSession();
	const { data, error } = await supabase
		.from('shopping_list_items')
		.update(itemStatusPayload(status))
		.eq('id', id)
		.select()
		.single();
	if (error) throw new ShoppingError("We couldn't update that item.", error);
	return toShoppingItem(data);
}

/** Hard-delete an item row (manual remove during editing; trips use REMOVED status). */
export async function deleteItem(id: string): Promise<void> {
	await requireSession();
	const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
	if (error) throw new ShoppingError("We couldn't remove that item.", error);
}

// ---------------------------------------------------------------------------
// Completion support (FR-SH-018): STORE_BOUGHT planned meal → PREPPED conversion
// ---------------------------------------------------------------------------

/**
 * Build the conversion payload pointing a STORE_BOUGHT planned meal at a new prepped
 * portion. Must satisfy `planned_meals_exactly_one_source` (0006): the PREPPED arm
 * requires the name snapshot and forbids store_bought_name — both set in ONE write.
 * Exported pure so the payload shape is unit-testable.
 */
export function storeBoughtConversionPayload(preppedMealId: string, name: string) {
	return {
		source: 'PREPPED' as const,
		prepped_meal_id: preppedMealId,
		prepped_name_snapshot: name,
		store_bought_name: null
	};
}

/**
 * Point the source planned meal at the purchased portion — only while it is still a
 * PLANNED / STORE_BOUGHT meal (FR-SH-018: deleted or already-resolved meals are
 * skipped; the .eq guards make the update a no-op then).
 * Returns true when the link was made.
 */
export async function linkStoreBoughtMealToPortion(
	plannedMealId: string,
	preppedMealId: string,
	name: string
): Promise<boolean> {
	await requireSession();
	const { data, error } = await supabase
		.from('planned_meals')
		.update(storeBoughtConversionPayload(preppedMealId, name))
		.eq('id', plannedMealId)
		.eq('status', 'PLANNED')
		.eq('source', 'STORE_BOUGHT')
		.select('id');
	if (error) throw new ShoppingError("We couldn't link the purchase to its planned meal.", error);
	return (data ?? []).length > 0;
}
