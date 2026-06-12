# Quality Analysis — Feature 005: Shopping (close the buy-gap)

**Date**: 2026-06-11 | **Branch**: `005-shopping` | **Score: 90/100** (gate: 80 — PASS)

## Evidence

| Check | Result |
|-------|--------|
| Typecheck (`bun run check`) | 0 errors, 0 warnings (496 files) |
| Lint (`prettier --check && eslint`) | clean |
| Unit tests (vitest, server project) | **166/166** (26 new: categorize, mappers/payload pairing, generation, replenishment) |
| pgTAP (`supabase test db`) | **73/73** (19 new shopping tests: RLS isolation both directions, INV-SH-002/003/004 both ways, range pairing, cross-user FK guard) |
| Production build (`bun run build`) | OK, adapter-static |
| Bundle budgets | total JS 544 KB; initial load well under 1000 KB. One chunk at 200.6 KB vs 200 KB max (supabase-js vendor chunk, pre-existing) — INFO |
| svelte-autofixer | 0 issues on new components |
| Browser/e2e | not runnable in agent sandbox (pre-existing env issue, same as features 003/004) — T025 manual loop outstanding |

## Adversarial review outcomes

**supabase-rls-reviewer** — findings fixed in `0007_shopping.sql`:
- C2 cross-user `source_planned_meal_id` (UUID-existence oracle) → SECURITY DEFINER
  ownership trigger; pgTAP-tested from both sides.
- W2/W3 one-directional CHECKs → bidirectional (`CHECKED ⇔ checked_at`;
  ACTIVE/SHOPPING forbid `completed_at`).
- N1 range-pairing NULL hole → explicit OR form; pgTAP-tested.
- C1 (item re-parenting) assessed **not exploitable** (USING hides foreign rows,
  WITH CHECK rejects foreign destinations — both directions covered); documented in
  the migration. Same pattern as `planned_meals` (0005).

**svelte5-reviewer** — findings fixed:
- Sheets now `inert` the page behind them + Escape closes (was: background stayed
  interactive, making CompleteTripSheet's seed-once design a silent data-loss path).
- Checkbox tap target 36→44 px; `aria-controls` on the Checked toggle;
  `.tab:focus-visible` in the layout; raw icon sizes → tokens.
- Left as-is for repo consistency: overlay scrim color and shadow fallback match the
  existing `PlanCalendar` pattern (token extraction is a repo-wide follow-up).

## Infrastructure repair (surfaced by this chunk)

`0008_data_api_grants.sql`: the Supabase CLI's **2026-05-30 `auto_expose_new_tables`
default flip** means fresh `db reset` databases get NO Data API grants on `public`
tables — every PostgREST call failed with `permission denied` before RLS was
consulted, for ALL existing features. 0008 grants explicitly for 0001–0006 tables;
0007+ migrations carry their own grants (new convention).

## Deductions

- −5 manual browser quickstart (T025) outstanding — needs a human session.
- −3 no coverage tooling configured (`@vitest/coverage-v8` absent; repo-wide).
- −2 marginal vendor-chunk budget overshoot (pre-existing).

## Constitution

P1–P15 verified in plan gate and held through implementation: no server files, runes
only, tokens-first styling, no `{@html}`, RLS default-deny in the same migration that
creates the tables, UUID PKs, timestamptz, calm copy, append-only ledger untouched,
online-first optimistic writes with rollback.
