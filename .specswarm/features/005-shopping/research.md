# Research: Shopping — close the buy-gap

Decisions resolving every open point in the spec. No new dependencies were needed;
all choices reuse approved stack + existing in-repo patterns.

## R1 — Schema shape (migration `0007_shopping.sql`)

**Decision**: Two tables (`shopping_lists`, `shopping_list_items`) + four Postgres
enums (`shopping_list_source`, `shopping_list_status`, `shopping_item_status`,
`shopping_category`), mirroring Domain Specification §2.5 minus deferred fields
(householdId kept as plain nullable uuid like every other table; storeLayoutId,
photoUrl, assignedToUserId, online-ordering fields omitted until their features).

**Range instead of mealPlanId**: the domain entity has `mealPlanId?`, but plans here
are implicit weekly rows and a generation range (today → +6 by default, FR-SH-014) can
span two weekly plans. So FROM_PLAN lists store `generated_range_start` /
`generated_range_end` (dates) instead of a single plan FK. Rationale: truthful
provenance; a plan FK would be wrong half the time. Alternative (FK to first plan)
rejected as misleading.

**Attribution**: `needed_for jsonb NOT NULL DEFAULT '[]'` holding
`[{ "recipeId": uuid|null, "title": text }]` — titles are snapshots so attribution
survives recipe deletion (same snapshot philosophy as FR-PL-019). Alternative
(uuid[] + join at render) rejected: breaks on deleted recipes.

**Store-bought link**: `source_planned_meal_id uuid REFERENCES planned_meals ON DELETE
SET NULL` on items (FR-SH-018). SET NULL = "link skipped" path for free.

**Invariant placement** (FR-SH-021):
- INV-SH-002 → `CHECK (quantity > 0)`
- INV-SH-003 → `CHECK (status <> 'CHECKED' OR checked_at IS NOT NULL)`
- INV-SH-004 → `CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL)`
- INV-SH-001 (active list has ≥1 item) is **cross-row**: enforced at the app layer
  (delete-last-item prompt archives the list; generation with zero gaps creates no
  list). A deferred-trigger DB enforcement was considered and rejected — same call
  the meal_plans feature made for its cross-row rules, and a trigger would fight
  legitimate transient states during list assembly.

`updated_at` via existing `set_updated_at()` trigger (0002). RLS owner-only,
default-deny (P7): lists by `owner_id = auth.uid()`, items via `EXISTS` against the
parent list (same pattern as `planned_meals` in 0005).

## R2 — Fixed category set (FR-SH-019)

**Decision**: enum `shopping_category` with `PRODUCE, DAIRY, MEAT_SEAFOOD, CANNED,
FROZEN, BAKERY, PANTRY_STAPLES, OTHER`, default `OTHER`. Display order is the enum
order, "Other" last. A pure keyword categorizer (`categorize(name): ShoppingCategory`)
makes generated/manual items land in a sensible group (milk → DAIRY, chicken →
MEAT_SEAFOOD…); user can re-categorize any item. Misses default to OTHER — calm, never
wrong-looking. Alternative (free-text categories) rejected per clarification: fixed
built-in set, custom layouts deferred.

## R3 — Generation pipeline (FR-SH-010..012)

**Decision**: a pure function in `src/lib/shopping/generation.ts`:

```
computeBuyGaps(meals, fulfillmentInputs, range) → GapResult
  { ingredientGaps: [{ name, neededFor: [{recipeId,title}], suggestedQuantity, unit }],
    storeBoughtGaps: [{ plannedMealId, name, servings }] }
```

It calls the **existing** `deriveFulfillment` per meal (FR-SH-012 — single source of
truth; the list can never disagree with the calendar chips) and aggregates
MUST_ACQUIRE results: recipe meals contribute `missingIngredients` (deduped by
`normalizeName`, attributions merged); STORE_BOUGHT meals contribute one item each.
Quantity: when exactly one recipe needs the ingredient and that recipe row carries a
quantity, suggest it; otherwise quantity 1 + unit "x" (user-editable) — consistent
with the no-unit-math rule (spec Assumptions). Dedupe against the target list's
PENDING items by `normalizeName` (FR-SH-011).

Inputs are loaded with existing machinery: `planningService` range fetch +
`loadIngredientIndex` + `InventorySnapshot` — no new query shapes except reusing
`recipe_ingredients` reads.

## R4 — Replenishment merge rules (FR-SH-015..016)

**Decision**: real implementation replaces the reserved stub
`src/lib/pantry/shoppingListIntegration.ts` (`addPantryItemsFromShoppingList`), kept
at the same import path so the seam contract holds (FR-PI-008). Merge rule: an
existing pantry item matches when `normalizeName(name)` is equal **and**
`normalizeName(unit)` is equal → `quantity += purchased`; otherwise insert a new row
(units are free text; cross-unit addition would be invented math). New rows default
`storage_location = 'PANTRY'` unless the review step set one. Decline path: user can
skip replenishment entirely; list still completes (REQ-PM-011 is an *offer*).

## R5 — Store-bought completion (FR-SH-018)

**Decision**: for each CHECKED item with `source_planned_meal_id`:
1. Insert `prepped_meals` row: `origin = 'STORE_BOUGHT'` (enum exists since 0003),
   `name` = item name, portions = `max(1, round(servings))` of the source meal,
   `storage_location = 'FRIDGE'`, `prepared_date = today`,
   `expiration_date = today + 3 days` (editable in the review step; 3-day fridge
   default is conservative for ready-to-eat).
2. If the source meal still exists with `status = 'PLANNED'` and
   `source = 'STORE_BOUGHT'`: update it to `source = 'PREPPED'`,
   `prepped_meal_id = <new portion>`, `prepped_name_snapshot = name`,
   `store_bought_name = NULL` — satisfying `planned_meals_exactly_one_source`
   (0006's PREPPED arm requires the snapshot). The meal then derives HAVE_IT.
3. Otherwise (deleted / logged / already converted): create the portion, skip the
   link — per spec FR-SH-018.

These per-item operations are sequential client writes (online-first, P15); a partial
failure leaves correct-but-incomplete state the user can finish manually, and the
completion sheet reports any item that failed. Edge Functions were considered for
atomicity and rejected: no secrets/privilege involved, and the failure modes are
benign (P2 keeps us out of server code unless needed).

## R6 — Module & UI structure

**Decision** (mirrors planning/pantry conventions exactly):

- `src/lib/shopping/types.ts` — camelCase shapes mapped from generated DB types.
- `src/lib/shopping/shoppingService.ts` — PostgREST CRUD (lists + items).
- `src/lib/shopping/shoppingStore.svelte.ts` — module-level runes store, getter
  functions, optimistic check/uncheck with rollback (REQ-CN-003).
- `src/lib/shopping/generation.ts`, `categorize.ts`, `replenishment.ts` — pure logic
  + orchestration, unit-tested in the **server** vitest project (memory: browser
  project hangs in agent sandboxes; pure-TS coverage is the reliable lane).
- `src/lib/components/shopping/` — `ListsOverview.svelte`, `ShoppingListView.svelte`,
  `ItemRow.svelte`, `AddItemForm.svelte`, `GenerateListSheet.svelte`,
  `CompleteTripSheet.svelte`.
- `src/routes/shopping/+page.svelte` — route; `+layout.svelte` nav already has a
  muted "Shopping" entry with `href: null` → wire to `resolve('/shopping')`.

Design language: tokens + `.nk-*` primitives (P4); checked section uses the calm
collapsed pattern from Domain Spec §4.7; icons always paired with labels (REQ-AC-003).

## R7 — What stays out (confirmed)

Store layouts/sections entities, item photos, barcode scan, online ordering fields,
household sharing, FROM_PREP source — all deferred per spec/clarifications. The enum
`shopping_list_source` ships with only `MANUAL | FROM_PLAN`; adding `FROM_PREP` later
is an additive enum migration.
