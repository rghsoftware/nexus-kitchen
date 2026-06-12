# Contracts: Shopping

No Edge Functions, no server endpoints (P1/P2). All data access is PostgREST CRUD
under owner-only RLS:

- `shopping_lists` — new table; CRUD via `shoppingService.ts`.
- `shopping_list_items` — new table; CRUD via `shoppingService.ts`; status writes
  follow the §5.3 item state machine (`checked_at` set/cleared with status).
- `planned_meals` — existing reads (range fetch) for generation; one new write shape
  on completion: STORE_BOUGHT → PREPPED conversion
  (`source, prepped_meal_id, prepped_name_snapshot, store_bought_name=null`) which
  must satisfy `planned_meals_exactly_one_source` (0006 form).
- `prepped_meals` — existing insert path (`addPreppedMeal`) with
  `origin = 'STORE_BOUGHT'`.
- `pantry_items` — existing insert/update paths for replenishment.
- `recipe_ingredients`, `pantry_items`, `prepped_meals` reads — via the existing
  fulfillment inputs machinery (feature 004).

## Internal module contracts (the real interfaces of this feature)

```ts
// src/lib/shopping/generation.ts — pure, no I/O (FR-SH-010..012)
computeBuyGaps(meals, fulfillmentInputs, existingPendingNames): GapResult
// Calls deriveFulfillment() per meal — list and calendar chips share one derivation.

// src/lib/shopping/replenishment.ts — pure planning + thin orchestration (FR-SH-015..018)
planReplenishment(checkedItems, pantryItems): { merges, inserts }
completeTrip(list, items, options): Promise<CompletionReport>

// src/lib/pantry/shoppingListIntegration.ts — EXISTING SEAM, body becomes real (FR-PI-008)
addPantryItemsFromShoppingList(items: ShoppingListItem[]): Promise<void>
```

The pantry seam's import path and signature are stable; only the no-op body changes.
