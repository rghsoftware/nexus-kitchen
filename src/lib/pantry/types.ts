import type { Database } from '$lib/database.types';

// ---------------------------------------------------------------------------
// DB row aliases
// ---------------------------------------------------------------------------
type PantryItemRow = Database['public']['Tables']['pantry_items']['Row'];
type PreppedMealRow = Database['public']['Tables']['prepped_meals']['Row'];
type PortionEventRow = Database['public']['Tables']['portion_events']['Row'];

// ---------------------------------------------------------------------------
// Enums (re-exported from DB types for type safety)
// ---------------------------------------------------------------------------
export type StorageLocation = Database['public']['Enums']['storage_location'];
export type DefrostState = Database['public']['Enums']['defrost_state'];
export type PreppedMealOrigin = Database['public']['Enums']['prepped_meal_origin'];
export type PortionEventKind = Database['public']['Enums']['portion_event_kind'];

// ---------------------------------------------------------------------------
// PantryItem — DB row + client-computed derived fields
// ---------------------------------------------------------------------------
export interface PantryItem extends PantryItemRow {
	// Derived client-side; never stored in DB
	isRunningLow: boolean;
	isExpiringSoon: boolean; // expiration_date within 7 days
	isExpired: boolean;
}

// ---------------------------------------------------------------------------
// PreppedMeal — DB row + client-computed derived fields
// ---------------------------------------------------------------------------
export interface PreppedMeal extends PreppedMealRow {
	// Derived client-side; never stored in DB
	isExpiringSoon: boolean; // expiration_date within 2 days
	isExpired: boolean;
	isReadyToEat: boolean; // defrost_state IN ('NOT_APPLICABLE', 'READY')
}

// ---------------------------------------------------------------------------
// PortionEvent — DB row (no extra derived fields needed)
// ---------------------------------------------------------------------------
export type PortionEvent = PortionEventRow;

// ---------------------------------------------------------------------------
// Snapshot interface — consumed by the Planning feature (stub, FR-FC-003)
// ---------------------------------------------------------------------------
export interface InventorySnapshot {
	pantryItems: PantryItem[];
	preppedMeals: PreppedMeal[];
	snapshotAt: string; // ISO timestamptz
}

// ---------------------------------------------------------------------------
// ShoppingListItem — passed by the Shopping feature (stub, FR-PI-008)
// ---------------------------------------------------------------------------
export interface ShoppingListItem {
	id: string;
	name: string;
	quantity: number;
	unit: string;
	storageLocation?: StorageLocation;
}

// ---------------------------------------------------------------------------
// Input types for writes
// ---------------------------------------------------------------------------
export type NewPantryItem = Omit<
	Database['public']['Tables']['pantry_items']['Insert'],
	'id' | 'created_at' | 'updated_at'
>;

export type PantryItemUpdate = Database['public']['Tables']['pantry_items']['Update'];

export type NewPreppedMeal = Omit<
	Database['public']['Tables']['prepped_meals']['Insert'],
	'id' | 'created_at' | 'updated_at'
>;

export type PreppedMealUpdate = Omit<
	Database['public']['Tables']['prepped_meals']['Update'],
	'portions_remaining' | 'original_portions' // updated only via portion_events trigger
>;

// ---------------------------------------------------------------------------
// Default shelf lives (FR-PI-009, FR-PM-009)
// ---------------------------------------------------------------------------
export const DEFAULT_SHELF_LIFE_DAYS: Record<StorageLocation, number> = {
	PANTRY: 365,
	FRIDGE: 7,
	FREEZER: 90,
	OTHER: 30
};

export const PREPPED_SHELF_LIFE_DAYS: Partial<Record<StorageLocation, number>> = {
	FRIDGE: 4,
	FREEZER: 90
};

// ---------------------------------------------------------------------------
// Helpers: compute derived fields from raw DB rows
// ---------------------------------------------------------------------------
function daysDiff(isoDate: string | null): number | null {
	if (!isoDate) return null;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const target = new Date(isoDate);
	return Math.floor((target.getTime() - today.getTime()) / 86_400_000);
}

export function toPantryItem(row: PantryItemRow): PantryItem {
	const diff = daysDiff(row.expiration_date);
	return {
		...row,
		isRunningLow:
			row.minimum_quantity != null && Number(row.quantity) <= Number(row.minimum_quantity),
		isExpiringSoon: diff !== null && diff >= 0 && diff <= 7,
		isExpired: diff !== null && diff < 0
	};
}

export function toPreppedMeal(row: PreppedMealRow): PreppedMeal {
	const diff = daysDiff(row.expiration_date);
	return {
		...row,
		isExpiringSoon: diff !== null && diff >= 0 && diff <= 2,
		isExpired: diff !== null && diff < 0,
		isReadyToEat: row.defrost_state === 'NOT_APPLICABLE' || row.defrost_state === 'READY'
	};
}
