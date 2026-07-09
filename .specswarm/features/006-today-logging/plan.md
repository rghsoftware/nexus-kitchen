# Implementation Plan: Today dashboard, one-tap meal logging & meal verdicts

**Feature**: 006 | **Branch**: `feat/006-today-logging`
**Spec**: [spec.md](./spec.md) | **Created**: 2026-07-09

## Summary

Add `meal_logs` (migration 0009) with append-only-plus-annotation semantics; a `log`
domain module (types, service, runes store, pure derivations for slots/nudges/
recents/keepers/coverage); the `/today` route composed per the canonical mockups; a
Quick Log sheet; and wiring into existing seams — feature 004 fulfillment for coverage,
the portion ledger for prepped consumption, and the dormant `PLANNED → LOGGED`
transition from feature 003.

## Technical Context

- **Language/Framework**: TypeScript, SvelteKit SPA (adapter-static), Svelte 5 runes.
- **Data access**: supabase-js via `$lib/supabaseClient`; RLS-authoritative; no owner
  filters in queries.
- **State**: module-level `$state` stores with getter functions + optimistic writes with
  rollback (planStore pattern).
- **Styling**: design tokens + `.nk-*` primitives; `.nk-verdict` already shipped in
  `base.css`; Tailwind-with-token utility classes as used by planning/shopping
  components (heed the `[font-weight:var(--weight-*)]` gotcha).
- **Testing**: vitest server project for pure logic + service specs (thenable
  `makeChain` supabase mock); pgTAP for RLS/invariants; Playwright e2e with the
  plan.e2e.ts stateful mock backend extended for `meal_logs`.
- No new dependencies.

## Tech Stack Compliance Report

### ✅ Approved Technologies (already in stack)

SvelteKit, Svelte 5 runes, supabase-js, Tailwind (token-bound), vitest, Playwright,
pgTAP, Phosphor icons.

### ➕ New Technologies (auto-added)

None.

### ⚠️ Conflicting / ❌ Prohibited

None.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| P1/P2 SPA only, no server files | ✅ | `/today/+page.svelte` only; all logic client-side |
| P3 Runes mode | ✅ | `logStore.svelte.ts` uses `$state` + getter functions |
| P4 Design tokens | ✅ | Today components use `var(--token)` / `.nk-*`; verdict UI is the shipped `.nk-verdict` primitive |
| P5 No unsanitized HTML | ✅ | No `{@html}` |
| P6 Service-role key server-only | ✅ | anon key + RLS only; ownership-guard trigger is SECURITY DEFINER in the DB, not a client secret |
| P7 RLS default-deny before exposure | ✅ | 0009 enables RLS + policies in the same migration that creates `meal_logs` |
| P8/P9 UUID PKs, timestamptz UTC | ✅ | Complies; shared `set_updated_at()` reused |
| P13 No clinical labels | ✅ | "Log it", "I ate something", "Not for me" — calm copy straight from mockups |
| P14 Append-only records | ✅ | No DELETE policy/grant; `meal_logs_annotation_only` trigger restricts UPDATE to verdict/notes; portion changes via ledger events only |
| P15 Online-first, server authoritative | ✅ | Optimistic log with rollback on insert failure; follow-up writes sequential with per-step calm failure report (research R5) |
| INV-XD-001/002/003 | ✅ | R3 insert trigger; R4 ledger reuse with `triggered_by` link |
| INV-PL-005 | ✅ | Safe-flip UPDATE predicate; CHECK already in 0005 |
| INV-CC-004 / REQ-CN-007 | ✅ | R2 annotation-only trigger + no DELETE |

**Gate result: PASS** — no violations, no justifications needed.

## Design Decisions (rationale in research.md)

- D1 (R1): three-way `meal_verdict` on the log row; per-source marks derived.
- D2 (R2): append-only + verdict/notes annotation window via BEFORE UPDATE trigger.
- D3 (R3): type↔reference validation and ownership guard as insert triggers; FKs SET NULL.
- D4 (R4): prepped consumption through existing `consumePortions` + new `triggeredBy` arg.
- D5 (R5): log-first orchestration; follow-up failures reported, never rolled back.
- D6 (R6): client-local day bounds, fixed slot windows, pure `deriveNudge`, localStorage dismissals.
- D7 (R7): recents/keepers from client-side grouping of last 100 non-quick logs.
- D8 (R8): coverage card reuses feature 004 fulfillment derivation verbatim.
- D9 (R9): Quick Log sheet implements Escape/backdrop/focus-restore/`inert` properly.

## Phases & File Map

### Phase A — Schema & types

| File | Change |
|------|--------|
| supabase/migrations/0009_meal_logs.sql | enums, table, CHECKs, triggers, RLS, grants, realtime, indexes |
| src/lib/database.types.ts | regenerate (`bun run db:types`) |
| supabase/tests/meal_logs_rls.test.sql | pgTAP: RLS both directions, append-only, source validation, ownership guard, ledger link |

### Phase B — Domain module

| File | Change |
|------|--------|
| src/lib/log/types.ts | aliases, `MealLog`, `MealLogDraft`, `toMealLog` |
| src/lib/log/slots.ts | `slotForTime`, `deriveNudge`, day-bounds helpers (pure) |
| src/lib/log/derive.ts | `groupLogSources`, `keepers`, `recents`, `unratedRecent`, `deriveDayCoverage` (pure) |
| src/lib/log/logService.ts | `createLog(draft)`, `setVerdict`, `fetchLogsBetween`, `fetchRecentLogs` |
| src/lib/log/logStore.svelte.ts | today logs + recents state; `logMeal(draft)` orchestration (optimistic, R5), `rateLog` |
| src/lib/log/index.ts | curated exports |
| src/lib/pantry/preppedMealService.ts / preppedMealStore.svelte.ts | optional `triggeredBy` param threaded to CONSUMED event |
| colocated *.spec.ts | server-project unit tests for all of the above |

### Phase C — Today UI

| File | Change |
|------|--------|
| src/lib/components/today/TodayDashboard.svelte | shell: greeting, coverage, nudge, meals, quick actions, recap, attention |
| src/lib/components/today/TodayMealCard.svelte | slot card: status/action per FR-TL-003/004 |
| src/lib/components/today/DayCoverageCard.svelte | coverage chips + headline |
| src/lib/components/today/NudgeBanner.svelte | gentle banner, Not now |
| src/lib/components/today/QuickLogSheet.svelte | bottom sheet per mobile-log.html (D9) |
| src/lib/components/today/RecapCard.svelte | "How were these?" |
| src/lib/components/today/AttentionList.svelte | expiring prepped items |
| src/lib/components/shared/VerdictControl.svelte | wraps `.nk-verdict` (aria-pressed, deselect) |
| src/routes/today/+page.svelte | thin shell |
| src/routes/+page.svelte | redirect target `/plan` → `/today` |
| src/routes/+layout.svelte | Today nav item gets `href` |

### Phase D — e2e & verification

| File | Change |
|------|--------|
| tests/today.e2e.ts | mock-backend flow: view today, one-tap log, prepped decrement, quick log, verdict |
| .specswarm/quality-analysis-006-today-logging.md | end-of-feature analysis |

## Risks

- **Trigger strictness vs. PostgREST updates** — supabase-js UPDATE sends only changed
  columns, but PostgREST applies them to the full row; the annotation-only trigger must
  compare OLD/NEW values, not "columns present in payload". Mitigated by pgTAP tests
  updating verdict alone (pass) and servings (fail).
- **Cross-module store coupling** (log store → pantry store → plan store) — keep
  orchestration one-directional in `logMeal`; stores never import each other circularly
  (log → pantry/plan only).
- **Browser-project component tests hang in agent sandboxes** — pure logic goes in
  `slots.ts`/`derive.ts` (server project); component behaviour covered by e2e + manual
  quickstart.
- **Clock-dependent logic** — all time-dependent functions take `now: Date` explicitly;
  no `Date.now()` inside derivations.

## Progress Tracking

- [x] Phase 0: research.md
- [x] Phase 1: data-model.md + contracts + quickstart
- [x] Phase 2: tasks.md
- [x] Implementation
- [x] Verification (automated gates + adversarial reviews; manual quickstart T026 pending)
