# Tasks: Meal Prep — Batch Sessions & Make-Ahead Integrations

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md (no version bump — zero new tech) -->
<!-- No prohibited technologies found -->

**Feature**: 006-meal-prep
**Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md) · **Data model**: [data-model.md](./data-model.md)

Legend: `[P]` parallelizable (different files, no ordering dep) · `[US#]` user story.
MVP = User Story 1 (batch session core → yield → HAVE_IT).

---

## Phase 1 — Setup & Schema (foundational; blocks all stories)

- [X] T001 Write migration `supabase/migrations/0009_meal_prep_sessions.sql` — `meal_prep_session_status` enum; `meal_prep_sessions` + `meal_prep_session_recipes` tables with all columns, CHECKs (INV-PL-007, INV-PL-008 completed⟺completed_at, UNIQUE(session,recipe)), indexes, and `updated_at` touch trigger per data-model.md — supabase/migrations/0009_meal_prep_sessions.sql
- [X] T002 In the same migration, enable RLS (P7 default-deny) with owner-scoped policies for both tables and add explicit Data API grants (authenticated CRUD, service_role ALL, anon SELECT) per the project grant-flip convention — supabase/migrations/0009_meal_prep_sessions.sql
- [X] T003 Write the shopping `FROM_PREP` change as TWO migrations (the new enum value must be committed before any DDL references it): `0010_shopping_from_prep_enum.sql` (`ALTER TYPE shopping_list_source ADD VALUE IF NOT EXISTS 'FROM_PREP'`) and `0011_shopping_from_prep_link.sql` (`shopping_lists.meal_prep_session_id` FK ON DELETE SET NULL + `shopping_lists_from_prep_has_session` CHECK, INV-XD-004) — supabase/migrations/0010_shopping_from_prep_enum.sql, supabase/migrations/0011_shopping_from_prep_link.sql
- [X] T004 Apply migrations to the local stack and regenerate types from this worktree: `supabase gen types typescript --local > src/lib/database.types.ts` (verify the two new tables + `FROM_PREP`/`meal_prep_session_id` appear) — src/lib/database.types.ts

**Checkpoint:** schema + types exist; PostgREST can see both tables under RLS.

---

## Phase 2 — Direct-entry first (small): FIX portion creation + verify → HAVE_IT

Empirical testing found `addPreppedMeal()` throws against a real DB (positive `INITIALIZED` event
forbidden by client guard + DB CHECK + INV-INV-011). Fix it (Design A) — this is the foundational
seam batch-yield reuses. Then verify the make-ahead path (FR-PP-001/002).

- [X] T005 [US0] Fix `src/lib/pantry/preppedMealService.ts` `addPreppedMeal()` — remove the positive `INITIALIZED` `insertPortionEvent` call (and the now-redundant re-fetch); the row insert already sets `portions_remaining = original_portions`. Keep returning the inserted row mapped via `toPreppedMeal` (Design A; INV-INV-011/INV-CC-006) — src/lib/pantry/preppedMealService.ts
- [X] T006 [US0] Update `src/lib/pantry/preppedMealService.spec.ts` — replace the "calls insertPortionEvent with kind INITIALIZED" expectation with "does NOT fire a positive INITIALIZED event on add"; keep CONSUMED/ADJUSTED expectations — src/lib/pantry/preppedMealService.spec.ts
- [X] T007 [P] [US0] Add a **non-mocked** pgTAP test that creating a prepped portion (direct INSERT into `prepped_meals`) succeeds with `portions_remaining > 0` and that a positive `INITIALIZED` `portion_events` row is rejected by the constraint (locks the invariant the mock was hiding) — supabase/tests/portion_creation.test.sql
- [X] T008 [P] [US0] Regression test: a `DIRECT_ENTRY`/`STORE_BOUGHT` prepped portion with `portions_remaining > 0`, referenced by a PREPPED planned meal, derives `HAVE_IT` (`src/lib/planning/fulfillment.ts`) — src/lib/planning/fulfillment.haveit.spec.ts
- [X] T009 [P] [US0] Confirm a prepped portion is selectable as a PREPPED source when placing a planned meal (feature-004 picker); if missing in this branch, implement the minimal selector — src/lib/planning/preppedPicker.spec.ts

**Checkpoint:** prepped-portion creation actually works against a real DB; direct-entry → HAVE_IT regression-locked. This unblocks batch-yield (which reuses the fixed seam).

---

## Phase 3 — User Story 1 (P1): Batch session core → yield to inventory

**Goal:** create a session of recipes+servings, schedule a prep day, complete it to yield
`PREP_SESSION` portions into inventory, or cancel it. **Independent test:** create session → complete →
N portions appear in Pantry→Prepped with valid eat-by dates → place one → day reads HAVE_IT.

- [X] T010 [US1] Create `src/lib/planning/mealPrep/types.ts` — `MealPrepSession(Status)`, `MealPrepSessionRecipe`, `NewMealPrepSession`, `YieldChoice`, `PrepShoppingGapItem`, and row→type mappers per data-model.md — src/lib/planning/mealPrep/types.ts
- [X] T011 [US1] Implement `src/lib/planning/mealPrep/mealPrepService.ts` CRUD: `createSession` (rejects 0 recipes — INV-PL-006 — and servings ≤ 0 — INV-PL-007), `getSessions`/`getSession`, `addRecipe`/`removeRecipe` (reject removing last), `updateServings`, `setPrepDay` (no past date), `cancelSession`; `MealPrepServiceError` mirroring `PreppedMealServiceError` — src/lib/planning/mealPrep/mealPrepService.ts
- [X] T012 [US1] Implement `completeSession(sessionId, yields)` in the same service: idempotency guard (skip if `prepped_meals` already linked to the session), yield one portion per recipe via the **fixed** `addPreppedMeal()` (origin=PREP_SESSION, recipe_id/recipe_name, meal_prep_session_id, portions_remaining=original_portions=servingsToPrep, FROZEN for freezer, expiration from storage shelf-life), then set status=COMPLETED/completed_at (FR-PP-014/015/016, P14) — src/lib/planning/mealPrep/mealPrepService.ts
- [X] T013 [P] [US1] Add `src/lib/planning/mealPrep/prepDay.ts` — pure `suggestPrepDay(today)` returning the nearest upcoming Sat/Sun, and a `isNotPast(date)` guard (REQ-PP-003/004, research D6) — src/lib/planning/mealPrep/prepDay.ts
- [X] T014 [US1] Implement `src/lib/planning/mealPrep/mealPrepStore.svelte.ts` (runes) — `sessions()/sessionsLoading()/sessionsError()/loadSessions()` plus optimistic `create/complete/cancel/addRecipe/removeRecipe`; after complete, trigger `loadPreppedMeals()` so the Prepped tab refreshes — src/lib/planning/mealPrep/mealPrepStore.svelte.ts
- [X] T015 [P] [US1] Unit tests for `mealPrepService` (node project): create-with-0-recipes rejected, servings ≤ 0 rejected, remove-last-recipe rejected, complete yields N portions with correct fields, **re-complete yields no duplicates** (idempotency), cancel creates no portions — src/lib/planning/mealPrep/mealPrepService.spec.ts
- [X] T016 [P] [US1] Unit tests for `prepDay.ts` (weekend suggestion edge cases incl. today-is-weekend; past-date rejection) — src/lib/planning/mealPrep/prepDay.spec.ts
- [X] T017 [US1] Build `MealPrepSessionForm.svelte` — recipe multi-select with per-recipe servings stepper and prep-day picker (defaulted via `suggestPrepDay`); design tokens only (P4), runes (P3); validates ≥1 recipe & servings > 0 — src/lib/components/planning/mealPrep/MealPrepSessionForm.svelte
- [X] T018 [P] [US1] Build `MealPrepSessionCard.svelte` (status, prep day, recipe lines) and `MealPrepOverview.svelte` (list + empty state + "New session") — src/lib/components/planning/mealPrep/MealPrepSessionCard.svelte
- [X] T019 [US1] Build `CompleteSessionDialog.svelte` — per-recipe fridge/freezer choice (session-level default, per-line override) calling `optimisticCompleteSession`; shame-free copy (P13) — src/lib/components/planning/mealPrep/CompleteSessionDialog.svelte
- [X] T020 [US1] Enable the disabled "Start a prep session" button in `src/lib/components/pantry/PreppedMealOverview.svelte` to open the session flow (remove `aria-disabled`/"coming soon") — src/lib/components/pantry/PreppedMealOverview.svelte
- [X] T021 [P] [US1] Component tests (client/chromium project) for `MealPrepSessionForm` (validation) and `CompleteSessionDialog` (yield call shape) — src/lib/components/planning/mealPrep/MealPrepSessionForm.svelte.spec.ts
- [X] T022 [P] [US1] pgTAP RLS test: owner-only SELECT/INSERT/UPDATE/DELETE on `meal_prep_sessions` + `meal_prep_session_recipes`, and anon sees zero rows (P7) — supabase/tests/meal_prep_rls.test.sql

**Checkpoint (MVP):** a user can batch-create, complete (yield), and cancel sessions; yielded portions read HAVE_IT.

---

## Phase 4 — User Story 2 (P2): Prep → shopping list

**Goal:** from a planned session, generate a `FROM_PREP` shopping list of the ingredient gap.
**Independent test:** session with 2 recipes → build list → only not-on-hand items, each annotated by recipe.

- [X] T023 [P] [US2] Implement pure `src/lib/planning/mealPrep/prepShoppingList.ts` — `computePrepShoppingGap(recipes, pantryIndex)`: scale by `servingsToPrep/baseServings`, aggregate by (normName, unit), drop optional ingredients + pantry-present names, annotate `forRecipes` (research D4) — src/lib/planning/mealPrep/prepShoppingList.ts
- [X] T024 [P] [US2] Unit tests for `computePrepShoppingGap` — scaling math, multi-recipe aggregation, pantry-present drop, optional-ingredient exclusion, forRecipes annotation — src/lib/planning/mealPrep/prepShoppingList.spec.ts
- [X] T025 [US2] Add `generatePrepShoppingList(sessionId)` to `mealPrepService.ts` — load recipe ingredients + pantry index, call `computePrepShoppingGap`, write `shopping_lists` (source_type=FROM_PREP, meal_prep_session_id) + `shopping_list_items` reusing the shopping service insert path; available while PLANNED (FR-PP-020..023) — src/lib/planning/mealPrep/mealPrepService.ts
- [X] T026 [US2] Add a "Build shopping list" action to `MealPrepSessionCard`/overview wired to `generatePrepShoppingList`, surfacing the resulting list under Shopping — src/lib/components/planning/mealPrep/MealPrepSessionCard.svelte
- [X] T027 [P] [US2] Service test for `generatePrepShoppingList` — writes a FROM_PREP list referencing the session with the expected gap items (INV-XD-004) — src/lib/planning/mealPrep/prepShoppingList.service.spec.ts

**Checkpoint:** prep sessions produce a correct shopping list for missing ingredients.

---

## Phase 5 — User Story 3 (P3): Planning prepped preview + decrement regression

**Goal:** surface prepped inventory as a passive, expiration-aware suggestion in planning (non-forcing)
and regression-guard auto-decrement for PREP_SESSION portions. **Independent test:** preview lists
prepped portions with expiry; logging a session-origin meal drops its portion count.

- [X] T028 [P] [US3] Add a passive prepped-inventory preview (expiration indicators, non-forcing — REQ-PP-025/026) to the planning surface, reusing `preppedMealStore` data — src/lib/components/planning/PreppedSuggestionPreview.svelte
- [X] T029 [P] [US3] Regression test for the session-yield consume lifecycle: a `PREP_SESSION`-origin portion derives HAVE_IT while remaining > 0 and MUST_ACQUIRE once consumed to 0 (the consume/decrement seam; INV-XD-003). Auto-decrement-on-meal-log (REQ-PP-027) is deferred with the unbuilt meal-logging feature — src/lib/planning/preppedDecrement.spec.ts
- [X] T030 [P] [US3] Component test for `PreppedSuggestionPreview` (renders expiry, never auto-selects) — src/lib/components/planning/PreppedSuggestionPreview.svelte.spec.ts

**Checkpoint:** planning shows prepped portions as a suggestion; decrement-on-log holds for session yields.

---

## Phase 6 — Polish & cross-cutting

- [X] T031 Run `bun run format` then `bun run lint` and fix all prettier/eslint issues in new files — (repo-wide)
- [X] T032 Run `bun run check` (svelte-kit sync + svelte-check) and resolve type errors against the regenerated `database.types.ts` — (repo-wide)
- [X] T033 Run `bun run test:unit --run` (node + chromium projects) and `supabase test db` (pgTAP); ensure all new + existing suites pass (SC-006, P12 every test asserts) — (repo-wide)
- [X] T034 [P] Export new public modules via `src/lib/index.ts` barrel where consistent with the existing pattern, and confirm the quickstart steps work end-to-end — src/lib/index.ts

---

## Dependencies & ordering

- **Phase 1 (T001–T004)** blocks everything (schema + types).
- **Phase 2 (T005–T009)** — the portion-creation fix (T005/T006/T007) is foundational and unblocks
  batch-yield; the HAVE_IT/picker checks (T008/T009) depend only on existing code and can run
  alongside Phase 1.
- **US1 (T010–T022)** depends on Phase 1 + the T005 fix. Within US1: T010 → T011 → T012; T013/T016
  parallel; store T014 after T011/T012; UI T017–T020 after types/store; tests T015/T021/T022 parallel
  once their targets exist.
- **US2 (T023–T027)** depends on US1 service + Phase 1 schema (FROM_PREP). T023/T024 pure, parallel-first.
- **US3 (T028–T030)** depends on Phase 1 + existing prepped/planning stores; independent of US2.
- **Phase 6** last.

## Parallel execution examples
- Kick off T008/T009 (Phase 2 checks) alongside T001–T003 (migrations) — different files.
- Within US1: T013 (prepDay) ‖ T015/T016 test scaffolds ‖ T018 (card/overview) once T010 lands.
- US2 pure logic T023 ‖ T024 can be written before T025 wires the service.

## Implementation strategy
1. **Foundation = Phase 1 + the T005 portion-creation fix** — without it, no prepped portion can be
   created at all (direct-entry or batch).
2. Ship **MVP = Phase 1 + Phase 2 + US1**: batch sessions yield portions that read HAVE_IT — the
   make-ahead loop closes.
3. Add **US2** (prep→shopping) and **US3** (planning preview) as independent increments.
4. **Polish** (Phase 6) before `/ss:ship`.
