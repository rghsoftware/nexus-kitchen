/**
 * @stub Called by the Shopping feature on trip completion (FR-PI-008).
 * No-op until the Shopping feature is built and wires this up.
 */
import type { ShoppingListItem } from './types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function addPantryItemsFromShoppingList(_items: ShoppingListItem[]): Promise<void> {
	// Intentional no-op stub. The Shopping feature will replace this body.
}

export type { ShoppingListItem };
