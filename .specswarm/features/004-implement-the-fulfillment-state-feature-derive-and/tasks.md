# Tasks: Fulfillment State (HAVE_IT / CAN_MAKE_IT / MUST_ACQUIRE)

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md (2026-06-07) -->
<!-- No prohibited technologies found; no new technologies introduced -->

**Feature**: 004 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

User stories: **US1** = see fulfillment state on every calendar surface (REQ-MP-012);
**US2** = see missing ingredients for a "To get" recipe meal (FR-FS-006); **US3** = place a
prepped portion on the calendar so HAVE_IT is reachable (FR-FS-010/011).

Tests are required (constitution P12; spec success criteria demand automated coverage of
all derivation rules).

## Phase 1 — Setup & schema (blocking)

- [X] T001 Write migration adding `prepped_name_snapshot` to `planned_meals` and rewriting the `planned_meals_exactly_one_source` CHECK per data-model.md (PREPPED arm requires snapshot, `prepped_meal_id` stays nullable/SET NULL-safe; snapshot length CHECK 1..500; all other arms force the new column NULL) — supabase/migrations/0006_prepped_name_snapshot.sql
- [X] T002 Apply migration locally (`supabase migration up`, stack on ports 563xx) and regenerate types via `supabase gen types typescript --local > src/lib/database.types.ts`; verify `prepped_name_snapshot` appears in the generated `planned_meals` row type — src/lib/database.types.ts

## Phase 2 — Foundational types (blocking for US1–US3)

- [X] T003 Extend planning domain types: map `prepped_meal_id` → `preppedMealId` and `prepped_name_snapshot` → `preppedNameSnapshot` in `PlannedMeal` + `toPlannedMeal`; add PREPPED variant `{ source: 'PREPPED'; preppedMealId: string; preppedName: string; servings: number }` to `PlannedMealDraft`; `plannedMealName` PREPPED case returns `preppedNameSnapshot ?? 'Prepped meal'` — src/lib/planning/types.ts

## Phase 3 — US1: derive + display fulfillment state

- [X] T004 [US1] Create the pure derivation module: `FulfillmentState` union, `FulfillmentResult`, `IngredientForMatch`, `FulfillmentInputs`, `normalizeName()`, `buildPantryNameIndex(pantryItems)`, and `deriveFulfillment(meal, inputs)` implementing the rules in data-model.md (non-PLANNED → null, QUICK → null, PREPPED → HAVE_IT iff portion exists with portionsRemaining > 0 else MUST_ACQUIRE, STORE_BOUGHT → MUST_ACQUIRE, RECIPE → CAN_MAKE_IT iff every required ingredient or one of its substitutes is on hand, else MUST_ACQUIRE with `missingIngredients`; unknown/empty ingredient list → MUST_ACQUIRE; `ingredientsByRecipeId === null` → null per FR-FS-009) — src/lib/planning/fulfillment.ts
- [X] T005 [US1] Unit tests for the derivation module (server vitest project): all three states; QUICK and LOGGED/SKIPPED/SWAPPED → null; exhausted portion → MUST_ACQUIRE; deleted portion ref (preppedMealId null) → MUST_ACQUIRE; zero-ingredient recipe → MUST_ACQUIRE; optional ingredient missing does not block; substitute on hand satisfies base; name normalization (case/whitespace); missing-ingredient names listed; inputs-unavailable → null — src/lib/planning/fulfillment.spec.ts
- [X] T006 [P] [US1] Create the ingredient index: `loadIngredientIndex(recipeIds)` batch-fetches `recipe_ingredients` (`id, recipe_id, name, is_optional, substitute_for`) via one `.in('recipe_id', …)` query, maps to `IngredientForMatch`, caches per recipeId in a module map, skips already-cached ids; export `clearIngredientIndex()` for tests/reload — src/lib/planning/ingredientIndex.ts
- [X] T007 [US1] Wire fulfillment into the plan store: `loadFulfillmentInputs()` triggers `loadPantryItems()` / `loadPreppedMeals()` when those stores are empty and loads the ingredient index for the current range's distinct recipe ids (re-run on `loadRange`); export getter `fulfillmentFor(meal): FulfillmentResult | null` assembling inputs from live store getters; export new surface (fulfillment types + `fulfillmentFor` + `loadFulfillmentInputs`) from the feature index — src/lib/planning/planStore.svelte.ts, src/lib/planning/index.ts
- [X] T008 [US1] Add the fulfillment chip to the meal card (full + compact variants): icon + worded label per design tokens — HAVE_IT `ph-check-circle` "Have it" (primary-soft), CAN_MAKE_IT `ph-cooking-pot` "Can make it" (tile-soft), MUST_ACQUIRE `ph-basket` "To get" (`--attention` soft pair); chip omitted when `fulfillmentFor` returns null; make the PREPPED row in the SOURCE map real (label "Prepped", `ph-snowflake`); include state in the aria-label — src/lib/components/planning/MealCard.svelte
- [X] T009 [P] [US2] Show fulfillment in the detail sheet: state line (icon + label, same vocabulary) and, for RECIPE meals in MUST_ACQUIRE, a calm "Missing: …" list of `missingIngredients` (FR-FS-006, shame-free voice) — src/lib/components/planning/MealDetailSheet.svelte
- [X] T010 [US1] Kick off `loadFulfillmentInputs()` from the plan page alongside the existing range load so chips appear without user action — src/routes/plan/+page.svelte

## Phase 4 — US3: place a prepped portion (HAVE_IT end-to-end)

- [X] T011 [US3] Service + store support for PREPPED drafts: `draftColumns` PREPPED case writes `prepped_meal_id` + `prepped_name_snapshot`; optimistic meal shape in `addMeal` carries `preppedMealId` / `preppedNameSnapshot`; extend service spec for the PREPPED draft mapping and one-source integrity — src/lib/planning/planningService.ts, src/lib/planning/planStore.svelte.ts, src/lib/planning/planningService.spec.ts
- [X] T012 [US3] Add a "Prepped" tab to the add-meal sheet: lists `preppedMeals()` with `portions_remaining > 0` (name, portions remaining, storage location), loads the store when empty, empty-state copy when no portions exist, tap-to-select then "Add to plan" saving the PREPPED draft (servings default 1) — src/lib/components/planning/AddMealSheet.svelte

## Phase 5 — Polish & verification

- [X] T013 Run svelte-autofixer over the touched components and fix findings; `bun run format`; verify no raw colors / non-token values were introduced (P4) — src/lib/components/planning/
- [X] T014 Full verification: `bun run check`, `bun run lint`, `bun run test:unit -- --run`; walk quickstart.md manual scenarios 1–8 against the local stack; confirm `git diff supabase/` adds no fulfillment-state column (INV-PL-017) — .specswarm/features/004-implement-the-fulfillment-state-feature-derive-and/quickstart.md

## Dependencies

```
T001 → T002 → T003 → {US1: T004 → T005, T006 → T007 → T008/T009/T010}
                   → {US3: T011 → T012}   (T011 also needs T002/T003)
US1 ∥ US3 after T003 (different files except planStore: T007 before T011)
T013/T014 last
```

## Parallel opportunities

- After T003: T004+T005 (derivation) ∥ T006 (ingredient index) ∥ T011 service half.
- After T007: T008 ∥ T009 ∥ T010 ∥ T012 (different files).

## MVP scope

US1 alone (T001–T010) is a shippable increment: states visible for recipe/store-bought
meals. US3 (T011–T012) completes the Differentiator loop (HAVE_IT reachable).
