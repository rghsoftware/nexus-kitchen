# Research: Planning — Place Planned Meals on a Calendar

**Feature**: 003-planning-place-planned-meals-recipe
**Date**: 2026-06-10

## Decision: Implicit week-plan acquisition

- **Decision**: One `MealPlan` per (owner, Monday-start week), auto-created by
  `getOrCreatePlanForWeek()` using a PostgREST upsert on a unique `(owner_id, start_date)`
  index, with `start_date` always a Monday and `end_date` the following Sunday.
- **Rationale**: Clarification 2026-06-10 chose implicit weekly plans. An upsert against a
  unique key is race-safe (two tabs placing the first meal of a week can't create duplicate
  plans) and keeps INV-PL-001/002 trivially satisfiable. The domain model's optional `name`
  stays null.
- **Alternatives considered**: select-then-insert (racy without retry); a single rolling
  plan (stretches INV-PL-002 semantics and complicates future per-week generation
  preferences); explicit plan CRUD (rejected in clarification).

## Decision: INV-PL-012 enforcement via `UNIQUE NULLS NOT DISTINCT`

- **Decision**: `UNIQUE NULLS NOT DISTINCT (meal_plan_id, date, meal_slot, sort_order)`
  on `planned_meals`.
- **Rationale**: The unslotted "Anytime" group has `meal_slot = NULL`; default SQL unique
  semantics treat NULLs as distinct, which would let duplicate sort_orders into the
  Anytime group. `NULLS NOT DISTINCT` (Postgres 15+; Supabase ships ≥15) makes NULL a
  real group key, matching INV-PL-012's "unslotted meals form their own per-date group".
- **Alternatives considered**: two partial unique indexes (one `WHERE meal_slot IS NULL`,
  one `WHERE meal_slot IS NOT NULL`) — works on older Postgres but is two objects for one
  invariant; sentinel 'ANYTIME' enum value — diverges from the canonical domain model
  where unslotted is `null`.

## Decision: INV-PL-002 (date within plan range) via trigger

- **Decision**: `BEFORE INSERT OR UPDATE` trigger on `planned_meals` that raises if
  `NEW.date` is outside the referenced plan's `[start_date, end_date]`.
- **Rationale**: CHECK constraints can't reference other rows/tables in Postgres. A
  trigger keeps the invariant in the database (SC-005) rather than trusting the client.
- **Alternatives considered**: denormalizing start/end onto planned_meals (redundant,
  drift-prone); composite FK on (plan_id, week) (forces extra columns); client-only
  validation (violates "client is never trusted", P7 spirit).

## Decision: Native HTML5 drag-and-drop, no library

- **Decision**: `draggable` MealCards + `dragover`/`drop` SlotBand targets using the
  native HTML5 DnD API on pointer devices; the tap-based MoveMealSheet is the universal
  path (touch, keyboard, screen reader).
- **Rationale**: Keeps the runtime dependency set at exactly supabase-js (tech-stack
  posture). Native DnD is sufficient for desktop pointer flows; touch devices get the
  explicitly-required accessible move flow instead, satisfying FR-PL-013 without a
  touch-DnD polyfill.
- **Alternatives considered**: `svelte-dnd-action` (new dependency, tech-stack addition
  for marginal gain); pointer-event custom DnD (more code, needed only if touch-drag
  becomes a requirement later).

## Decision: Recipe deletion → snapshot + `ON DELETE SET NULL`

- **Decision**: `planned_meals.recipe_title_snapshot` captured at creation;
  `recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL`.
- **Rationale**: A-005 — plans must not corrupt or block recipe deletion. The card keeps
  rendering the snapshot title; a null `recipe_id` simply means the link is gone.
  INV-PL-003's exactly-one-source CHECK is written against the *snapshot* column for
  RECIPE-source rows (snapshot is NOT NULL when source = RECIPE), so FK nulling can't
  violate it.
- **Alternatives considered**: `ON DELETE RESTRICT` (blocks deletion, hostile UX);
  cascade delete of planned meals (silently rewrites the user's plan — worst option).

## Decision: Hand-rolled week math over civil-date strings

- **Decision**: `weekMath.ts` implements Monday-start ISO week helpers operating on
  `YYYY-MM-DD` strings (parse to UTC-noon `Date` internally to dodge DST edges), fully
  unit-tested.
- **Rationale**: Plan dates are civil dates (A-006); no date library is approved in the
  tech stack and none is needed for Monday-of-week, add-days, and month-grid arithmetic.
- **Alternatives considered**: `date-fns` / `dayjs` (new dependency for ~60 lines of
  tested code); `Temporal` (not yet universally shipped in target browsers).

## Decision: Append-only sort order maintenance

- **Decision**: New and moved meals take `max(sort_order) + 1` within the target
  (plan, date, slot) group; within-group manual reordering ships only as a consequence of
  move (re-append), not as a dedicated reorder gesture this chunk.
- **Rationale**: A-007 — the observable contract is stable unique ordering (INV-PL-012).
  Append-on-arrival gives deterministic order matching creation/move sequence; the unique
  index backstops races (retry once on conflict).
- **Alternatives considered**: fractional ranks (over-engineering for typical group sizes
  of 1–4 meals); renumber-on-every-write (extra round trips for no observable gain).
