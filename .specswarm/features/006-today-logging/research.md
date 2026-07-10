# Research: Today dashboard, one-tap meal logging & meal verdicts

## R1 — Verdict shape: three-way enum on the log row

**Decision:** `meal_verdict AS ENUM ('KEEP','FINE','REST')` as a nullable column on
`meal_logs`; no separate verdict table, no denormalised copy on recipes.
Canonical mockups + shipped `.nk-verdict` primitives use the three-way control; the
four-value `MealRating` in the domain spec is the superseded earlier design (recorded in
spec Clarifications). A verdict belongs to an eating occurrence (you can love a recipe on
Tuesday and set it aside after the fourth reheat); per-source marks (Keeper) are the
*latest* verdict per source, derived at query time. Rejected: separate `meal_verdicts`
append-only table (over-modelling — one mutable column with a trigger guard preserves
append-only occurrence facts with far less machinery); reuse of `user_recipe_meta.rating`
(different concept: deliberate 1–5 recipe review vs. instant meal verdict; also logs are
frequently not recipe-backed).

## R2 — Append-only with annotation window

**Decision:** RLS grants INSERT/SELECT/UPDATE (owner-scoped), **no DELETE policy and no
DELETE grant**; a `BEFORE UPDATE` trigger raises unless the only changed columns are
`verdict` and/or `notes`. This satisfies INV-CC-004/REQ-CN-007 (occurrence facts can
never be overwritten) while honouring the design's "set a verdict anytime later".
Rejected: fully immutable rows + verdict side-table (R1); app-layer-only enforcement
(defence in depth is cheap here and pgTAP-testable).

## R3 — Type↔reference validation via trigger, not CHECK

**Decision:** enforce INV-XD-001/002 (`FROM_PLAN ⇒ planned_meal_id`, `FROM_PREPPED ⇒
prepped_meal_id`, plus `FROM_RECIPE ⇒ recipe_id`, `CUSTOM ⇒ name_snapshot`) in a
`BEFORE INSERT` trigger. Source FKs are `ON DELETE SET NULL` for durability of history
(name snapshot preserves display), so a table CHECK would make deleting a source row
fail its cascading UPDATE. Insert-time validation is exactly what the invariants mean.
Cross-user probing is blocked by a SECURITY DEFINER ownership-check trigger (pattern:
`check_source_planned_meal_ownership`, migration 0007); `planned_meals` ownership is
checked via its parent `meal_plans`.

## R4 — Prepped consumption reuses the ledger, linked by `triggered_by`

**Decision:** logging FROM_PREPPED calls the existing consume path
(`consumePortions` / `optimisticConsumePortions`), extended with an optional
`triggeredBy` parameter so the CONSUMED event carries the meal-log id — the exact use
reserved in migration 0004's comment. The DB trigger `sync_portions_remaining` stays the
single writer of `portions_remaining` and raises on negative balances (INV-INV-004).
Rejected: DB AFTER-INSERT trigger on `meal_logs` creating the portion event (hides a
cross-aggregate write, complicates optimistic UI reconciliation, and INV-CON-003
explicitly allows client-logic orchestration).

## R5 — Multi-write orchestration: log first, follow-ups reported

**Decision:** insert the `meal_logs` row first (the user's truth), then run follow-ups
sequentially: CONSUMED portion event (FROM_PREPPED) or planned-meal safe-flip
(FROM_PLAN, `UPDATE … WHERE id = ? AND status = 'PLANNED'`). Follow-up failures keep the
log, surface a calm notice, and are reported per step — the established
`completeTrip` pattern from feature 005. Rejected: transactional RPC (needs a Postgres
function + loses optimistic granularity; the failure mode is benign and self-describing).

## R6 — "Today", slots, and nudge windows are client-local

**Decision:** "today" = the device's local calendar day; the service takes explicit
`[dayStartISO, dayEndISO)` bounds computed client-side (same approach as planning's week
math). Slot windows are fixed constants (breakfast 06:00–10:00, lunch 11:00–14:00,
dinner 17:00–21:00, otherwise snack) used for both the Quick Log default slot and the
nudge banner; `deriveNudge(now, plannedMeals, logs, dismissals)` is a pure function.
Nudge dismissals live in `localStorage` keyed `nk-nudge-dismissed:<date>:<slot>` —
device-local by design (no server round-trip for a courtesy banner). Rejected:
user-configurable windows (belongs to reminders/007).

## R7 — Recents & keepers derivation

**Decision:** one query over the user's last 100 logs (excluding QUICK_LOG), grouped
client-side by source identity (`recipe_id` → `prepped source` → lowercased
`name_snapshot`): *recents* = latest N distinct sources; *keepers* = sources whose most
recent non-null verdict is KEEP, with `timesMade` = occurrence count. Client-side
grouping keeps PostgREST usage trivial and the logic unit-testable; 100 rows is ample
for a personal log. Rejected: SQL view/RPC (premature; revisit when suggestion features
need server-side aggregation).

## R8 — Coverage card reuses feature 004 fulfillment verbatim

**Decision:** the day-coverage chips and per-card primary action call the existing
fulfillment derivation (`derivePlannedMealFulfillment` seam from feature 004) against
the same inventory snapshot the planner uses; logged meals display as "Eaten" regardless
of fulfillment. No new derivation logic. Rejected: persisting coverage (fulfillment is
display-time by design).

## R9 — Sheet accessibility done properly this time

**Decision:** the Quick Log sheet implements Escape-to-close, backdrop click, focus
restoration to the invoking control, and `inert` on the background app shell — the gaps
past reviews flagged on planning's sheets. Scoped to the new sheet; retrofitting
planning's sheets is separate cleanup. Verdict buttons follow the mockup contract:
`aria-pressed`, tap-again-to-clear, ≥44 px targets, icon + label always.
