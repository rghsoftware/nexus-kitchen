# Research: Fulfillment State

## R1: How to make HAVE_IT deletion-safe (PREPPED references)

- **Decision**: Migration `0006_prepped_name_snapshot.sql` — add
  `prepped_name_snapshot text` to `planned_meals`; rewrite
  `planned_meals_exactly_one_source` so the PREPPED arm requires the snapshot and allows
  `prepped_meal_id` to be null.
- **Rationale**: The current CHECK requires `prepped_meal_id IS NOT NULL` for PREPPED rows
  while the FK is `ON DELETE SET NULL`. Postgres validates CHECK constraints on rows
  updated by referential actions, so deleting a referenced prepped meal would raise
  `check_violation` and block the delete. Feature 003 already solved the identical problem
  for RECIPE (FR-PL-019: required reference = `recipe_title_snapshot`, `recipe_id` is
  SET NULL-able). Mirroring that pattern keeps INV-PL-003 intact, makes deletion safe, and
  gives the meal a durable display name (FR-FS-011).
- **Alternatives considered**:
  - *Block deletion of referenced portions* — adds friction in pantry flows and couples
    features; rejected.
  - *ON DELETE CASCADE* — silently removes planned meals; violates the calm-UX principle
    (a plan entry disappearing without explanation); rejected.
  - *No migration, hope deletes never happen* — latent hard failure; rejected.

## R2: Where the derivation runs

- **Decision**: Pure client-side TypeScript module (`fulfillment.ts`), no I/O.
- **Rationale**: INV-PL-017 (derived, never stored); ADR-0001/P1 SPA architecture; the
  `InventorySnapshot` stub (FR-FC-003) was built for exactly this consumer; matches the
  existing client-derived-fields precedent (`isExpiringSoon`, `isRunningLow`).
- **Alternatives**: Postgres view / RPC — server compute adds round-trips per view change,
  can't see optimistic local state, and stores nothing anyway; rejected.

## R3: Ingredient availability matching

- **Decision** (clarified 2026-06-10): presence-by-name. Normalize
  `trim → lowercase → collapse whitespace` on both `recipe_ingredients.name` and
  `pantry_items.name`; a match with `quantity > 0` = on hand.
- **Rationale**: No master ingredient table exists (`ingredient_id` reserved on both
  tables); units are free-text and incomparable without invented conversion rules.
- **Alternatives**: quantity-aware (unit string-equality) and full unit conversion —
  deferred until a master-ingredient/unit model exists.

## R4: Optional ingredients and substitutes

- **Decision**: skip `is_optional = true` rows; a required ingredient is satisfied if its
  name OR the name of any same-recipe ingredient whose `substitute_for` points at it is on
  hand.
- **Rationale**: spec Assumptions; `substitute_for` semantics from feature 001
  (INV-RC-011: substitute references another ingredient in the same recipe).

## R5: Fetching ingredients for the loaded range

- **Decision**: one batched PostgREST query per range load —
  `from('recipe_ingredients').select('id,recipe_id,name,is_optional,substitute_for').in('recipe_id', distinctRecipeIds)`
  — cached in a module-level map keyed by recipeId.
- **Rationale**: avoids N+1 `getRecipe` calls; `recipe_ingredients` RLS already permits
  owner reads; the columns needed are a small projection.
- **Alternatives**: reuse `recipesRepository.getRecipe` per meal (N+1, heavy payload);
  embed ingredients in `listPlannedMeals` via FK joins (cross-feature query coupling) —
  both rejected.

## R6: Display vocabulary

- **Decision**: chips "Have it" (`ph-check-circle`), "Can make it" (`ph-cooking-pot`),
  "To get" (`ph-basket`); MUST_ACQUIRE styled with the warm `--attention` pair; states
  hidden for QUICK, non-PLANNED statuses, and while inventory is loading.
- **Rationale**: REQ-AC-003 / design system §6 (icon + label, never color alone);
  design system §3 (status is calm, never alarm-red); shame-free voice ("To get" is an
  action, not a reproach); Differentiator (the three states are the product's core lens).

## R7: When inventory loads

- **Decision**: the plan page triggers `loadPantryItems()` / `loadPreppedMeals()` when
  those stores are empty, alongside `loadRange`. Derivation reads live store state via
  getter functions, so later loads/edits flow through `$derived` automatically.
- **Rationale**: P15 online-first with cached reads; stores already expose load functions
  and reactive getters; no new realtime machinery (spec Assumptions).
