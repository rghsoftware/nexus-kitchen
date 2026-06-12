/**
 * Stub interface: addPantryItemsFromShoppingList()
 *
 * Called by the Shopping feature when a shopping trip is completed (FR-PI-008).
 * Implementation in src/lib/pantry/shoppingListIntegration.ts is a no-op
 * until the Shopping feature wires it up.
 */
import type { ShoppingListItem } from '../data-model.md';

// Signature contract — do not change without updating the Shopping feature spec.
export declare function addPantryItemsFromShoppingList(
	checkedItems: ShoppingListItem[]
): Promise<void>;
