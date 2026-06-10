/**
 * @stub Consumed by the Planning feature to compute fulfillment states.
 * No active consumer exists in this build (FR-FC-003, clarification 2026-06-09).
 * The Planning feature will import getInventorySnapshot() when built.
 */
import type { InventorySnapshot } from './types';

// Imported lazily to avoid circular deps — stores import services, not vice versa.
// The Planning feature calls this after both stores are initialised.
export async function getInventorySnapshot(): Promise<InventorySnapshot> {
	const { pantryItems } = await import('./pantryStore.svelte');
	const { preppedMeals } = await import('./preppedMealStore.svelte');

	return {
		pantryItems: pantryItems(),
		preppedMeals: preppedMeals(),
		snapshotAt: new Date().toISOString()
	};
}

export type { InventorySnapshot };
