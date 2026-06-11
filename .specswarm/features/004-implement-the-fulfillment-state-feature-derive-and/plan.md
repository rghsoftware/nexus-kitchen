# Implementation Plan: Fulfillment State (HAVE_IT / CAN_MAKE_IT / MUST_ACQUIRE)

**Feature**: 004 | **Branch**: `004-implement-the-fulfillment-state-feature-derive-and`
**Spec**: [spec.md](./spec.md) | **Created**: 2026-06-10

## Summary

Derive and display the fulfillment state of every planned meal (REQ-MP-012, INV-PL-017),
and enable placing prepped portions on the calendar (PREPPED source) so HAVE_IT is
reachable end-to-end. Pure client-side derivation over the existing `InventorySnapshot`
plus a batch-fetched recipe-ingredient index; one small migration to give PREPPED the same
deletion-safe name-snapshot pattern RECIPE already has.

## Technical Context

- **Language/Framework**: TypeScript (strict), SvelteKit SPA, Svelte 5 runes (P1/P3).
- **Data access**: supabase-js / PostgREST under RLS (existing pattern in
  `planningService.ts`). No Edge Functions needed — derivation is pure client compute.
- **State**: module-level runes stores with getter functions (existing pattern:
  `planStore.svelte.ts`, `pantryStore.svelte.ts`, `preppedMealStore.svelte.ts`).
- **Styling**: design tokens + `.nk-*` primitives only (P4); Phosphor icons paired with
  text labels (REQ-AC-003); calm `--attention` for MUST_ACQUIRE, never alarm-red.
- **Testing**: vitest, two projects. Derivation logic is pure TS → server project
  (node). Component behavior covered where the existing components have coverage.
- **No new dependencies.** Everything uses the approved stack.

## Tech Stack Compliance Report

### ✅ Approved Technologies (already in stack)
SvelteKit/Svelte 5, TypeScript, supabase-js, Tailwind v4 + design tokens, Vitest, Playwright.

### ➕ New Technologies (auto-added)
None.

### ⚠️ Conflicting / ❌ Prohibited
None.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| P1/P2 SPA only, no server files | ✅ | Pure client derivation; no new routes/server files |
| P3 Runes mode | ✅ | New reactive state uses `$state`/`$derived` getter-function pattern |
| P4 Design tokens | ✅ | Chip styles use `var(--token)` semantic aliases only |
| P5 No unsanitized HTML | ✅ | No `{@html}` anywhere in this feature |
| P7 RLS default-deny | ✅ | No new tables; migration alters `planned_meals` (RLS already enabled) |
| P8/P9 UUID PKs, timestamptz | ✅ | No new tables/columns of these kinds (one text snapshot column) |
| P13 No clinical labels | ✅ | Labels: "Have it" / "Can make it" / "To get" — calm, non-clinical |
| P14 Append-only records | ✅ | Portion ledger untouched; read-only consumption |
| P15 Online-first, server authoritative | ✅ | Derivation from current cached inventory; optimistic add for PREPPED placement follows existing rollback pattern |
| **INV-PL-017 derived, never stored** | ✅ | FulfillmentState is a client-side union; the migration adds a *name snapshot*, never a state column |

**Gate result: PASS** — no violations, no justifications needed.

## Design Decisions (see research.md for rationale)

1. **D1 — Migration 0006 `prepped_name_snapshot`**: `planned_meals` gains
   `prepped_name_snapshot text`, and the exactly-one-source CHECK is rewritten so PREPPED
   requires the snapshot (not the id), mirroring RECIPE's FR-PL-019 pattern. Without this,
   the existing `ON DELETE SET NULL` on `prepped_meal_id` would violate the current CHECK
   (`source='PREPPED' AND prepped_meal_id IS NOT NULL`) the moment a referenced portion is
   deleted — Postgres validates CHECKs on referential-action updates, so portion deletion
   would hard-fail. The snapshot also gives PREPPED meals a durable display name (FR-FS-011).
2. **D2 — Pure derivation module** `src/lib/planning/fulfillment.ts`: a pure function
   `deriveFulfillment(meal, inputs)` with no I/O, unit-tested in the server vitest project.
   Inputs: an inventory index (built once per snapshot) + a recipe-ingredient map.
3. **D3 — Batch ingredient fetch + cache** `src/lib/planning/ingredientIndex.ts`: one
   PostgREST query `recipe_ingredients.in('recipe_id', distinctIds)` per loaded range;
   module-level cache keyed by recipeId, invalidated on range reload.
4. **D4 — Name normalization**: `name.trim().toLowerCase().replace(/\s+/g, ' ')` shared by
   both sides of the pantry match (per clarification: presence-by-name, quantity > 0).
5. **D5 — Substitutes**: a required ingredient is satisfied if its own name OR the name of
   any ingredient that lists it as `substitute_for` target is on hand; `is_optional` rows
   are skipped entirely (spec Assumptions).
6. **D6 — Display**: extend `MealCard` (chip + compact dot-with-label treatment) and
   `MealDetailSheet` (state line + missing-ingredients list). Fulfillment chip omitted when
   inventory not loaded (FR-FS-009), for QUICK (FR-FS-002), and for non-PLANNED statuses.
7. **D7 — PREPPED placement**: 4th tab "Prepped" in `AddMealSheet` listing
   `preppedMeals()` with `portions_remaining > 0`; extends `PlannedMealDraft` with a
   PREPPED variant `{ source: 'PREPPED'; preppedMealId; preppedName; servings }`.

## Phases & File Map

### Phase A — Schema + types (prerequisite for PREPPED placement)

| File | Change |
|------|--------|
| `supabase/migrations/0006_prepped_name_snapshot.sql` | Add `prepped_name_snapshot text` (length CHECK 1..500), drop + recreate `planned_meals_exactly_one_source` so PREPPED requires snapshot, id stays nullable (SET NULL-safe) |
| `src/lib/database.types.ts` | Regenerate via `supabase gen types` after applying migration (memory: run from this worktree; sequential `000N_` naming) |

### Phase B — Derivation core (pure, testable)

| File | Change |
|------|--------|
| `src/lib/planning/fulfillment.ts` | `FulfillmentState` union, `FulfillmentResult { state, missingIngredients }`, `normalizeName()`, `buildPantryNameIndex(snapshot)`, `deriveFulfillment(meal, { pantryIndex, preppedById, ingredientsByRecipeId })` per FR-FS-001..004 + Assumptions |
| `src/lib/planning/fulfillment.spec.ts` | Unit tests (server project): all three states; QUICK → null; non-PLANNED → null; exhausted portion; deleted portion ref; zero-ingredient recipe → MUST_ACQUIRE; optional skipped; substitute satisfies; name normalization; missing-ingredient list contents |
| `src/lib/planning/ingredientIndex.ts` | Batch fetch + cache of `recipe_ingredients` rows (id, recipe_id, name, is_optional, substitute_for) for a set of recipe ids |

### Phase C — Types/service/store for PREPPED placement

| File | Change |
|------|--------|
| `src/lib/planning/types.ts` | `PlannedMeal.preppedMealId` + `preppedNameSnapshot` mapping; `PlannedMealDraft` PREPPED variant; `plannedMealName` PREPPED case uses snapshot |
| `src/lib/planning/planningService.ts` | `draftColumns` PREPPED case (`prepped_meal_id`, `prepped_name_snapshot`) |
| `src/lib/planning/planStore.svelte.ts` | Optimistic shape gains the two new fields; fulfillment store wiring: `loadFulfillmentInputs(range)` — triggers pantry/prepped loads if empty + ingredient index fetch; getter `fulfillmentFor(meal)` |
| `src/lib/planning/index.ts` | Export new types/functions |

### Phase D — UI surfaces

| File | Change |
|------|--------|
| `src/lib/components/planning/AddMealSheet.svelte` | 4th tab "Prepped": list portions (name, portions remaining, location) where remaining > 0; save PREPPED draft |
| `src/lib/components/planning/MealCard.svelte` | Fulfillment chip (icon + label): HAVE_IT `ph-check-circle` "Have it" (primary-soft), CAN_MAKE_IT `ph-cooking-pot` "Can make it" (tile-soft), MUST_ACQUIRE `ph-basket` "To get" (`--attention` soft); compact variant shows abbreviated chip; PREPPED source row in `SOURCE` map made real |
| `src/lib/components/planning/MealDetailSheet.svelte` | State line + "Missing: …" ingredient names for RECIPE MUST_ACQUIRE (FR-FS-006) |
| `src/routes/plan/+page.svelte` | Kick off `loadFulfillmentInputs` alongside `loadRange` |

### Phase E — Verification

- `bun run check`, `bun run lint`, `bun run test:unit -- --run`
- Manual: place recipe/store-bought/prepped/quick meals; verify chips, missing list,
  pantry-edit → state change on reload.

## Risks

- **CHECK/FK interaction (D1)** is the only schema-touching risk; mitigated by mirroring
  the proven RECIPE snapshot pattern and testing the constraint in migration application.
- **Name matching false positives/negatives** are accepted v1 behavior (clarified).
- **Snapshot staleness**: pantry/prepped stores may be empty when the plan page loads
  first; FR-FS-009 (omit chip until loaded) covers the gap.

## Progress Tracking

- [x] Phase 0: research.md
- [x] Phase 1: data-model.md, contracts/, quickstart.md
- [ ] Phase 2: tasks.md (`/ss:tasks`)
- [ ] Implementation
- [ ] Verification
