# Implementation Plan: Shopping — close the buy-gap

**Feature**: 005 | **Branch**: `005-shopping`
**Spec**: [spec.md](./spec.md) | **Created**: 2026-06-11

## Summary

Turn MUST_ACQUIRE gaps into shopping lists (generation reuses the feature-004
derivation so list and calendar never disagree), support the trip itself (check off,
checked section, unavailable), and close the loop on completion: checked items
replenish the pantry through the reserved seam, and store-bought purchases become
ready-to-eat prepped portions auto-linked to their planned meals (HAVE_IT). One
migration (`0007_shopping.sql`), one new lib module (`src/lib/shopping/`), one new
route (`/shopping`), nav wiring.

## Technical Context

- **Language/Framework**: TypeScript (strict), SvelteKit SPA, Svelte 5 runes (P1/P3).
- **Data access**: supabase-js / PostgREST under owner-only RLS; no Edge Functions
  (no secrets/privilege involved — research R5).
- **State**: module-level runes store with getter functions + optimistic check/uncheck
  (existing pattern: `planStore.svelte.ts`, `pantryStore.svelte.ts`).
- **Styling**: design tokens + `.nk-*` primitives only (P4); icons paired with labels
  (REQ-AC-003); calm voice (P13).
- **Testing**: vitest server project for all pure logic (generation, categorize,
  replenishment planning, row mapping). Browser component tests avoided per memory
  (hang in sandboxes); manual verification via dev server.
- **No new dependencies.**

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
| P1/P2 SPA only, no server files | ✅ | `/shopping/+page.svelte` only; all logic client-side |
| P3 Runes mode | ✅ | `shoppingStore.svelte.ts` uses `$state` + getter functions |
| P4 Design tokens | ✅ | All new components use `var(--token)` / `.nk-*` |
| P5 No unsanitized HTML | ✅ | No `{@html}` |
| P6 Service-role key server-only | ✅ | anon key + RLS only |
| P7 RLS default-deny before exposure | ✅ | 0007 enables RLS + policies in the same migration that creates the tables |
| P8/P9 UUID PKs, timestamptz UTC | ✅ | Both tables comply; `set_updated_at()` trigger reused |
| P13 No clinical labels | ✅ | "Shopping", "Checked", "Couldn't find it" — calm copy |
| P14 Append-only records | ✅ | Portion ledger untouched (insert via existing `addPreppedMeal`); REMOVED items retained, not deleted |
| P15 Online-first, server authoritative | ✅ | Optimistic check-off with rollback; sequential writes on completion with per-item failure report (research R5) |
| INV-SH-001..004 | ✅ | 002/003/004 as DB CHECKs; 001 app-layer (cross-row, research R1) |

**Gate result: PASS** — no violations, no justifications needed.

## Design Decisions (rationale in research.md)

1. **D1 — Migration 0007**: `shopping_lists` + `shopping_list_items`, 4 enums,
   CHECK-encoded invariants, owner-only RLS (items via parent-list EXISTS),
   `generated_range_start/end` instead of a misleading meal-plan FK (R1).
2. **D2 — Fixed categories**: `shopping_category` enum (8 values) + pure keyword
   `categorize()`; user-editable, default OTHER (R2).
3. **D3 — Generation is pure + reuses `deriveFulfillment`**: `computeBuyGaps()` over
   range meals + `FulfillmentInputs`; dedupe by `normalizeName` against pending items;
   attribution as `{recipeId, title}` snapshots (R3).
4. **D4 — Replenishment seam goes live**: `addPantryItemsFromShoppingList` body
   implemented; merge on (normalized name, normalized unit) equality, else insert (R4).
5. **D5 — Store-bought → prepped portion + auto-link**: insert `prepped_meals`
   (origin STORE_BOUGHT, fridge, today+3d default expiry, portions from servings),
   then convert the source planned meal to PREPPED (snapshot set, store_bought_name
   cleared); skip link if meal gone/non-PLANNED (R5).
6. **D6 — Module/UI layout** mirrors planning/pantry: `src/lib/shopping/*`,
   `src/lib/components/shopping/*`, `/shopping` route, nav `href` wired (R6).

## Phases & File Map

### Phase A — Schema + types

| File | Change |
|------|--------|
| `supabase/migrations/0007_shopping.sql` | Enums, both tables, CHECKs (INV-SH-002/003/004), indexes, RLS enable + policies, `set_updated_at` triggers |
| `src/lib/database.types.ts` | Regenerate after applying migration (memory workflow) |

### Phase B — Pure logic (server-tested)

| File | Change |
|------|--------|
| `src/lib/shopping/types.ts` | Enum aliases, `ShoppingList`, `ShoppingItem`, `NeededFor`, row→app mappers, insert/update input types |
| `src/lib/shopping/categorize.ts` | Keyword map → `ShoppingCategory`, default OTHER |
| `src/lib/shopping/generation.ts` | `computeBuyGaps(meals, inputs, existingPendingNames)` per FR-SH-010..012; quantity suggestion rules (spec Assumptions) |
| `src/lib/shopping/replenishment.ts` | Pure `planReplenishment(checked, pantryItems)` (merge/insert split) + `completeTrip()` orchestration incl. store-bought portion + auto-link (FR-SH-015..018) |
| `src/lib/shopping/*.spec.ts` | Server-project tests: gap aggregation/dedupe/attribution; store-bought gaps; categorizer; merge rules incl. unit mismatch; completion planning incl. deleted-meal skip |

### Phase C — Service + store

| File | Change |
|------|--------|
| `src/lib/shopping/shoppingService.ts` | CRUD: lists (create/rename/archive/complete), items (add/update/remove/check/uncheck/unavailable with `checked_at` pairing), list-with-items fetch |
| `src/lib/shopping/shoppingStore.svelte.ts` | Runes store: lists, active list + items, optimistic check/uncheck with rollback, completion flow state |
| `src/lib/shopping/index.ts` | Public exports |
| `src/lib/pantry/shoppingListIntegration.ts` | Replace no-op body: insert/merge pantry items (FR-PI-008 live) |

### Phase D — UI

| File | Change |
|------|--------|
| `src/lib/components/shopping/ListsOverview.svelte` | Active list card w/ progress, create-list, generate button, recent lists (Domain Spec §4.7) |
| `src/lib/components/shopping/GenerateListSheet.svelte` | Date-range picker (default today→+6, FR-SH-014), empty-gap success state (INV-SH-001) |
| `src/lib/components/shopping/ShoppingListView.svelte` | Category-grouped pending items, collapsible Checked section (FR-SH-008), complete button |
| `src/lib/components/shopping/ItemRow.svelte` | Check/uncheck, unavailable, "For: …" attribution, edit quantity/category |
| `src/lib/components/shopping/AddItemForm.svelte` | Manual add (name/qty/unit/category), positive-qty guard |
| `src/lib/components/shopping/CompleteTripSheet.svelte` | Review checked items → pantry (location/qty), store-bought rows (portions/expiry), carry-over offer for pending/unavailable (FR-SH-017), decline path |
| `src/routes/shopping/+page.svelte` | Route composing the above |
| `src/routes/+layout.svelte` | Nav: Shopping `href: resolve('/shopping')` |

### Phase E — Verification

- `bun run check`, `bun run lint`, `bun run test:unit -- --run` (server project)
- Manual quickstart loop (see quickstart.md): generate → shop → complete → verify
  pantry merge + HAVE_IT/CAN_MAKE_IT flips on the calendar.

## Risks

- **Planned-meal conversion CHECK**: the STORE_BOUGHT→PREPPED update must satisfy
  `planned_meals_exactly_one_source` exactly (set snapshot, null the name in the same
  PATCH). Mitigation: dedicated service function + unit test of the payload shape.
- **Partial completion failures** (multi-write, no transaction): per-item error report
  in the completion sheet; operations idempotent enough to re-run (R5).
- **Categorizer misses**: default OTHER is calm and correctable; no blocking risk.
- **INV-SH-001 app-layer enforcement**: guarded in store (delete-last prompts archive)
  and generation (zero gaps → no list); accepted residual risk via direct API use.

## Progress Tracking

- [x] Phase 0: research.md
- [x] Phase 1: data-model.md, contracts/, quickstart.md
- [ ] Phase 2: tasks.md (`/ss:tasks`)
- [ ] Implementation
- [ ] Verification
