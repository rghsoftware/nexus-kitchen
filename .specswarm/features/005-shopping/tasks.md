# Tasks: Shopping — close the buy-gap

**Feature**: 005 | **Branch**: `005-shopping`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md (no new technologies; no prohibited tech) -->

User stories (from spec, priority order):

- **US1 (P1)** — Manage shopping lists & items manually: create/rename/archive lists,
  add/edit/remove items, category-grouped view. (FR-SH-001..006 partial, FR-SH-019)
- **US2 (P2)** — Generate a list from must-acquire gaps: range picker, missing
  ingredients + store-bought meals, dedupe + attribution. (FR-SH-009..014)
- **US3 (P3)** — The shopping trip: check/uncheck, checked section, unavailable.
  (FR-SH-006..008)
- **US4 (P4)** — Complete the trip: pantry replenishment, store-bought → prepped
  portion + auto-link, carry-over. (FR-SH-015..018)

## Phase 2: Foundational (blocks all stories)

- [ ] T001 Create migration with 4 enums, `shopping_lists` + `shopping_list_items` tables, CHECK-encoded invariants (INV-SH-002/003/004), indexes, RLS enable + owner/parent-list policies, `set_updated_at` triggers per data-model.md — supabase/migrations/0007_shopping.sql
- [ ] T002 Apply migration locally and regenerate generated DB types (`supabase gen types typescript --local`), verify new tables/enums present — src/lib/database.types.ts
- [ ] T003 Shopping domain types: enum aliases, `ShoppingList`/`ShoppingItem`/`NeededFor` app shapes, row→app mappers, insert/update input types per data-model.md — src/lib/shopping/types.ts
- [ ] T004 Shopping service: list CRUD (create/rename/archive/complete with `completed_at`), item CRUD (add/update/remove), status transitions (check sets `checked_at`, uncheck clears it, unavailable) per §5.3 state machine — src/lib/shopping/shoppingService.ts
- [ ] T005 Runes store: lists + active list + items state, getter functions, load/create/update actions following `planStore.svelte.ts` pattern; INV-SH-001 guard (deleting last pending item of an active list prompts archive) — src/lib/shopping/shoppingStore.svelte.ts
- [ ] T006 [P] Route page skeleton + nav wiring (`Shopping` entry `href: resolve('/shopping')`) — src/routes/shopping/+page.svelte, src/routes/+layout.svelte

## Phase 3: US1 — Manage lists & items (MVP)

- [ ] T007 [P] [US1] Pure keyword categorizer `categorize(name): ShoppingCategory` (8 fixed categories, default OTHER) + server-project unit tests — src/lib/shopping/categorize.ts, src/lib/shopping/categorize.spec.ts
- [ ] T008 [P] [US1] Lists overview: active-list card with item-count/progress, create-list form, recent (completed/archived) lists per Domain Spec §4.7 — src/lib/components/shopping/ListsOverview.svelte
- [ ] T009 [P] [US1] Manual add-item form: name/quantity/unit/category, positive-quantity guard (INV-SH-002), auto-category suggestion via `categorize()` — src/lib/components/shopping/AddItemForm.svelte
- [ ] T010 [P] [US1] Item row: name, quantity+unit, "For: …" attribution display, edit quantity/category, remove — src/lib/components/shopping/ItemRow.svelte
- [ ] T011 [US1] List view: pending items grouped by category in fixed enum order (FR-SH-019), composes ItemRow + AddItemForm — src/lib/components/shopping/ShoppingListView.svelte
- [ ] T012 [US1] Compose overview/list view on the route page; empty states; design tokens + `.nk-*` only — src/routes/shopping/+page.svelte
- [ ] T013 [US1] Server-project unit tests: row↔app mappers and service payload shapes (checked_at pairing, completed_at pairing) — src/lib/shopping/types.spec.ts

**Checkpoint**: create a list, add/edit/remove items, grouped display — independently testable.

## Phase 4: US2 — Generate from must-acquire gaps

- [ ] T014 [US2] Pure `computeBuyGaps(meals, fulfillmentInputs, existingPendingNames): GapResult` reusing `deriveFulfillment` (FR-SH-012): missing-ingredient aggregation deduped by `normalizeName`, merged `{recipeId,title}` attribution, quantity suggestion rules, STORE_BOUGHT gaps with `plannedMealId` — src/lib/shopping/generation.ts
- [ ] T015 [US2] Server-project tests for generation: dedupe across recipes, attribution merge, pending-name exclusion, QUICK/non-PLANNED ignored, store-bought gap rows, empty-gap result — src/lib/shopping/generation.spec.ts
- [ ] T016 [US2] Generate sheet: date-range picker defaulting today→+6 (FR-SH-014), loads range meals + fulfillment inputs via existing planning machinery, empty-gap calm success state (no list created, INV-SH-001) — src/lib/components/shopping/GenerateListSheet.svelte
- [ ] T017 [US2] Store action `generateFromPlan(range)`: create FROM_PLAN list with `generated_range_start/end`, bulk-insert gap items with category via `categorize()` and `source_planned_meal_id` for store-bought rows; dedupe into existing active generated list when user chooses — src/lib/shopping/shoppingStore.svelte.ts

**Checkpoint**: plan with gaps → generated, attributed, categorized list in ≤3 interactions.

## Phase 5: US3 — The shopping trip

- [ ] T018 [US3] Optimistic check/uncheck/unavailable store actions with rollback (REQ-CN-003); list status ACTIVE→SHOPPING on first check — src/lib/shopping/shoppingStore.svelte.ts
- [ ] T019 [US3] Trip UI: checkbox interactions on ItemRow, collapsible "Checked" section that items move to without disappearing (FR-SH-008), progress indicator on ShoppingListView, "couldn't find it" (unavailable) affordance — src/lib/components/shopping/ItemRow.svelte, src/lib/components/shopping/ShoppingListView.svelte

**Checkpoint**: full trip flow minus completion — independently testable.

## Phase 6: US4 — Complete the trip (replenish + close the loop)

- [ ] T020 [P] [US4] Pure `planReplenishment(checkedItems, pantryItems)`: merge on (normalized name, normalized unit) → quantity add, else insert with storage-location default; server-project tests incl. unit-mismatch insert — src/lib/shopping/replenishment.ts, src/lib/shopping/replenishment.spec.ts
- [ ] T021 [P] [US4] Implement the reserved pantry seam `addPantryItemsFromShoppingList` (replace no-op body; same signature/path, FR-PI-008): inserts + merges via pantryService — src/lib/pantry/shoppingListIntegration.ts
- [ ] T022 [US4] `completeTrip()` orchestration in replenishment.ts + service support: store-bought items → `addPreppedMeal` (origin STORE_BOUGHT, fridge, today+3d default expiry, portions from meal servings) then convert source planned meal to PREPPED (set `prepped_meal_id` + `prepped_name_snapshot`, null `store_bought_name`) only when still PLANNED/STORE_BOUGHT (FR-SH-018); list → COMPLETED with `completed_at`; per-item failure report — src/lib/shopping/replenishment.ts, src/lib/shopping/shoppingService.ts
- [ ] T023 [US4] Complete-trip sheet: review checked items (qty/location, store-bought portions/expiry editable), decline path (complete without replenishing), carry-over offer for PENDING/UNAVAILABLE items to new/existing active list (FR-SH-017), failure reporting — src/lib/components/shopping/CompleteTripSheet.svelte

**Checkpoint**: end-to-end loop — buy gaps → shop → pantry replenished → calendar flips to Can make it / Have it.

## Phase 7: Polish & verification

- [ ] T024 Public exports barrel + `bun run check` + `bun run lint` + `bun run test:unit -- --run` all green; fix fallout — src/lib/shopping/index.ts
- [ ] T025 Manual quickstart verification (quickstart.md loop) incl. responsive mobile layout and a11y pass (labels paired with icons, focus order in sheets) — .specswarm/features/005-shopping/quickstart.md

## Dependencies

- T001 → T002 → T003 → T004 → T005; T006 after T003.
- US1 (T007–T013) after Foundational; T007–T010 parallel; T011 after T009/T010; T012 after T008/T011.
- US2 (T014–T017) after US1 checkpoint; T014 → T015/T016/T017.
- US3 (T018–T019) after US1; independent of US2.
- US4 (T020–T023) after US3 (needs checked items); T020/T021 parallel; T022 after T020; T023 after T022.
- T024–T025 last.

## Implementation strategy

MVP = Foundational + US1. Each story checkpoint is independently testable; US2 and US3
are parallelizable streams after US1. Pure logic (T007, T013, T014–T015, T020) is
server-vitest-covered; UI verified manually (memory: browser project hangs in sandboxes).
