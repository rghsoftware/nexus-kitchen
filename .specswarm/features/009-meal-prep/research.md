# Research: Meal Prep — Batch Sessions

All NEEDS CLARIFICATION items were resolved during /ss:specify and /ss:clarify (two scope forks +
one schema-resolved scaling question). This file records the design decisions and the alternatives
weighed.

## D1 — Where does the session aggregate live?
**Decision**: Planning module (`src/lib/planning/mealPrep/`), reusing Inventory's prepped-meal stack
for yield.
**Rationale**: The logical architecture (§3 module table) lists `meal_prep_sessions` under Planning,
`prepped_meals`/`portion_events` under Inventory. Sessions *produce* prepped portions; they don't own
them. Keeping the boundary avoids duplicating the portion ledger.
**Alternatives**: Put sessions under `pantry/` next to prepped meals — rejected; conflates planning
intent with inventory state and crosses the documented module boundary.

## D2 — How is yield made idempotent without a transaction?
**Decision**: Before yielding, query `prepped_meals` for rows with `meal_prep_session_id = session.id`.
If any exist, completion is a no-op. Yield portions first, then flip `status=COMPLETED`.
**Rationale**: SPA + online-first (P15, P1/P2): no server function, so no multi-statement DB
transaction from the client. The `meal_prep_session_id` linkage is itself the idempotency key — it
already exists on `prepped_meals` (migration 0003). A retry after partial failure detects the partial
portions and won't double-create.
**Alternatives**: (a) A local "yielded" boolean — rejected, not server-authoritative (P15). (b) An
Edge Function doing a transactional yield — viable but heavier; deferred, not needed for single-user
MVP. (c) Flip status first then yield — rejected; a failure after status-flip would strand a
"COMPLETED" session with no portions and no retry path.

## D3 — Reuse `addPreppedMeal()` for yield vs. a bespoke insert?
**Decision**: Reuse `addPreppedMeal()` (preppedMealService.ts:35) once per session recipe.
**Rationale**: It already encapsulates the row-insert + `INITIALIZED` portion event + re-fetch,
honoring P14 (append-only ledger) and INV-CC-006. A bespoke path would duplicate and risk drifting
from the ledger invariant.
**Alternatives**: Direct multi-row insert + manual events — rejected; re-implements an invariant-bearing
seam.

## D4 — Ingredient scaling & pantry gap for prep→shopping
**Decision**: required = `recipe_ingredient.quantity × (servingsToPrep / recipe.servings)`. Gap =
required ingredients whose normalized name is absent from the pantry-on-hand index (quantity > 0).
**Rationale**: `recipes.servings` is `NOT NULL CHECK 1..100` and `recipe_ingredients.quantity` is
`NOT NULL > 0` (0001_recipes.sql), so scaling is total. Presence-by-name gap detection matches
fulfillment v1 (`fulfillment.ts`) — consistent inventory semantics, no unit math in v1.
**Alternatives**: Unit-aware quantity reconciliation against pantry quantities — rejected for v1;
fulfillment itself does no quantity math, so introducing it only here would be inconsistent.

## D5 — Shopping `FROM_PREP` schema shape
**Decision**: `ALTER TYPE shopping_list_source ADD VALUE 'FROM_PREP'`; add nullable
`meal_prep_session_id` to `shopping_lists` with a CHECK: `FROM_PREP ⇒ session id set`, and the
existing FROM_PLAN range CHECK left intact. INV-XD-004.
**Rationale**: The shopping migration (0007:13) explicitly deferred `FROM_PREP`; this is the planned
follow-up. `ALTER TYPE ... ADD VALUE` is the minimal, additive change.
**Gotcha**: Postgres historically disallowed using a newly-added enum value in the *same* transaction.
Put the `ADD VALUE` in its own migration step (or before the CHECK that references it) so a fresh
`supabase start` applies cleanly. The migration is authored to add the value first, then the column +
constraint.
**Alternatives**: A separate `shopping_list_prep_sources` link table — rejected; over-engineered for a
single nullable FK that mirrors the existing FROM_PLAN range columns' pattern.

## D6 — Suggested prep day
**Decision**: default to the nearest upcoming weekend day (Sat/Sun; today if today is one),
user-overridable to any non-past date.
**Rationale**: REQ-PP-003 ("common prep days, e.g. weekends") + REQ-PP-004 (override). Pure date logic,
unit-testable, no timezone surprises (compare on local calendar date).

## D7 — Per-portion vs per-session storage location at completion
**Decision**: capture a storage location **per yielded recipe** at completion, defaulting all to one
session-level choice the user can change per line.
**Rationale**: REQ-PP-016 (freezer vs fridge drives shelf life) needs per-portion granularity (some
items freeze, some don't), but a single default keeps the common case one tap.
**Alternatives**: Single session-wide location — rejected; forces all-or-nothing freezing.
