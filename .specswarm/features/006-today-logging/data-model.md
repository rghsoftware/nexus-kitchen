# Data model: Today dashboard, one-tap meal logging & meal verdicts

## Enums

```sql
CREATE TYPE meal_log_type AS ENUM ('FROM_PLAN', 'FROM_RECIPE', 'FROM_PREPPED', 'QUICK_LOG', 'CUSTOM');
CREATE TYPE meal_verdict  AS ENUM ('KEEP', 'FINE', 'REST');
```

`meal_slot` is reused from migration 0005 (`BREAKFAST | LUNCH | DINNER | SNACK`).

## Table: meal_logs

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, `gen_random_uuid()` |
| owner_id | uuid | NOT NULL, DEFAULT `auth.uid()`, FK `auth.users` ON DELETE CASCADE |
| household_id | uuid | NULL (no FK until Household feature) |
| log_type | meal_log_type | NOT NULL |
| planned_meal_id | uuid | NULL, FK `planned_meals` ON DELETE SET NULL |
| recipe_id | uuid | NULL, FK `recipes` ON DELETE SET NULL |
| prepped_meal_id | uuid | NULL, FK `prepped_meals` ON DELETE SET NULL |
| name_snapshot | text | NULL; CHECK 1..200 chars when present |
| meal_slot | meal_slot | NULL (unspecified allowed) |
| servings | numeric(6,2) | NOT NULL DEFAULT 1, CHECK `servings > 0` |
| logged_at | timestamptz | NOT NULL DEFAULT `now()` |
| verdict | meal_verdict | NULL |
| notes | text | NULL, CHECK ≤ 1000 chars (domain: 0..1000) |
| created_at | timestamptz | NOT NULL DEFAULT `now()` |
| updated_at | timestamptz | NOT NULL DEFAULT `now()` (shared `set_updated_at()` trigger) |

**CHECKs (row-local):**

- `meal_logs_servings_positive` — `servings > 0` (domain: PositiveDecimal).
- `meal_logs_name_snapshot_len` — `name_snapshot IS NULL OR char_length(name_snapshot) BETWEEN 1 AND 200`.
- `meal_logs_notes_len` — `notes IS NULL OR char_length(notes) <= 1000`.

**Triggers (cross-row / lifecycle — not expressible as CHECKs):**

- `meal_logs_validate_source` BEFORE INSERT — INV-XD-001/002 + spec R3:
  `FROM_PLAN ⇒ planned_meal_id NOT NULL`; `FROM_PREPPED ⇒ prepped_meal_id NOT NULL`;
  `FROM_RECIPE ⇒ recipe_id NOT NULL`; `CUSTOM ⇒ name_snapshot NOT NULL`;
  additionally `log_type <> 'QUICK_LOG' ⇒ name_snapshot NOT NULL`.
  Insert-time only, because source FKs are ON DELETE SET NULL (history durability).
- `meal_logs_check_source_ownership` BEFORE INSERT, SECURITY DEFINER — rejects references
  to another user's `planned_meals` (via parent `meal_plans.owner_id`), `recipes`, or
  `prepped_meals` (pattern: 0007 `check_source_planned_meal_ownership`). Blocks
  cross-user probing that RLS on this table alone cannot.
- `meal_logs_annotation_only` BEFORE UPDATE — INV-CC-004 / REQ-CN-007: compares OLD/NEW
  on every occurrence column explicitly (id, owner, type, refs, snapshot, slot, servings,
  logged_at, created_at) and raises if any differ; only `verdict`, `notes`, and
  `updated_at` may change. Carve-out: the three source references may transition
  value → NULL (never to a different row) — that is what the FKs' ON DELETE SET NULL
  issues when a source is deleted, and blocking it would make logged sources
  undeletable.
- `trg_meal_logs_updated_at` BEFORE UPDATE — shared `set_updated_at()`.

**Indexes:**

- `meal_logs_owner_logged_idx` on `(owner_id, logged_at DESC)` — today window + recents.
- `meal_logs_planned_meal_idx` on `(planned_meal_id)` WHERE NOT NULL.
- `meal_logs_recipe_idx` on `(recipe_id)` WHERE NOT NULL.
- `meal_logs_prepped_idx` on `(prepped_meal_id)` WHERE NOT NULL.

**RLS (P7, default-deny):** enabled in the same migration.
`meal_logs_owner_select` FOR SELECT USING owner; `meal_logs_owner_insert` FOR INSERT
WITH CHECK owner; `meal_logs_owner_update` FOR UPDATE USING/WITH CHECK owner.
**No DELETE policy and no DELETE grant** (append-only, A-004).

**Grants (post-0008 world, required inline):**

```sql
GRANT SELECT, INSERT, UPDATE ON meal_logs TO authenticated;
GRANT ALL ON meal_logs TO service_role;
GRANT SELECT ON meal_logs TO anon;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_logs;
```

## Existing tables touched (no schema change)

- `planned_meals` — first writer of `status = 'LOGGED'`, `logged_at` (safe-flip:
  `UPDATE … WHERE id = ? AND status = 'PLANNED'`, INV-PL-005 CHECK already shipped).
- `portion_events` — CONSUMED events now populate `triggered_by` with the meal-log id
  (column reserved for this in 0004).

## State machines

MealLog has none (append + annotate). PlannedMeal `PLANNED → LOGGED` transition is
existing (0005); this feature merely triggers it.

## Application types (src/lib/log/types.ts)

```ts
export type MealLogType = Enums<'meal_log_type'>; // 'FROM_PLAN' | 'FROM_RECIPE' | 'FROM_PREPPED' | 'QUICK_LOG' | 'CUSTOM'
export type MealVerdict = Enums<'meal_verdict'>;  // 'KEEP' | 'FINE' | 'REST'
export type MealSlot = Enums<'meal_slot'>;

export interface MealLog {
	id: string;
	ownerId: string;
	logType: MealLogType;
	plannedMealId: string | null;
	recipeId: string | null;
	preppedMealId: string | null;
	nameSnapshot: string | null;
	mealSlot: MealSlot | null;
	servings: number;      // Number(row.servings)
	loggedAt: string;      // ISO
	verdict: MealVerdict | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
}

/** Exactly-one-source drafts — invalid combinations unrepresentable. */
export type MealLogDraft =
	| { kind: 'fromPlan'; plannedMeal: PlannedMeal }              // snapshot + slot + servings derived
	| { kind: 'fromPrepped'; preppedMeal: PreppedMeal; slot: MealSlot | null; servings?: number }
	| { kind: 'fromRecipe'; recipeId: string; name: string; slot: MealSlot | null }
	| { kind: 'quick'; slot: MealSlot | null }                    // "I ate something"
	| { kind: 'custom'; name: string; slot: MealSlot | null };
```

## Derived/pure interfaces (unit-testable, no I/O)

```ts
/** R6 — slot inference + nudge derivation (pure). */
export function slotForTime(now: Date): MealSlot;
export interface NudgeState { slot: MealSlot; plannedMealId: string; name: string }
export function deriveNudge(
	now: Date,
	todaysMeals: PlannedMeal[],
	todaysLogs: MealLog[],
	dismissedSlots: MealSlot[]
): NudgeState | null;

/** R7 — grouping over recent logs (pure). */
export interface LoggedSource {
	key: string;                     // recipe:<id> | prepped:<id|name> | name:<lower>
	name: string;
	recipeId: string | null;
	latestVerdict: MealVerdict | null;
	timesMade: number;
	lastLoggedAt: string;
	lastSlot: MealSlot | null;
}
export function groupLogSources(logs: MealLog[]): LoggedSource[];
export function keepers(sources: LoggedSource[]): LoggedSource[];   // latestVerdict === 'KEEP'
export function recents(sources: LoggedSource[], limit: number): LoggedSource[];

/** Recap: unrated, recent, not QUICK_LOG (pure). */
export function unratedRecent(logs: MealLog[], now: Date, limit: number): MealLog[];

/** Coverage: per-slot rollup of fulfillment + logged state (pure; consumes feature 004 output). */
export interface SlotCoverage { slot: MealSlot | null; label: string; state: 'EATEN' | 'HAVE_IT' | 'CAN_MAKE_IT' | 'MUST_ACQUIRE' }
export function deriveDayCoverage(meals: PlannedMealWithFulfillment[], logs: MealLog[]): {
	slots: SlotCoverage[];
	headline: string;   // calm summary sentence
	detail: string;
}
```

Invariant placement summary: servings/name/notes bounds → DB CHECKs; type↔ref presence,
ownership, annotation-only mutability → DB triggers (insert/update-time); portion
arithmetic → existing ledger trigger; PLANNED→LOGGED single-flip → safe-flip UPDATE
predicate (+ existing CHECK `status='LOGGED' ⇒ logged_at NOT NULL`); everything
display-time (coverage, keepers, nudges) → pure client functions.
