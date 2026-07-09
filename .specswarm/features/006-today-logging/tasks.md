# Tasks: Today dashboard, one-tap meal logging & meal verdicts

**Feature**: 006 | **Branch**: `feat/006-today-logging`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md (no new technologies; no prohibited tech) -->

User stories (from spec, priority order):

- **US1 (P1)** — See my day: Today dashboard with meal cards, coverage, quick actions. (FR-TL-001..008)
- **US2 (P1)** — One-tap logging: planned meals, Quick Log sheet, prepped draw-down. (FR-TL-009..014)
- **US3 (P2)** — Verdicts: capture at log time or later, recap, keeper marks. (FR-TL-015..018)
- **US4 (P3)** — Gentle mealtime nudge banner. (FR-TL-019)

## Phase 2: Foundational (blocks all stories)

- [X] T001 Create migration: `meal_log_type` + `meal_verdict` enums, `meal_logs` table with CHECKs, `meal_logs_validate_source` + SECURITY DEFINER ownership + `meal_logs_annotation_only` triggers, RLS enable + owner SELECT/INSERT/UPDATE policies (no DELETE), grants (no DELETE to authenticated), realtime publication, indexes, `set_updated_at` trigger per data-model.md — supabase/migrations/0009_meal_logs.sql
- [X] T002 Apply migration locally and regenerate DB types (`bun run db:types`) — src/lib/database.types.ts
- [X] T003 pgTAP suite: RLS isolation both directions; UPDATE of verdict/notes allowed, occurrence columns rejected; DELETE rejected; source-validation per log type both ways; cross-user planned/recipe/prepped refs rejected; QUICK_LOG nameless allowed — supabase/tests/meal_logs_rls.test.sql
- [X] T004 [P] Log domain types: enum/row aliases, `MealLog`, `MealLogDraft` union, `toMealLog` mapper — src/lib/log/types.ts
- [X] T005 [P] Pure slot/time helpers: `slotForTime`, local day bounds, `deriveNudge` + unit tests — src/lib/log/slots.ts, src/lib/log/slots.spec.ts
- [X] T006 [P] Pure derivations: `groupLogSources`, `keepers`, `recents`, `unratedRecent`, `deriveDayCoverage` + unit tests — src/lib/log/derive.ts, src/lib/log/derive.spec.ts
- [X] T007 Thread optional `{ triggeredBy }` through `consumePortions` → CONSUMED event `triggered_by`, and through `optimisticConsumePortions`; extend existing specs — src/lib/pantry/preppedMealService.ts, src/lib/pantry/preppedMealStore.svelte.ts, src/lib/pantry/preppedMealService.spec.ts

## Phase 3: US2 — One-tap logging (MVP core)

- [X] T008 [US2] `logService`: `createLog(draft)` (draft→insert mapping incl. snapshots), `setVerdict`, `fetchLogsBetween`, `fetchRecentLogs`, `markPlannedMealLogged` safe-flip; `LogError` calm errors + unit tests (makeChain mock) — src/lib/log/logService.ts, src/lib/log/logService.spec.ts
- [X] T009 [US2] `logStore`: today/recents state + getters, `loadToday`, `loadRecents`, orchestrated `logMeal` (optimistic append, insert-failure rollback, follow-up consume/flip with calm `logNotice` on partial failure, in-flight double-tap guard), `rateLog` optimistic + unit tests — src/lib/log/logStore.svelte.ts, src/lib/log/logStore.spec.ts
- [X] T010 [US2] Public exports barrel — src/lib/log/index.ts

**Checkpoint**: `logMeal` fully unit-tested against mocks; DB invariants pgTAP-proven; no UI yet.

## Phase 4: US1 — Today dashboard

- [X] T011 [US1] Route shell + home rewire: `/today` page, root redirect → `/today`, Today nav item `href` enabled — src/routes/today/+page.svelte, src/routes/+page.svelte, src/routes/+layout.svelte
- [X] T012 [US1] `TodayDashboard` shell: greeting/date, section order per web-today.html, loads plan-for-today + inventory + logs via existing stores + logStore — src/lib/components/today/TodayDashboard.svelte
- [X] T013 [P] [US1] `TodayMealCard`: slot label, tile, name, prepped tag with portions, states (Eaten · time / Have it / Need to get), single primary action Log-it / Add-to-list (FR-TL-004), double-tap guard — src/lib/components/today/TodayMealCard.svelte
- [X] T014 [P] [US1] `DayCoverageCard`: chips + calm headline from `deriveDayCoverage` — src/lib/components/today/DayCoverageCard.svelte
- [X] T015 [P] [US1] `AttentionList`: prepped ≤3 days to expiry with portions, "Plan it in" links; hidden when empty — src/lib/components/today/AttentionList.svelte
- [X] T016 [P] [US1] Quick actions grid + empty-slot invitation cards per mockups — src/lib/components/today/TodayDashboard.svelte

**Checkpoint**: Today renders real plan/pantry data; planned-meal one-tap logging works end-to-end.

## Phase 5: US2 — Quick Log sheet

- [X] T017 [US2] `QuickLogSheet` per mobile-log.html: slot picker (default `slotForTime`), "I ate something", prepped group (portions), Recent, Keepers groups; proper dialog a11y (Escape, backdrop, focus restore, `inert` background — research R9); mobile FAB + desktop entry — src/lib/components/today/QuickLogSheet.svelte, src/lib/components/today/TodayDashboard.svelte

## Phase 6: US3 — Verdicts

- [X] T018 [P] [US3] `VerdictControl`: wraps `.nk-verdict` (Again / It was fine / Not for me), aria-pressed, tap-again-to-clear, ≥44px targets — src/lib/components/shared/VerdictControl.svelte
- [X] T019 [US3] Verdict wiring: inline "How was it?" on just-logged card, sheet footer capture, verdict marks + times-made in Recent/Keepers groups — src/lib/components/today/TodayMealCard.svelte, src/lib/components/today/QuickLogSheet.svelte
- [X] T020 [US3] `RecapCard`: up to 3 unrated last-48h logs with inline VerdictControl; hidden when empty — src/lib/components/today/RecapCard.svelte

## Phase 7: US4 — Nudge

- [X] T021 [US4] `NudgeBanner`: `deriveNudge` + localStorage day/slot dismissal, Log + Not now actions — src/lib/components/today/NudgeBanner.svelte

## Phase 8: Polish & verification

- [X] T022 e2e: extend mock backend with `meal_logs` (+ planned_meals status flip, portion_events); flow test — view today, one-tap log flips card + decrements portions, quick "ate something", verdict set/clear, RLS-shaped isolation not applicable (mock), double-tap yields one log — tests/today.e2e.ts
- [X] T023 `bun run check` + `bun run lint` + `bun run test:unit -- --run` + `bun run build` + `bunx supabase test db` all green; svelte-autofixer clean on new components — src/lib/log/index.ts
- [X] T024 Adversarial reviews: supabase-rls-reviewer (0009 + pgTAP) and svelte5-reviewer (today components); triage + fix criticals — .specswarm/quality-analysis-006-today-logging.md
- [X] T025 Quality analysis + metrics entry — .specswarm/quality-analysis-006-today-logging.md, .specswarm/metrics.json
- [ ] T026 Manual quickstart verification (quickstart.md loop) incl. responsive + a11y pass — .specswarm/features/006-today-logging/quickstart.md

## Dependencies

T001 → T002 → {T003, T004} ; T004 → {T005, T006, T008} ; T007 ∥ after T002 ;
T008 → T009 → T010 → T011 → T012 → {T013..T016} → T017 → {T018 → T019 → T020} → T021 →
T022 → T023 → T024 → T025 → T026. [P] tasks within a phase parallelize.

## Implementation strategy

MVP increment = Phases 2–4 (Today + planned-meal one-tap logging). Sheet, verdicts, and
nudge layer on without schema churn. Pure logic (T005/T006) and pantry threading (T007)
parallelize against service work. Component behaviour is covered by e2e + manual
quickstart because the browser vitest project hangs in agent sandboxes.

## Verification notes (2026-07-09)

All automated gates green: svelte-check 0/0, lint clean, 266/266 unit (45 new),
99/99 pgTAP (26 new), 25/25 e2e (8 new), static build clean, types regenerated.
Adversarial reviews done and criticals fixed — (1) annotation trigger now permits the
FKs' ON DELETE SET NULL transition (logged sources are deletable again; regression
pgTAP added), (2) portion_events.triggered_by gained a real FK + SECURITY DEFINER
ownership guard, (3) the Quick Log sheet stays open when a log insert fails and shows
the error inline. T026 (manual quickstart: responsive + a11y pass per quickstart.md)
remains open for a human session.
