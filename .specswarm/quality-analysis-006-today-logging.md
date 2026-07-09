# Quality analysis — 006 Today dashboard, one-tap meal logging & meal verdicts

**Date:** 2026-07-09 · **Branch:** `feat/006-today-logging` · **Score: 91/100**

## Evidence

| Gate | Result |
|------|--------|
| `bun run check` (svelte-check) | 518 files, 0 errors, 0 warnings |
| `bun run lint` (prettier + eslint) | clean (3 justified `svelte/prefer-svelte-reactivity` disables for transient timestamps / non-reactive Set) |
| Unit (vitest, server project) | 266/266 across 28 files — 45 new (slots 14, derive 13, logService 10, logStore 8) |
| pgTAP (`supabase test db`) | 99/99 — 26 new in `meal_logs_rls.test.sql` |
| e2e (Playwright, mock backend) | 25/25 — 8 new in `tests/today.e2e.ts` |
| `bun run build` (adapter-static) | clean |
| svelte-autofixer | 0 issues on TodayDashboard; suggestions triaged (2 acted on, see below) |
| Types | `database.types.ts` regenerated from 0009 (drift gate satisfied) |

## Adversarial review outcomes

**supabase-rls-reviewer** —
1. CRITICAL (also caught by self-test before the report landed): the annotation-only
   trigger rejected the FKs' own `ON DELETE SET NULL` cascade, making any logged
   recipe/planned meal/prepped meal undeletable. **Fixed**: reference columns may
   transition value → NULL (never to a different row); pgTAP regression tests added
   (delete-with-log succeeds, snapshot survives, ref-rewrite still rejected).
2. WARN: `portion_events.triggered_by` became load-bearing with no FK/ownership
   validation — arbitrary UUIDs (incl. another user's log id) accepted. **Fixed** in
   0009: real FK (`REFERENCES meal_logs ON DELETE SET NULL`) + SECURITY DEFINER
   ownership guard; pgTAP cross-user test added.
   All other posture confirmed sound (default-deny, DEFINER safety, no upsert bypass,
   grants, realtime, REVOKE DELETE effective for authenticated and anon).

**svelte5-reviewer** —
1. WARN: the Quick Log sheet closed even when the insert failed (logMeal resolves
   null rather than throwing), hiding the error behind the closed sheet. **Fixed**:
   sheet closes only on a truthy saved log; `logError()` now also renders inside the
   sheet (`role="alert"`).
2. NIT (inherited): sheet close button is 36 px < `--tap-min`, but exactly matches the
   canonical `mobile-log.html` mockup — flagged to design, not changed.
   Runes usage, SPA compliance, tokens, `{@html}` absence, dialog a11y (Escape /
   backdrop / focus restore / `inert`), and optimistic rollback logic confirmed clean.

**svelte-autofixer suggestions acted on**: load `$effect` re-keyed to the civil date so
minute ticks don't refetch; localStorage-backed dismissals moved to `$derived.by` with
a version counter.

## Infra repair

- `.prettierignore`: added `/.impeccable/` (design-hook cache tripped `bun run lint`).
- `bun run db:types` invokes bare `supabase` (not `bunx supabase`) and truncates
  `database.types.ts` before failing when the CLI isn't on PATH — worked around
  locally; script fix left for a chore PR.

## Deductions (−9)

- −3 T026 manual quickstart (responsive + a11y pass) still open — needs a human session.
- −2 nudge banner has no e2e (clock-window dependent); covered by 6 unit tests on
  `deriveNudge` only.
- −2 component behaviour relies on e2e + manual pass rather than browser-project vitest
  (project-wide constraint: browser lane hangs in agent sandboxes).
- −1 sheet close button under `--tap-min` (canonical-mockup tension, recorded above).
- −1 `check_meal_log_source_ownership`/`check_portion_event_trigger_ownership` block
  service-role-context inserts that carry references (auth.uid() is NULL there) —
  consistent with the 0007 precedent, but a future Edge Function writer must know.

## Constitution

P1–P15 walked in plan.md Constitution Check: PASS (SPA-only, runes, tokens, no
{@html}, anon-key only, RLS-before-exposure, UUID/timestamptz, calm copy, append-only
ledgers, online-first optimistic-with-rollback all verified by gates above).
