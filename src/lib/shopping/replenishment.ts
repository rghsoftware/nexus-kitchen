// Trip completion (FR-SH-015..018): checked items replenish the pantry through the
// reserved seam; checked items that came from a STORE_BOUGHT planned meal become
// ready-to-eat prepped portions (origin STORE_BOUGHT, Domain Spec §4.11) and the
// source meal is auto-linked so it derives HAVE_IT.
//
// Writes are sequential client calls (online-first, P15 — research R5): a partial
// failure leaves correct-but-incomplete state; every failure lands in the report the
// completion sheet shows. Inventory writes are additive (pantry merges re-add,
// portions re-create — only the meal links and list completion are .eq-guarded), so
// completeTrip refuses lists that are already COMPLETED rather than risk doubling
// inventory, and the completion sheet offers Close, not retry, after a partial failure.

import { addPantryItemsFromShoppingList } from '$lib/pantry/shoppingListIntegration';
import { addPreppedMeal } from '$lib/pantry/preppedMealService';
import { loadPantryItems } from '$lib/pantry/pantryStore.svelte';
import { loadPreppedMeals } from '$lib/pantry/preppedMealStore.svelte';
import { ensureSession } from '$lib/session/session.svelte';
import type { User } from '@supabase/supabase-js';
import type { ISODate } from '$lib/planning/types';
import type { StorageLocation } from '$lib/pantry/types';
import { addItems, completeShoppingList, linkStoreBoughtMealToPortion } from './shoppingService';
import type { ShoppingItem, ShoppingList } from './types';

// Re-exported so the completion sheet and tests reach the pure planner through the
// shopping module (the implementation lives with the pantry seam it feeds).
export { planReplenishment } from '$lib/pantry/shoppingListIntegration';
export type { PlannedPantryInsert, ReplenishmentPlan } from '$lib/pantry/shoppingListIntegration';

/** One checked item headed for the pantry (review-step editable). */
export interface PantryAddition {
	itemId: string;
	name: string;
	quantity: number;
	unit: string;
	storageLocation: StorageLocation;
}

/** One checked store-bought purchase headed for ready-to-eat inventory. */
export interface PortionAddition {
	itemId: string;
	/** Planned meal to auto-link (FR-SH-018); null = portion only. */
	plannedMealId: string | null;
	name: string;
	portions: number;
	storageLocation: StorageLocation;
	/** Must be after today (INV-INV-009). */
	expirationDate: ISODate;
}

export interface CompletionReport {
	list: ShoppingList | null;
	/** Pantry rows written (merged or inserted); duplicate purchases merge into one row. */
	pantryItemsAdded: number;
	portionsCreated: number;
	mealsLinked: number;
	failures: { name: string; message: string }[];
}

const DAY_MS = 86_400_000;
const STORE_BOUGHT_SHELF_DAYS = 3;

function isoDate(ms: number): ISODate {
	return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Default review rows for the completion sheet: store-bought-generated items
 * (sourcePlannedMealId set) become portion additions — portions from the purchased
 * quantity, fridge, today + 3 days (research R5) — everything else heads to the
 * pantry at its purchased quantity/unit.
 */
export function defaultAdditions(
	checkedItems: readonly ShoppingItem[],
	now: number = Date.now()
): { pantry: PantryAddition[]; portions: PortionAddition[] } {
	const pantry: PantryAddition[] = [];
	const portions: PortionAddition[] = [];
	for (const item of checkedItems) {
		if (item.status !== 'CHECKED') continue;
		if (item.sourcePlannedMealId !== null) {
			portions.push({
				itemId: item.id,
				plannedMealId: item.sourcePlannedMealId,
				name: item.name,
				portions: Math.max(1, Math.round(item.quantity)),
				storageLocation: 'FRIDGE',
				expirationDate: isoDate(now + STORE_BOUGHT_SHELF_DAYS * DAY_MS)
			});
		} else {
			pantry.push({
				itemId: item.id,
				name: item.name,
				quantity: item.quantity,
				unit: item.unit,
				storageLocation: 'PANTRY'
			});
		}
	}
	return { pantry, portions };
}

/**
 * Complete the trip (FR-SH-015..018): replenish the pantry with the reviewed items,
 * create store-bought portions + auto-link their meals, then mark the list COMPLETED
 * (INV-SH-004 via the service). Pass empty arrays to decline replenishment — the
 * offer is an offer (REQ-PM-011). Never throws; failures are reported per step.
 */
export async function completeTrip(
	list: ShoppingList,
	additions: { pantry: PantryAddition[]; portions: PortionAddition[] }
): Promise<CompletionReport> {
	const report: CompletionReport = {
		list: null,
		pantryItemsAdded: 0,
		portionsCreated: 0,
		mealsLinked: 0,
		failures: []
	};

	// Inventory writes are additive (see module header) — refuse a re-run instead of
	// silently doubling pantry quantities and portions.
	if (list.status === 'COMPLETED') {
		report.list = list;
		report.failures.push({
			name: list.name,
			message: 'This trip was already completed, so nothing was added twice.'
		});
		return report;
	}

	if (additions.pantry.length > 0) {
		try {
			const written = await addPantryItemsFromShoppingList(
				additions.pantry.map((a) => ({
					id: a.itemId,
					name: a.name,
					quantity: a.quantity,
					unit: a.unit,
					storageLocation: a.storageLocation
				}))
			);
			report.pantryItemsAdded = written.added;
			report.failures.push(...written.failures);
		} catch (err) {
			// Thrown only before any write (no session / pantry unreadable) — see the seam.
			report.failures.push({
				name: 'Pantry items',
				message: err instanceof Error ? err.message : "We couldn't add the items to your pantry."
			});
		}
	}

	// The "never throws" contract includes the session lookup — a rejection here
	// becomes per-portion failures below (user stays null), not an escaped rejection.
	let user: User | null = null;
	try {
		user = await ensureSession();
	} catch (err) {
		console.error('[completeTrip] ensureSession failed', err);
	}
	const today = isoDate(Date.now());
	for (const portion of additions.portions) {
		try {
			if (!user) throw new Error("We couldn't start a session.");
			const created = await addPreppedMeal({
				owner_id: user.id,
				origin: 'STORE_BOUGHT',
				name: portion.name,
				portions_remaining: portion.portions,
				original_portions: portion.portions,
				storage_location: portion.storageLocation,
				prepared_date: today,
				expiration_date: portion.expirationDate
			});
			report.portionsCreated += 1;
			if (portion.plannedMealId !== null) {
				const linked = await linkStoreBoughtMealToPortion(
					portion.plannedMealId,
					created.id,
					portion.name
				);
				if (linked) report.mealsLinked += 1;
			}
		} catch (err) {
			report.failures.push({
				name: portion.name,
				message: err instanceof Error ? err.message : "We couldn't save that purchase."
			});
		}
	}

	try {
		report.list = await completeShoppingList(list.id);
	} catch (err) {
		report.failures.push({
			name: list.name,
			message: err instanceof Error ? err.message : "We couldn't mark the list completed."
		});
	}

	// Refresh inventory caches so the calendar re-derives fulfillment from fresh state.
	try {
		await Promise.all([loadPantryItems(), loadPreppedMeals()]);
	} catch (err) {
		// Cache refresh is best-effort; the next navigation reloads anyway (P15).
		console.error('[completeTrip] inventory cache refresh failed (best-effort)', err);
	}

	return report;
}

/**
 * Carry unbought (PENDING / UNAVAILABLE) items onto a fresh list so the gaps stay
 * visible (FR-SH-017). Returns the created list (null if creation failed) and the
 * number of items carried onto it.
 */
export async function carryOverItems(
	createList: (name: string) => Promise<ShoppingList | null>,
	items: readonly ShoppingItem[],
	listName = 'Still to get'
): Promise<{ list: ShoppingList | null; carried: number }> {
	const unbought = items.filter((i) => i.status === 'PENDING' || i.status === 'UNAVAILABLE');
	if (unbought.length === 0) return { list: null, carried: 0 };
	const list = await createList(listName);
	if (!list) return { list: null, carried: 0 };
	const created = await addItems(
		list.id,
		unbought.map((i, index) => ({
			name: i.name,
			quantity: i.quantity,
			unit: i.unit,
			category: i.category,
			neededFor: i.neededFor,
			sourcePlannedMealId: i.sourcePlannedMealId,
			sortOrder: index
		}))
	);
	return { list, carried: created.length };
}
