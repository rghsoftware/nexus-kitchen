# Data Model: Planning — Place Planned Meals on a Calendar

**Feature**: 003-planning-place-planned-meals-recipe
**Source of truth**: Domain Specification §2.4 (Planning Context), §3.4 (Planning Invariants)

## Enums

```sql
CREATE TYPE meal_slot           AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');
CREATE TYPE planned_meal_source AS ENUM ('RECIPE', 'PREPPED', 'STORE_BOUGHT', 'QUICK');
CREATE TYPE planned_meal_status AS ENUM ('PLANNED', 'LOGGED', 'SKIPPED', 'SWAPPED');
```

- `meal_slot` is used as a **nullable** column: `NULL` = unslotted / "Anytime" (Domain Spec §2.4 MealSlot notes). Never merge with recipe `MealType`.
- `planned_meal_source` carries the full domain enum; `PREPPED` is reserved (A-003) and not creatable via UI this chunk.
- `planned_meal_status`: only `PLANNED` is written this chunk (A-002); others reserved for the Logging feature (state machine §5.4).

## Table: meal_plans

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default `gen_random_uuid()` | P8 |
| owner_id | uuid | NOT NULL, FK `auth.users(id)` ON DELETE CASCADE | |
| household_id | uuid | nullable, no FK yet | same convention as `pantry_items` |
| name | text | nullable, CHECK length ≤ 200 when set | always NULL for implicit weekly plans (A-009) |
| start_date | date | NOT NULL | Monday (A-009) |
| end_date | date | NOT NULL | Sunday (A-009) |
| created_at | timestamptz | NOT NULL default now() | P9 |
| updated_at | timestamptz | NOT NULL default now(), trigger | P9 |

**Constraints**

- `CHECK (end_date >= start_date)` — **INV-PL-001**
- `UNIQUE (owner_id, start_date)` — one implicit plan per week per owner (FR-PL-011); upsert target
- RLS: enabled; owner-only `FOR ALL USING/WITH CHECK (owner_id = auth.uid())` — P7, FR-PL-017
- Index: `(owner_id, start_date)` (covered by unique), realtime publication added

## Table: planned_meals

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, default `gen_random_uuid()` | P8 |
| meal_plan_id | uuid | NOT NULL, FK `meal_plans(id)` ON DELETE CASCADE | |
| date | date | NOT NULL | civil date (A-006); trigger-checked vs plan range |
| meal_slot | meal_slot | nullable | NULL = Anytime |
| source | planned_meal_source | NOT NULL | |
| recipe_id | uuid | nullable, FK `recipes(id)` ON DELETE SET NULL | set iff source=RECIPE at creation |
| recipe_title_snapshot | text | nullable | NOT NULL iff source=RECIPE (A-005, FR-PL-019) |
| prepped_meal_id | uuid | nullable, FK `prepped_meals(id)` ON DELETE SET NULL | reserved; never set this chunk |
| store_bought_name | text | nullable, CHECK length 1–200 when set | iff source=STORE_BOUGHT |
| quick_meal_name | text | nullable, CHECK length 1–200 when set | iff source=QUICK |
| servings | numeric(6,2) | NOT NULL, CHECK `servings > 0` | **INV-PL-004**; default from recipe or 1 |
| status | planned_meal_status | NOT NULL default 'PLANNED' | |
| logged_at | timestamptz | nullable | **INV-PL-005**: `CHECK (status <> 'LOGGED' OR logged_at IS NOT NULL)` |
| sort_order | integer | NOT NULL, CHECK ≥ 0 | append = max(group)+1 |
| created_at | timestamptz | NOT NULL default now() | P9 |
| updated_at | timestamptz | NOT NULL default now(), trigger | P9 |

**Constraints**

- **INV-PL-003 (exactly one source, matching `source`)**:
  ```sql
  CHECK (
    (source = 'RECIPE'       AND recipe_title_snapshot IS NOT NULL AND prepped_meal_id IS NULL AND store_bought_name IS NULL AND quick_meal_name IS NULL) OR
    (source = 'PREPPED'      AND prepped_meal_id IS NOT NULL AND recipe_id IS NULL AND recipe_title_snapshot IS NULL AND store_bought_name IS NULL AND quick_meal_name IS NULL) OR
    (source = 'STORE_BOUGHT' AND store_bought_name IS NOT NULL AND recipe_id IS NULL AND recipe_title_snapshot IS NULL AND prepped_meal_id IS NULL AND quick_meal_name IS NULL) OR
    (source = 'QUICK'        AND quick_meal_name IS NOT NULL AND recipe_id IS NULL AND recipe_title_snapshot IS NULL AND prepped_meal_id IS NULL AND store_bought_name IS NULL)
  )
  ```
  For RECIPE rows the *snapshot* is the required reference (not `recipe_id`), so
  `ON DELETE SET NULL` on a deleted recipe cannot violate the constraint while the
  display name survives (research.md decision 5).
- **INV-PL-012**: `UNIQUE NULLS NOT DISTINCT (meal_plan_id, date, meal_slot, sort_order)`
- **INV-PL-002**: `BEFORE INSERT OR UPDATE OF date, meal_plan_id` trigger raising when
  `NEW.date` ∉ `[plan.start_date, plan.end_date]`
- RLS: enabled; owner-scoped through the parent plan:
  ```sql
  USING (EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = meal_plan_id AND mp.owner_id = auth.uid()))
  WITH CHECK (… same …)
  ```
- Indexes: `(meal_plan_id)`, `(date)`, `(recipe_id)`; realtime publication added

## TypeScript types (`src/lib/planning/types.ts`)

```ts
export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type PlannedMealSource = 'RECIPE' | 'PREPPED' | 'STORE_BOUGHT' | 'QUICK';
export type PlannedMealStatus = 'PLANNED' | 'LOGGED' | 'SKIPPED' | 'SWAPPED';

export interface MealPlan {
	id: string;
	ownerId: string;
	name: string | null;
	startDate: string; // YYYY-MM-DD, Monday
	endDate: string; // YYYY-MM-DD, Sunday
	createdAt: string;
	updatedAt: string;
}

export interface PlannedMeal {
	id: string;
	mealPlanId: string;
	date: string; // YYYY-MM-DD
	mealSlot: MealSlot | null; // null = Anytime
	source: PlannedMealSource;
	recipeId: string | null;
	recipeTitleSnapshot: string | null;
	storeBoughtName: string | null;
	quickMealName: string | null;
	servings: number;
	status: PlannedMealStatus;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

/** Discriminated draft for creation — makes INV-PL-003 unrepresentable client-side. */
export type PlannedMealDraft =
	| { source: 'RECIPE'; recipeId: string; recipeTitle: string; servings: number }
	| { source: 'STORE_BOUGHT'; storeBoughtName: string; servings: number }
	| { source: 'QUICK'; quickMealName: string; servings: number };

export interface PlannedMealPlacement {
	date: string; // YYYY-MM-DD
	mealSlot: MealSlot | null;
}

/** Display name regardless of source. */
export function plannedMealName(m: PlannedMeal): string;
```

## State transitions

`status` is `PLANNED` for every row written this chunk. The §5.4 state machine
(PLANNED → LOGGED | SKIPPED | SWAPPED) is reserved for the Logging feature; the
`logged_at` CHECK already guards INV-PL-005 for when it arrives.

## Derived data (explicitly NOT stored)

Fulfillment state (`HAVE_IT` / `CAN_MAKE_IT` / `MUST_ACQUIRE`) is **never persisted**
(INV-PL-017) and is **not computed in this chunk** (spec Scope). No columns exist for it.
