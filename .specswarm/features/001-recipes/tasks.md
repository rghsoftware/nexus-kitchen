# Tasks: Recipe Management (001-recipes)

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md -->
<!-- No prohibited technologies found; no new dependencies introduced -->

**Feature:** Recipe Management · **Branch:** `001-recipes`
**Inputs:** spec.md, plan.md, research.md, data-model.md, contracts/recipes-repository.md

Tests are included: the project constitution P12 (`expect.requireAssertions`) and success
criteria SC-003 (100% invariant enforcement) / SC-004 (RLS isolation) require them.

> **HARD DEPENDENCY CHAIN:** migration+types (Phase 2) → repository/store (Phase 2) →
> components (Phase 3+) → routes (Phase 3+). No UI/component task may run parallel to the
> migration/types task. `[P]` marks tasks that touch different files and have no ordering
> dependency _within the same phase_.

---

## Phase 1: Setup

- [x] T001 Create feature directory scaffolding for `src/lib/recipes/`, `src/lib/session/`, `src/lib/components/recipes/`, and `src/routes/recipes/` (empty index/barrel where useful) — src/lib/recipes/index.ts

## Phase 2: Foundational (BLOCKING — must complete before any user story)

- [x] T002 Author the recipes migration: all 5 tables (`recipes`, `recipe_ingredients`, `recipe_steps`, `recipe_tags`, `user_recipe_meta`) with UUID PKs, CHECK constraints, generated `total_time_minutes`, unique `(recipe_id, sort_order)` indexes, `set_updated_at` triggers, **`ENABLE ROW LEVEL SECURITY` + explicit policies on every table** (owner-scoped for recipes/user_recipe_meta; parent-EXISTS for the 3 children), the private `recipe-images` Storage bucket + owner-prefix policies, and the optional `create_recipe_with_children` / `update_recipe_with_children` SECURITY INVOKER RPC. Per data-model.md. — supabase/migrations/0001_recipes.sql
- [x] T003 Hand-author `database.types.ts` matching the migration EXACTLY (same logical unit as T002 to prevent drift); header-comment it as a stand-in to be regenerated via `supabase gen types`. — src/lib/database.types.ts
- [x] T004 [P] Define recipe domain types (`Recipe`, `RecipeIngredient`, `RecipeStep`, `RecipeTag`, `UserRecipeMeta`, `RecipeWithDetail`, `RecipeInput`, `TagCategory`, `NutritionInfo`) per contracts. — src/lib/recipes/types.ts
- [x] T005 [P] Implement pure serving-scale logic (`scaleQuantity`, `scaleIngredients` by `target/base`, display-only, no mutation). — src/lib/recipes/recipeScaling.ts
- [x] T006 [P] Implement client validation for recipe invariants (≥1 ingredient INV-RC-001, ≥1 step INV-RC-002, servings 1–100, quantity>0, active≤total, rating 1–5, substitute_for within set INV-RC-011) returning shame-free messages. — src/lib/recipes/recipeValidation.ts
- [x] T007 Implement session bootstrap: `ensureSession()` calling `supabase.auth.signInAnonymously()` when no session, plus a runes-based current-user accessor; graceful shame-free error if anonymous sign-in is disabled. — src/lib/session/session.svelte.ts
- [x] T008 Implement `recipesRepository` (list, get, create, update, delete, setFavorite, setRating, uploadRecipeImage) over supabase-js/PostgREST per contract; prefer the RPC for atomic create/update; typed errors, no silent fallback. Depends on T003/T004. — src/lib/recipes/recipesRepository.ts
- [x] T009 Implement `recipesStore.svelte.ts` runes store: library list + per-recipe cache, optimistic favorite/rating/edit with server reconciliation + rollback (online-first, P15). Depends on T008. — src/lib/recipes/recipesStore.svelte.ts

### Foundational tests

- [x] T010 [P] Unit tests for `recipeScaling` (scales up/down, fractional, zero-guard, no mutation — SC-006). — src/lib/recipes/recipeScaling.spec.ts
- [x] T011 [P] Unit tests for `recipeValidation` covering every invariant pass/fail (SC-003). — src/lib/recipes/recipeValidation.spec.ts

**Checkpoint:** schema + types + data layer ready; pure logic tested. User stories can begin.

---

## Phase 3: US1 — Create a recipe (manual entry) [P1, MVP]

**Goal:** A user can create a complete recipe and have it persist. **Independent test:** create a
recipe with ≥1 ingredient + ≥1 step; it is saved and retrievable (SC-001).

- [x] T012 [P] [US1] Build `IngredientEditor.svelte` (add/remove/reorder rows; name/qty/unit/prep/optional; runes; `.nk-*` tokens; ≥44px taps). — src/lib/components/recipes/IngredientEditor.svelte
- [x] T013 [P] [US1] Build `StepEditor.svelte` (add/remove/reorder ordered steps; instruction + optional duration/timer/label; runes; tokens). — src/lib/components/recipes/StepEditor.svelte
- [x] T014 [US1] Build `RecipeForm.svelte` (shared create/edit): core fields + tags + meal types + single image upload; integrates IngredientEditor/StepEditor + `recipeValidation`; calls store create. Depends on T012/T013. — src/lib/components/recipes/RecipeForm.svelte
- [x] T015 [US1] Add the create route `/recipes/new` rendering `RecipeForm` and navigating to the new recipe on save. Depends on T014. — src/routes/recipes/new/+page.svelte
- [x] T016 [P] [US1] Component test: RecipeForm rejects 0-ingredient / 0-step / invalid input and submits a valid recipe (asserts store.create called with expected shape). — src/lib/components/recipes/RecipeForm.svelte.spec.ts

**Checkpoint:** recipes can be created. ✅ MVP increment.

---

## Phase 4: US2 — Browse, search & filter the library [P2]

**Goal:** A user sees their recipes and can search/filter. **Independent test:** seeded recipes
appear; search + chips narrow results; empty/no-results states show (FR-011/012/013).

- [x] T017 [P] [US2] Build `RecipeCard.svelte` (image or `.nk-tile` fallback, title, total time, favorite + rating badges; links to detail). — src/lib/components/recipes/RecipeCard.svelte
- [x] T018 [P] [US2] Build `RecipeFilters.svelte` (All / Favorites / Quick <30 min / tag chips via `.nk-chip`). — src/lib/components/recipes/RecipeFilters.svelte
- [x] T019 [US2] Add the library route `/recipes` (`+page.svelte`): loads via store on mount (after `ensureSession`), client-side search (<500 ms, SC-002) + filter, grid of `RecipeCard`, empty + no-results states (shame-free copy). Depends on T017/T018/T009. — src/routes/recipes/+page.svelte
- [x] T020 [P] [US2] Component test: library filters + search narrow the rendered set; empty state renders with zero recipes. — src/routes/recipes/page.svelte.spec.ts

**Checkpoint:** library browsable, searchable, filterable.

---

## Phase 5: US3 — Recipe detail with serving scale [P3]

**Goal:** A user views full detail and rescales servings (display-only). **Independent test:**
open a recipe → Ingredients/Instructions tabs render; changing servings rescales quantities
without persisting (FR-015/016, SC-006).

- [x] T021 [P] [US3] Build `ServingScaler.svelte` (serving-count control; emits target servings; uses `recipeScaling`). — src/lib/components/recipes/ServingScaler.svelte
- [x] T022 [US3] Add the detail route `/recipes/[id]` (`+page.svelte`): header (image/tile, title, rating, total time, servings, tags) + tabbed Ingredients (with `ServingScaler`) / Instructions; loads via store.get. Depends on T021/T009. — src/routes/recipes/[id]/+page.svelte
- [x] T023 [P] [US3] Component test: detail renders ordered ingredients/steps; scaling updates displayed quantities and does not mutate the stored recipe. — src/routes/recipes/detail.svelte.spec.ts

**Checkpoint:** detail view + scaling work.

---

## Phase 6: US4 — Favorite & rate [P4]

**Goal:** A user favorites and rates recipes; state persists per user. **Independent test:**
toggle favorite + set rating; reload shows persisted state (FR-008/009).

- [x] T024 [P] [US4] Build `RatingControl.svelte` (1–5 rating using `.nk-rating` vocabulary; text-labeled, accessible). — src/lib/components/recipes/RatingControl.svelte
- [x] T025 [US4] Wire favorite toggle + `RatingControl` into detail (T022) and favorite badge into card (T017) via store optimistic `setFavorite`/`setRating` (upsert `user_recipe_meta`). Depends on T024. — src/routes/recipes/[id]/+page.svelte
- [x] T026 [P] [US4] Component test: rating control enforces 1–5 and calls store.setRating; favorite toggle calls store.setFavorite optimistically. — src/lib/components/recipes/RatingControl.svelte.spec.ts

**Checkpoint:** per-user favorite/rating persist.

---

## Phase 7: US5 — Edit & delete [P5]

**Goal:** A user edits (incl. add/remove/reorder ingredients & steps) and deletes recipes.
**Independent test:** edit a recipe and persist changes; delete with confirmation removes it +
children (FR-006/007, SC-005).

- [x] T027 [US5] Add the edit route `/recipes/[id]/edit` reusing `RecipeForm` prefilled from store.get; saves via store.update (diff/replace children preserving unique sort orders). Depends on T014/T009. — src/routes/recipes/[id]/edit/+page.svelte
- [x] T028 [US5] Add delete action with shame-free confirmation on the detail route; calls store.delete and returns to the library. — src/routes/recipes/[id]/+page.svelte
- [x] T029 [P] [US5] Component test: edit reorders ingredients/steps and submits updated shape; delete confirmation triggers store.delete. — src/lib/components/recipes/RecipeForm.edit.svelte.spec.ts

**Checkpoint:** full CRUD complete.

---

## Phase 8: Polish & cross-cutting

- [x] T030 Add nav entry/link to `/recipes` and ensure routes mount under the SPA layout (ssr stays false). — src/routes/+layout.svelte
- [x] T031 [P] RLS verification: SQL test (or documented pgTAP/manual script) proving a second anonymous user cannot SELECT/UPDATE/DELETE the first user's recipes or children (SC-004). — supabase/tests/recipes_rls.test.sql
- [x] T032 [P] Map repository constraint errors to friendly, shame-free UI messages; verify no `{@html}`, no raw hex (P4/P5), and design-token usage across new components. — src/lib/recipes/recipeErrors.ts
- [x] T033 Run `bun run format`, `bun run check`, `bun run lint`, `bun run test:unit`; fix any failures. — (repo-wide)

---

## Dependencies (story completion order)

```
Setup(T001) → Foundational(T002→T003→{T004,T005,T006}, T007, T008→T009, tests T010/T011)
   → US1(T012,T013→T014→T015, T016)
   → US2(T017,T018→T019, T020)
   → US3(T021→T022, T023)
   → US4(T024→T025, T026)
   → US5(T027,T028, T029)
   → Polish(T030, T031, T032, T033)
```

- T002 (migration) and T003 (types) are sequential and gate everything. **No component/route
  task may begin until T003 is complete.**
- US1–US5 are independently testable increments; US1 is the MVP.
- `[P]` tasks within a phase touch distinct files and may run in parallel once their phase's
  prerequisites are met.

## Parallel execution examples

- After T003: run T004, T005, T006 in parallel; T010/T011 follow their modules.
- Within US2: T017 and T018 in parallel, then T019 wires them.

## Implementation strategy

MVP = Setup + Foundational + US1 (create). Ship-incrementally by completing one user-story phase
at a time; each ends at a testable checkpoint.

> The canonical `- [ ] T###` checkbox lines in the phase sections above are the single source of
> truth for completion (read by the `tasks-completion-detector` hook). Flip them to `- [X]` as
> tasks finish.
