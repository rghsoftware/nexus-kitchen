// Runes-based store for shopping. Holds the user's lists plus the currently-open
// list's items, with optimistic check/uncheck and server reconciliation (P15:
// online-first, server authoritative, rollback on failure).
//
// INV-SH-001 (an ACTIVE list keeps ≥ 1 item) is enforced here, not in the DB
// (cross-row — research R1): `wouldEmptyActiveList()` lets the UI prompt to archive
// instead of silently leaving an empty active list.

import {
	addItem as svcAddItem,
	archiveShoppingList,
	createShoppingList,
	deleteItem as svcDeleteItem,
	listItems,
	listShoppingLists,
	markListShopping,
	renameShoppingList,
	setItemStatus,
	updateItem as svcUpdateItem
} from './shoppingService';
import type {
	NewShoppingItem,
	ShoppingItem,
	ShoppingItemPatch,
	ShoppingItemStatus,
	ShoppingList
} from './types';

// ---------------------------------------------------------------------------
// Module-level reactive state (Svelte 5 runes)
// ---------------------------------------------------------------------------

let _lists = $state<ShoppingList[]>([]);
let _listsLoaded = $state(false);
let _activeListId = $state<string | null>(null);
let _items = $state<ShoppingItem[]>([]);
let _loading = $state(false);
let _error = $state<string | null>(null);

// ---------------------------------------------------------------------------
// Public accessors
// ---------------------------------------------------------------------------

export function shoppingLists(): ShoppingList[] {
	return _lists;
}
export function shoppingListsLoaded(): boolean {
	return _listsLoaded;
}
export function openListId(): string | null {
	return _activeListId;
}
export function openList(): ShoppingList | null {
	return _lists.find((l) => l.id === _activeListId) ?? null;
}
/** Items of the open list, REMOVED rows filtered out (kept for accounting only). */
export function openListItems(): ShoppingItem[] {
	return _items.filter((i) => i.status !== 'REMOVED');
}
export function shoppingLoading(): boolean {
	return _loading;
}
export function shoppingError(): string | null {
	return _error;
}
export function clearShoppingError(): void {
	_error = null;
}

/** Lists a user can still shop from, most recent first. */
export function activeLists(): ShoppingList[] {
	return _lists.filter((l) => l.status === 'ACTIVE' || l.status === 'SHOPPING');
}
/** Completed/archived lists for the "recent" shelf (FR-SH-004). */
export function recentLists(): ShoppingList[] {
	return _lists.filter((l) => l.status === 'COMPLETED' || l.status === 'ARCHIVED');
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export async function loadLists(): Promise<void> {
	_loading = true;
	_error = null;
	try {
		_lists = await listShoppingLists();
		_listsLoaded = true;
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't load your shopping lists.";
	} finally {
		_loading = false;
	}
}

/** Open a list and load its items. */
export async function openShoppingList(listId: string): Promise<void> {
	_activeListId = listId;
	_items = [];
	_loading = true;
	_error = null;
	try {
		_items = await listItems(listId);
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't load that list.";
	} finally {
		_loading = false;
	}
}

export function closeShoppingList(): void {
	_activeListId = null;
	_items = [];
}

// ---------------------------------------------------------------------------
// List actions
// ---------------------------------------------------------------------------

export async function createList(name: string): Promise<ShoppingList | null> {
	_error = null;
	try {
		const created = await createShoppingList(name);
		_lists = [created, ..._lists];
		return created;
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't create that list.";
		return null;
	}
}

export async function renameList(id: string, name: string): Promise<boolean> {
	_error = null;
	try {
		const updated = await renameShoppingList(id, name);
		_lists = _lists.map((l) => (l.id === id ? updated : l));
		return true;
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't rename that list.";
		return false;
	}
}

export async function archiveList(id: string): Promise<boolean> {
	_error = null;
	try {
		const updated = await archiveShoppingList(id);
		_lists = _lists.map((l) => (l.id === id ? updated : l));
		if (_activeListId === id) closeShoppingList();
		return true;
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't archive that list.";
		return false;
	}
}

/** Swap in a server-fresh list row (used by generation/completion flows). */
export function upsertListLocal(list: ShoppingList): void {
	_lists = _lists.some((l) => l.id === list.id)
		? _lists.map((l) => (l.id === list.id ? list : l))
		: [list, ..._lists];
}

// ---------------------------------------------------------------------------
// Item actions
// ---------------------------------------------------------------------------

export async function addItemToOpenList(item: NewShoppingItem): Promise<ShoppingItem | null> {
	if (_activeListId === null) return null;
	_error = null;
	try {
		const created = await svcAddItem(_activeListId, item);
		_items = [..._items, created];
		return created;
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't add that item.";
		return null;
	}
}

export async function updateOpenItem(
	id: string,
	patch: ShoppingItemPatch
): Promise<ShoppingItem | null> {
	const before = _items.find((i) => i.id === id);
	if (!before) return null;
	const optimistic: ShoppingItem = { ...before, ...patch };
	_items = _items.map((i) => (i.id === id ? optimistic : i));
	_error = null;
	try {
		const updated = await svcUpdateItem(id, patch);
		_items = _items.map((i) => (i.id === id ? updated : i));
		return updated;
	} catch (err) {
		_items = _items.map((i) => (i.id === id ? before : i));
		_error = err instanceof Error ? err.message : "We couldn't update that item.";
		return null;
	}
}

/**
 * INV-SH-001 guard: would removing/deleting this item leave an ACTIVE/SHOPPING list
 * with no visible items? The UI prompts to archive the list instead.
 */
export function wouldEmptyActiveList(itemId: string): boolean {
	const list = openList();
	if (!list || (list.status !== 'ACTIVE' && list.status !== 'SHOPPING')) return false;
	return openListItems().filter((i) => i.id !== itemId).length === 0;
}

/**
 * Delete an item (manual editing). When it is the last visible item of an active
 * list and `archiveEmptiedList` is set, the list is archived in the same action
 * (the UI asks first via wouldEmptyActiveList()).
 */
export async function deleteOpenItem(id: string, archiveEmptiedList = false): Promise<boolean> {
	const before = _items;
	const emptied = wouldEmptyActiveList(id);
	_items = _items.filter((i) => i.id !== id);
	_error = null;
	try {
		await svcDeleteItem(id);
		if (emptied && archiveEmptiedList && _activeListId !== null) {
			await archiveList(_activeListId);
		}
		return true;
	} catch (err) {
		_items = before;
		_error = err instanceof Error ? err.message : "We couldn't remove that item.";
		return false;
	}
}

// ---------------------------------------------------------------------------
// Trip actions (optimistic — REQ-CN-003)
// ---------------------------------------------------------------------------

/**
 * Optimistically set an item's status (§5.3 machine). Checking stamps a local
 * checked_at immediately; the server row reconciles it (INV-SH-003 pairing).
 * Returns the updated item, or null on rollback.
 */
export async function setOpenItemStatus(
	id: string,
	status: ShoppingItemStatus
): Promise<ShoppingItem | null> {
	const before = _items.find((i) => i.id === id);
	if (!before) return null;

	const optimistic: ShoppingItem = {
		...before,
		status,
		checkedAt: status === 'CHECKED' ? new Date().toISOString() : null
	};
	_items = _items.map((i) => (i.id === id ? optimistic : i));
	_error = null;

	// First check of an ACTIVE list moves it to SHOPPING (FR-SH-002; cosmetic).
	const list = openList();
	const promote = status === 'CHECKED' && list !== null && list.status === 'ACTIVE';

	try {
		const updated = await setItemStatus(id, status);
		_items = _items.map((i) => (i.id === id ? updated : i));
		if (promote && _activeListId !== null) {
			try {
				upsertListLocal(await markListShopping(_activeListId));
			} catch {
				// Status promotion is cosmetic — checking off must not fail because of it.
			}
		}
		return updated;
	} catch (err) {
		_items = _items.map((i) => (i.id === id ? before : i));
		_error = err instanceof Error ? err.message : "We couldn't update that item.";
		return null;
	}
}

export function checkItem(id: string): Promise<ShoppingItem | null> {
	return setOpenItemStatus(id, 'CHECKED');
}
export function uncheckItem(id: string): Promise<ShoppingItem | null> {
	return setOpenItemStatus(id, 'PENDING');
}
export function markItemUnavailable(id: string): Promise<ShoppingItem | null> {
	return setOpenItemStatus(id, 'UNAVAILABLE');
}

/** Replace the open list's items wholesale (generation/completion flows). */
export function setOpenItemsLocal(items: ShoppingItem[]): void {
	_items = items;
}
