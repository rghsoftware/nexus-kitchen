# Contracts: Fulfillment State

No new API endpoints. All data access is existing PostgREST CRUD under RLS:

- `planned_meals` — existing CRUD via `planningService.ts`; inserts may now carry
  `source='PREPPED'`, `prepped_meal_id`, `prepped_name_snapshot` (migration 0006).
- `recipe_ingredients` — new read projection (existing RLS policy):
  `select id, recipe_id, name, is_optional, substitute_for where recipe_id in (...)`.
- `pantry_items`, `prepped_meals` — read-only via existing stores/`InventorySnapshot`.

## Internal module contract (the real interface of this feature)

```ts
// src/lib/planning/fulfillment.ts — pure, no I/O
deriveFulfillment(meal: PlannedMeal, inputs: FulfillmentInputs): FulfillmentResult | null
// null ⇔ not fulfillment-tracked (QUICK / non-PLANNED) or inputs unavailable (FR-FS-009)
```

See data-model.md for `FulfillmentInputs` / `FulfillmentResult` shapes and derivation rules.
