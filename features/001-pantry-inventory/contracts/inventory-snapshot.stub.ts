/**
 * Stub interface: getInventorySnapshot()
 *
 * Called by the Planning feature to compute fulfillment states.
 * Implementation in src/lib/pantry/inventorySnapshot.ts reads from
 * pantryStore + preppedMealStore. No consumer exists until Planning is built.
 */
import type { InventorySnapshot } from '../data-model.md';

// Signature contract — do not change without updating the Planning feature spec.
export declare function getInventorySnapshot(): InventorySnapshot;
