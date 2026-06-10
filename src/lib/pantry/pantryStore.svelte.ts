import { supabase } from '$lib/supabaseClient';
import { addPantryItem, deletePantryItem, getPantryItems, updatePantryItem } from './pantryService';
import { toPantryItem, type NewPantryItem, type PantryItem, type PantryItemUpdate } from './types';

// ---------------------------------------------------------------------------
// Module-level reactive state (Svelte 5 runes)
// ---------------------------------------------------------------------------

let _items = $state<PantryItem[]>([]);
let _loading = $state(false);
let _error = $state<string | null>(null);

// ---------------------------------------------------------------------------
// Public accessors (getter functions so consumers can read reactive state)
// ---------------------------------------------------------------------------

export function pantryItems(): PantryItem[] {
	return _items;
}
export function pantryLoading(): boolean {
	return _loading;
}
export function pantryError(): string | null {
	return _error;
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

// Getter functions — $derived cannot be exported from a .svelte.ts module
// (Svelte compiler error: derived_invalid_export). Consumers wrap these
// calls in a local $derived to get reactive re-evaluation.
export function expiringSoonPantry(): PantryItem[] {
	return _items.filter((i) => i.isExpiringSoon);
}
export function runningLow(): PantryItem[] {
	return _items.filter((i) => i.isRunningLow);
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export async function loadPantryItems(householdId?: string | null): Promise<void> {
	_loading = true;
	_error = null;
	try {
		_items = await getPantryItems(householdId);
	} catch (err) {
		_error = err instanceof Error ? err.message : 'Failed to load pantry';
	} finally {
		_loading = false;
	}
}

// ---------------------------------------------------------------------------
// Optimistic writes
// ---------------------------------------------------------------------------

export async function optimisticAddPantryItem(item: NewPantryItem): Promise<PantryItem> {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- non-reactive timestamp, not UI state
	const nowIso = new Date(Date.now()).toISOString();
	const placeholder: PantryItem = {
		id: crypto.randomUUID(),
		created_at: nowIso,
		updated_at: nowIso,
		owner_id: item.owner_id,
		name: item.name,
		quantity: item.quantity ?? 0,
		unit: item.unit,
		storage_location: item.storage_location ?? 'PANTRY',
		ingredient_id: item.ingredient_id ?? null,
		household_id: item.household_id ?? null,
		barcode: item.barcode ?? null,
		custom_location: item.custom_location ?? null,
		purchase_date: item.purchase_date ?? null,
		expiration_date: item.expiration_date ?? null,
		opened_date: item.opened_date ?? null,
		photo_url: item.photo_url ?? null,
		thumbnail_url: item.thumbnail_url ?? null,
		minimum_quantity: item.minimum_quantity ?? null,
		isRunningLow: false,
		isExpiringSoon: false,
		isExpired: false
	};
	_items = [..._items, placeholder];

	try {
		const saved = await addPantryItem(item);
		_items = _items.map((i) => (i.id === placeholder.id ? saved : i));
		return saved;
	} catch (err) {
		_items = _items.filter((i) => i.id !== placeholder.id);
		throw err;
	}
}

export async function optimisticUpdatePantryItem(
	id: string,
	changes: PantryItemUpdate
): Promise<PantryItem> {
	const prev = _items.find((i) => i.id === id);
	if (prev) {
		_items = _items.map((i) => (i.id === id ? toPantryItem({ ...i, ...changes }) : i));
	}
	try {
		const saved = await updatePantryItem(id, changes);
		_items = _items.map((i) => (i.id === id ? saved : i));
		return saved;
	} catch (err) {
		if (prev) _items = _items.map((i) => (i.id === id ? prev : i));
		throw err;
	}
}

export async function optimisticDeletePantryItem(id: string): Promise<void> {
	const prev = _items.find((i) => i.id === id);
	_items = _items.filter((i) => i.id !== id);
	try {
		await deletePantryItem(id);
	} catch (err) {
		if (prev) _items = [..._items, prev];
		throw err;
	}
}

// ---------------------------------------------------------------------------
// Realtime (wired in T024 — placeholder kept here for T010 completeness)
// ---------------------------------------------------------------------------

let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeToHouseholdPantryChanges(
	householdId: string,
	onReconnect?: () => void
): () => void {
	_realtimeChannel?.unsubscribe();

	_realtimeChannel = supabase
		.channel(`pantry-household-${householdId}`)
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'pantry_items',
				filter: `household_id=eq.${householdId}`
			},
			(payload) => {
				if (payload.eventType === 'DELETE') {
					_items = _items.filter((i) => i.id !== (payload.old as { id: string }).id);
				} else {
					const updated = toPantryItem(payload.new as Parameters<typeof toPantryItem>[0]);
					const idx = _items.findIndex((i) => i.id === updated.id);
					if (idx >= 0) {
						_items = _items.map((i) => (i.id === updated.id ? updated : i));
					} else {
						_items = [..._items, updated];
					}
				}
			}
		)
		.on('system', { event: 'reconnect' }, () => {
			onReconnect?.();
		})
		.subscribe();

	return () => {
		_realtimeChannel?.unsubscribe();
		_realtimeChannel = null;
	};
}
