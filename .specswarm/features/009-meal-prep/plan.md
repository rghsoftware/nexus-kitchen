# Implementation Plan: Meal Prep — Batch Sessions & Make-Ahead Integrations

**Feature**: 009-meal-prep
**Spec**: [spec.md](./spec.md)
**Created**: 2026-06-13
**Status**: Planning complete

## Summary

Build the batch meal-prep **session** subsystem and its two integration seams, on top of the
already-shipped direct-entry prepped-meal stack (feature 001) and fulfillment derivation
(feature 004). A session selects recipes + servings, schedules a prep day, and on completion
**yields** prepped portions into inventory (origin `PREP_SESSION`) — which already read HAVE_IT.
Two integrations: prep→shopping list (`FROM_PREP`) and a passive prepped-inventory suggestion in
planning. Distribution into the meal plan is deferred (yield-to-inventory-only, per clarification).

## Technical Context

- **Language / runtime**: TypeScript 5 (strict), Svelte 5 runes, SvelteKit `adapter-static` SPA.
- **Data access**: client-side `supabase-js` against PostgREST; no server load functions (P1/P2).
- **Persistence**: PostgreSQL via Supabase CLI migrations (next: `0009`, `0010`).
- **State**: rune-based stores (`*.svelte.ts`) with optimistic update + re-sync, mirroring
  `preppedMealStore.svelte.ts`.
- **Styling**: design tokens + `.nk-*` primitives (P4).
- **Testing**: vitest two-project split (server/node for services + pure logic; client/chromium for
  components) + pgTAP for RLS. Per worktree-env memory, RLS verified via pgTAP + server project; the
  browser project is not relied on in agent sandboxes.
- **New technologies**: **none** — entirely existing approved stack.

## Constitution Check

| Principle | Relevance | How satisfied |
|-----------|-----------|---------------|
| P1/P2 SPA only | data access | All session/shopping logic is client-side `supabase-js`; no `+server`/server load. |
| P3 Runes | new store/components | New store + components use runes only. |
| P4 Design tokens | new UI | Session UI uses `var(--token)` / `.nk-*`; no raw values. |
| P5 No unsanitized HTML | recipe/portion names | Render via Svelte escaping; no `{@html}`. |
| P7 RLS default-deny | 2 new tables | `meal_prep_sessions`, `meal_prep_session_recipes` get RLS enabled + owner policy **before** exposure; explicit Data API grants (per project memory on the 2026-05-30 grant flip). |
| P8 UUID PKs | new tables | `gen_random_uuid()` PKs. |
| P9 timestamptz UTC | timestamps | `created_at`/`updated_at`/`completed_at` are `timestamptz`. |
| P12 tests assert; server isolation | services | Pure logic + services in node project; every test asserts. |
| P13 No clinical labels | session UI copy | Shame-free, plain language. |
| P14 Append-only ledger | yield | Yield writes portions **only** via `portion_events` INITIALIZED (reuse `addPreppedMeal()`); never blind-writes `portions_remaining`. |
| P15 Online-first | completion | Server authoritative; completion idempotency guarded by querying existing yielded portions, not a local flag. |

**Gate result: PASS** — no new tech, no prohibited patterns, no violations to justify.

## Tech Stack Compliance Report

### ✅ Approved Technologies (already in stack)
TypeScript 5, Svelte 5 (runes), SvelteKit adapter-static, supabase-js, PostgreSQL/Supabase, vitest,
pgTAP, Playwright. No Technical Context entry introduces a library absent from `.specswarm/tech-stack.md`.

### ➕ New Technologies (auto-added)
None.

### ⚠️ Conflicting Technologies
None.

### ❌ Prohibited Technologies
None used.

`tech-stack.md` version unchanged (no additions).

## Architecture & Approach

### Module layout
- `src/lib/planning/mealPrep/` — new submodule for the session aggregate (keeps it in the Planning
  module per the logical architecture's module table; prepped portions live in Inventory and are
  reused, not duplicated).
  - `types.ts` — `MealPrepSession`, `MealPrepSessionRecipe`, drafts, row mappers.
  - `mealPrepService.ts` — CRUD + `completeSession()` (yield) + `cancelSession()`.
  - `mealPrepStore.svelte.ts` — rune store (list, create, complete, cancel; optimistic + re-sync).
  - `prepShoppingList.ts` — pure ingredient aggregation/scaling + gap computation.
- `src/lib/components/planning/mealPrep/` — `MealPrepSessionForm.svelte` (recipe+servings picker,
  prep-day), `MealPrepSessionCard.svelte`, `CompleteSessionDialog.svelte` (per-portion storage),
  `MealPrepOverview.svelte`.
- Wire-in: enable the **disabled** "Start a prep session" button in `PreppedMealOverview.svelte`
  (currently `aria-disabled`, "coming soon") to open the session flow.

### Pre-req fix (discovered empirically — Design A)
`addPreppedMeal()` currently inserts the row **and** fires a positive `INITIALIZED` portion event,
which the client guard (`portionLedger.ts`), the DB CHECK, and INV-INV-011 all reject — so it throws
against any real backend (the unit test mocks the ledger, hiding it). Fix: **remove the
`INITIALIZED` event insertion** (and its now-unneeded re-fetch round-trip). The row insert already
sets `portions_remaining = original_portions`; the ledger records only consume/adjust deltas. This
repairs direct-entry and is the seam batch-yield reuses. Add non-mocked coverage (pgTAP + a service
test that does not mock `insertPortionEvent`).

### Yield flow (completion)
1. Guard: load `prepped_meals` where `meal_prep_session_id = session.id`. If any exist → already
   yielded; treat completion as idempotent no-op (FR-PP-014).
2. For each session recipe, call the (now-fixed) `addPreppedMeal()` with
   `origin='PREP_SESSION'`, `recipe_id`, `recipe_name`, `meal_prep_session_id`, `original_portions =
   servingsToPrep`, storage location + computed `expiration_date` from the storage-default shelf
   life. This reuses the INITIALIZED-event seam (P14) verbatim — no new portion-writing path.
3. Update session `status='COMPLETED'`, `completed_at=now()`.
Order chosen so a mid-flow failure leaves a still-`PLANNED` session whose existing partial portions
are detected by the step-1 guard on retry (no double-yield).

### Prep → shopping
- `prepShoppingList.ts` (pure): given session recipes + their ingredients + base servings + pantry
  index, produce gap items annotated with contributing recipe names. Unit handling: aggregate per
  (normalized-name, unit); presence-by-name drop against pantry (no unit math, matches fulfillment v1).
- `mealPrepService.generatePrepShoppingList()` writes a `shopping_lists` row (`source_type='FROM_PREP'`,
  `meal_prep_session_id` set) + `shopping_list_items`, reusing the shopping service insert path.

### Planning integration
- PREPPED placement / picker already exists (feature 004). This feature adds a **passive** prepped
  preview (expiration-aware) at the planning surface and regression-guards REQ-PP-027 decrement for
  `PREP_SESSION`-origin portions. No forcing logic (REQ-PP-026).

## Phasing (maps to tasks.md)
1. **Slice 0 — Verify direct-entry → HAVE_IT** (small, "first"): regression tests only (FR-PP-001/002).
2. **Slice 1 — Schema**: migrations `0009` (sessions tables + RLS + grants), `0010` (shopping
   `FROM_PREP` enum value + `meal_prep_session_id` + constraint). pgTAP RLS tests. `gen types`.
3. **Slice 2 — Session core**: types, service (CRUD + complete/cancel + idempotent yield), store, unit tests.
4. **Slice 3 — Session UI**: form, card, complete dialog, overview; enable the disabled button; component tests.
5. **Slice 4 — Prep→shopping**: pure aggregation + service write + tests.
6. **Slice 5 — Planning preview + decrement regression**: passive preview surface + tests.

## Risks / Open follow-ups
- **Idempotent multi-insert without a transaction** (online-first, no server function): mitigated by
  the existing-yield guard; acceptable for single-user MVP. Documented, not solved with a txn.
- **Ingredient unit heterogeneity** across recipes: v1 aggregates by (name, unit) and lists both if
  units differ rather than converting. Recorded as a known simplification.
- **Pantry deduction on completion** deferred (Excluded in spec) — revisit with quantity-aware inventory.

## Generated artifacts
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/meal-prep-service.md](./contracts/meal-prep-service.md)
- [quickstart.md](./quickstart.md)
