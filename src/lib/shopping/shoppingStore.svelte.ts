// Runes-based store for shopping. Holds the user's lists plus the currently-open
// list's items, with optimistic check/uncheck and server reconciliation (P15:
// online-first, server authoritative, rollback on failure).
//
// INV-SH-001 (an ACTIVE list keeps ≥ 1 item) is enforced here, not in the DB
// (cross-row — research R1): `wouldEmptyActiveList()` lets the UI prompt to archive
// instead of silently leaving an empty active list.

import { inputsFromSnapshot, normalizeName } from '$lib/planning/fulfillment';
import { loadIngredientIndex } from '$lib/planning/ingredientIndex';
import { listPlannedMeals } from '$lib/planning/planningService';
import type { ISODate } from '$lib/planning/types';
import {
	loadPantryItems,
	pantryItems,
	pantryLoaded,
	pantryLoading
} from '$lib/pantry/pantryStore.svelte';
import {
	loadPreppedMeals,
	preppedMeals,
	preppedMealsLoaded,
	preppedMealsLoading
} from '$lib/pantry/preppedMealStore.svelte';
import { computeBuyGaps } from './generation';
import {
	addItems as svcAddItems,
	addItem as svcAddItem,
	archiveShoppingList,
	createGeneratedList,
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
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- non-reactive timestamp, not UI state
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

// ---------------------------------------------------------------------------
// Generation (FR-SH-010..014)
// ---------------------------------------------------------------------------

export interface GenerationOutcome {
	/** Null when the range had no buy-gaps — no empty list is created (INV-SH-001). */
	list: ShoppingList | null;
	added: number;
}

function rangeListName(range: { start: ISODate; end: ISODate }): string {
	const day = (iso: ISODate) =>
		new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	return `Shopping ${day(range.start)} – ${day(range.end)}`;
}

/**
 * Turn the range's MUST_ACQUIRE gaps into list items (FR-SH-010): loads the range's
 * planned meals + the same fulfillment inputs the calendar uses, computes gaps via
 * computeBuyGaps, then creates a FROM_PLAN list — or, when `intoListId` is given,
 * dedupes into that existing list instead (FR-SH-011). Returns the target list and
 * how many items were added; `list: null` means "fully covered, nothing to buy".
 */
export async function generateFromPlan(
	range: { start: ISODate; end: ISODate },
	intoListId?: string
): Promise<GenerationOutcome | null> {
	_loading = true;
	_error = null;
	try {
		const inventoryLoads: Promise<void>[] = [];
		if (!pantryLoaded() && !pantryLoading()) inventoryLoads.push(loadPantryItems());
		if (!preppedMealsLoaded() && !preppedMealsLoading()) inventoryLoads.push(loadPreppedMeals());

		const [meals] = await Promise.all([
			listPlannedMeals(range.start, range.end),
			...inventoryLoads
		]);
		const recipeIds = meals
			.filter((m) => m.source === 'RECIPE' && m.recipeId !== null)
			.map((m) => m.recipeId as string);
		const ingredientsByRecipeId = await loadIngredientIndex(recipeIds);

		const existingItems = intoListId !== undefined ? await listItems(intoListId) : [];
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient lookup set, not UI state
		const existingPendingNames = new Set(
			existingItems.filter((i) => i.status === 'PENDING').map((i) => normalizeName(i.name))
		);

		const gaps = computeBuyGaps(
			meals,
			inputsFromSnapshot(
				{ pantryItems: pantryItems(), preppedMeals: preppedMeals() },
				ingredientsByRecipeId
			),
			existingPendingNames
		);

		const newItems: NewShoppingItem[] = [
			...gaps.ingredientGaps.map((gap, index) => ({
				name: gap.name,
				quantity: gap.suggestedQuantity,
				unit: gap.unit,
				category: gap.category,
				neededFor: gap.neededFor,
				sortOrder: index
			})),
			...gaps.storeBoughtGaps.map((gap, index) => ({
				name: gap.name,
				quantity: Math.max(1, gap.servings),
				unit: 'x',
				category: 'OTHER' as const,
				sourcePlannedMealId: gap.plannedMealId,
				sortOrder: gaps.ingredientGaps.length + index
			}))
		];

		if (newItems.length === 0) {
			// Fully covered. Never create (or leave) an empty active list (INV-SH-001).
			return {
				list: intoListId ? (_lists.find((l) => l.id === intoListId) ?? null) : null,
				added: 0
			};
		}

		let target: ShoppingList;
		if (intoListId !== undefined) {
			const known = _lists.find((l) => l.id === intoListId);
			if (!known) throw new Error("That list isn't available anymore.");
			target = known;
		} else {
			target = await createGeneratedList(rangeListName(range), range);
			upsertListLocal(target);
		}

		const created = await svcAddItems(target.id, newItems);
		if (_activeListId === target.id) {
			_items = [..._items, ...created];
		}
		return { list: target, added: created.length };
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't build the list from your plan.";
		return null;
	} finally {
		_loading = false;
	}
}
