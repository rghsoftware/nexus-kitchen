# Tasks: Planning — Place Planned Meals on a Calendar

**Feature**: 003-planning-place-planned-meals-recipe
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md) | **Data model**: [data-model.md](./data-model.md) | **Contract**: [contracts/planning-service.md](./contracts/planning-service.md)

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md (2026-06-07) -->
<!-- No prohibited technologies; no new technologies introduced -->

User stories: **US1** view the calendar (Scenario 1) · **US2** place meals (Scenarios 2–5) · **US3** edit/move/remove (Scenarios 6–7).
Tests are required (constitution P12; spec SC-003/005 demand DB-level negative tests).

## Phase 1: Foundational (blocks everything)

- [X] T001 Write migration with enums (`meal_slot`, `planned_meal_source`, `planned_meal_status`), `meal_plans` (CHECK end ≥ start, UNIQUE (owner_id, start_date)), `planned_meals` (INV-PL-003 exactly-one-source CHECK against snapshot for RECIPE, servings > 0, logged_at pairing, `UNIQUE NULLS NOT DISTINCT (meal_plan_id, date, meal_slot, sort_order)`, INV-PL-002 range trigger), owner RLS default-deny on both tables, realtime publication, `set_updated_at` triggers, indexes — per data-model.md — supabase/migrations/0005_meal_plans.sql
- [X] T002 Apply migration locally (`supabase db reset` or `migration up`) and regenerate types via `bun run db:types`; verify new tables appear — src/lib/database.types.ts
- [X] T003 [P] Create planning domain types (`MealSlot`, `PlannedMealSource`, `PlannedMealStatus`, `MealPlan`, `PlannedMeal`, discriminated `PlannedMealDraft`, `PlannedMealPlacement`, `plannedMealName()`) per data-model.md — src/lib/planning/types.ts
- [X] T004 [P] Implement Monday-start civil-date week math (`mondayOf`, `weekRangeOf`, `addDays`, `monthGridRange`, `todayLocalISO`, label formatters; UTC-noon internal parsing) with exhaustive unit tests incl. year/month boundaries — src/lib/planning/weekMath.ts, src/lib/planning/weekMath.spec.ts

## Phase 2: Service & state (blocks all UI)

- [ ] T005 Implement `planningService` exactly per contracts/planning-service.md: `getOrCreatePlanForWeek` (upsert on owner_id+start_date), `listPlannedMeals(from,to)`, `addPlannedMeal` (append sort_order = max+1, retry once on unique violation; RECIPE captures title snapshot), `updatePlannedMeal`, `movePlannedMeal` (cross-week re-home, FR-PL-015), `removePlannedMeal`; typed `PlanningError`, no swallowed errors — src/lib/planning/planningService.ts
- [ ] T006 Unit-test planningService with a mocked supabase client: week upsert payload shape, source-exclusive insert payloads for all three drafts, append-ordering + conflict retry, cross-week move re-homes plan id, error propagation — src/lib/planning/planningService.spec.ts
- [ ] T007 Implement runes-based plan store: date-keyed cache for a loaded range, `loadRange(from,to)`, optimistic `add`/`update`/`move`/`remove` with rollback + error surface, group ordering by (slot, sortOrder); export via index barrel — src/lib/planning/planStore.svelte.ts, src/lib/planning/index.ts

## Phase 3: US1 — Calendar views

- [ ] T008 [US1] Build `MealCard.svelte` (name via `plannedMealName`, source-kind badge, servings; recipe meals link to `/recipes/[id]` when recipeId present) and `SlotBand.svelte` (one slot group per band incl. "Anytime"; ordered meals; "+ add" affordance; shame-free empty copy "Nothing planned" per FR-PL-020) using design tokens / `.nk-*` only — src/lib/planning/components/MealCard.svelte, src/lib/planning/components/SlotBand.svelte
- [ ] T009 [P] [US1] Build `WeekView.svelte`: 7 day columns (Mon–Sun) of slot bands; responsive compression on small screens — src/lib/planning/components/WeekView.svelte
- [ ] T010 [P] [US1] Build `DayView.svelte`: full slot-band detail for one day with prev/next day controls — src/lib/planning/components/DayView.svelte
- [ ] T011 [P] [US1] Build `MonthView.svelte`: month grid with compact per-day meal summaries; tapping a day opens it in Day view — src/lib/planning/components/MonthView.svelte
- [ ] T012 [US1] Build `PlanCalendar.svelte` shell: Day/Week/Month switcher (weekly default, choice persisted to localStorage per A-001), prev/next period nav, "Today" shortcut, drives `planStore.loadRange` for the visible range — src/lib/planning/components/PlanCalendar.svelte
- [ ] T013 [US1] Add `/plan` route rendering `PlanCalendar` and add "Plan" link to primary nav — src/routes/plan/+page.svelte, src/routes/+layout.svelte

## Phase 4: US2 — Place meals

- [ ] T014 [US2] Build `AddMealSheet.svelte`: opens scoped to (date, slot?) from any band's "+ add" (slot pre-filled, "Anytime" selectable); three source tabs — Recipe (searchable picker over existing recipes module, servings defaulting from recipe), Store-bought (free text), Quick (one-tap "Takeout"/"Leftovers" + custom text); ≤ 3 interactions for the quick path (FR-PL-005..008, FR-PL-021); wires to `planStore.add` — src/lib/planning/components/AddMealSheet.svelte

## Phase 5: US3 — Edit, move, remove

- [ ] T015 [US3] Build `MealDetailSheet.svelte` (edit servings/slot/source details; Remove with single lightweight confirm; Move entry point) and `MoveMealSheet.svelte` (tap-based date + slot picker calling `planStore.move`) (FR-PL-012/013/014) — src/lib/planning/components/MealDetailSheet.svelte, src/lib/planning/components/MoveMealSheet.svelte
- [ ] T016 [US3] Wire HTML5 drag-and-drop on pointer devices: `MealCard` draggable, `SlotBand` drop target (cross-day, cross-slot, append-to-group), visual drop affordance via tokens; keyboard/touch users rely on MoveMealSheet (FR-PL-013, FR-PL-015) — src/lib/planning/components/MealCard.svelte, src/lib/planning/components/SlotBand.svelte, src/lib/planning/components/WeekView.svelte, src/lib/planning/components/DayView.svelte

## Phase 6: Polish & verification

- [ ] T017 Write Playwright e2e: plan a recipe + store-bought + quick meal in one week; two meals in one slot + an Anytime meal; move a meal across days (tap-move path); edit servings; remove; reload and assert persistence (SC-001..004) — tests/plan.e2e.ts
- [ ] T018 Run `bun run format`, `bun run check`, `bun run lint`, `bun run test:unit -- --run`; fix all findings; confirm Definition of Done items in plan.md — (repo-wide)

## Dependencies

```
T001 → T002 → {T003, T004} → T005 → T006
                         T005 → T007 → T008 → {T009, T010, T011} → T012 → T013
                                                          T013 → T014 → T015 → T016 → T017 → T018
```

- Phase 1 blocks everything; Phase 2 blocks all UI.
- T003/T004 are parallel after T002; T009/T010/T011 are parallel after T008.
- US2 (T014) needs US1's shell (T013) for entry points; US3 needs cards/sheets from US1/US2.

## Implementation strategy

MVP increment = Phases 1–4 (T001–T014): a usable week calendar where all three meal
sources can be placed — the requirement-creation spine. Phase 5 completes editing
ergonomics; Phase 6 locks it in with e2e + quality gates.
