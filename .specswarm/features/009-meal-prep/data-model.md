# Data Model: Meal Prep — Batch Sessions

## New tables (migration 0009)

### `meal_prep_sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK `DEFAULT gen_random_uuid()` | P8 |
| `owner_id` | `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | RLS scope |
| `household_id` | `uuid` (nullable, no FK) | mirrors `prepped_meals`; Household feature later |
| `status` | `meal_prep_session_status NOT NULL DEFAULT 'PLANNED'` | enum below |
| `prep_day` | `date NOT NULL` | suggested/overridden (REQ-PP-003/004) |
| `completed_at` | `timestamptz` (nullable) | set iff `status='COMPLETED'` (INV-PL-008) |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | P9 |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | P9 |

Enum: `CREATE TYPE meal_prep_session_status AS ENUM ('PLANNED','COMPLETED','CANCELLED');`

Constraint (INV-PL-008):
```sql
CONSTRAINT meal_prep_sessions_completed_has_timestamp
  CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
```
Indexes: `(owner_id)`, `(household_id)`, `(prep_day)`.

> INV-PL-006 (≥1 recipe per session) is a cross-row invariant — enforced in the service layer
> (a session is created together with its first recipe; a recipe-removal that would empty a session
> is rejected). Documented as not statically enforceable by a single-table CHECK, same pattern the
> recipes module uses for "≥1 ingredient" (0001_recipes.sql:8).

### `meal_prep_session_recipes`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK `DEFAULT gen_random_uuid()` | P8 |
| `meal_prep_session_id` | `uuid NOT NULL REFERENCES meal_prep_sessions(id) ON DELETE CASCADE` | |
| `recipe_id` | `uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE` | |
| `recipe_name` | `text NOT NULL CHECK (char_length(recipe_name) BETWEEN 1 AND 500)` | denormalized snapshot |
| `servings_to_prep` | `integer NOT NULL CHECK (servings_to_prep > 0)` | INV-PL-007 |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Constraint: `UNIQUE (meal_prep_session_id, recipe_id)` — a recipe appears at most once per session.
Index: `(meal_prep_session_id)`.

### RLS (P7 — default-deny, owner-scoped)
```sql
ALTER TABLE meal_prep_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meal_prep_sessions_owner_all" ON meal_prep_sessions
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

ALTER TABLE meal_prep_session_recipes ENABLE ROW LEVEL SECURITY;
-- access gated through the parent session's ownership
CREATE POLICY "meal_prep_session_recipes_owner_all" ON meal_prep_session_recipes
  FOR ALL USING (EXISTS (SELECT 1 FROM meal_prep_sessions s
                         WHERE s.id = meal_prep_session_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM meal_prep_sessions s
                      WHERE s.id = meal_prep_session_id AND s.owner_id = auth.uid()));
```

### Data API grants (per project memory — post-2026-05-30 grant flip)
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_prep_sessions, meal_prep_session_recipes TO authenticated;
GRANT ALL    ON meal_prep_sessions, meal_prep_session_recipes TO service_role;
GRANT SELECT ON meal_prep_sessions, meal_prep_session_recipes TO anon;  -- RLS still yields 0 rows pre-login
```
`updated_at` touch trigger on `meal_prep_sessions` matching the repo's existing convention.

### Ownership guard (security review)
`check_session_recipe_ownership()` (SECURITY DEFINER, `BEFORE INSERT OR UPDATE OF recipe_id`)
rejects a session recipe whose `recipe_id` is not owned by `auth.uid()` — the bare FK would
otherwise be a cross-user existence oracle and could propagate a foreign `recipe_id` into yielded
`prepped_meals`. Mirrors 0007's `check_source_planned_meal_ownership`.

## Altered table (migration 0010) — shopping FROM_PREP (INV-XD-004)

```sql
-- Step 1 (own statement): extend the enum
ALTER TYPE shopping_list_source ADD VALUE IF NOT EXISTS 'FROM_PREP';

-- Step 2: link column + integrity
ALTER TABLE shopping_lists ADD COLUMN meal_prep_session_id uuid
  REFERENCES meal_prep_sessions(id) ON DELETE SET NULL;

ALTER TABLE shopping_lists ADD CONSTRAINT shopping_lists_from_prep_has_session
  CHECK (
    (source_type =  'FROM_PREP' AND meal_prep_session_id IS NOT NULL) OR
    (source_type <> 'FROM_PREP' AND meal_prep_session_id IS NULL)
  );
```
Existing `FROM_PLAN` range CHECK (0007) is untouched. `FROM_PREP` lists carry no generated_range
(those remain NULL — the existing range CHECK only constrains FROM_PLAN).

### Detach-on-delete (security review)
`detach_prep_shopping_lists()` (`BEFORE DELETE ON meal_prep_sessions`) flips any linked
`FROM_PREP` list to `MANUAL` and nulls its `meal_prep_session_id` before the FK's `SET NULL`
fires. Without it, deleting a session that generated a shopping list would null the FK on a row
still tagged `FROM_PREP`, violating the INV-XD-004 CHECK and aborting the delete (and the
`auth.users` delete cascade). The list is the user's work product and survives as a plain list.

## Reused tables (no schema change)
- `prepped_meals` (0003): yield target — `origin='PREP_SESSION'`, `meal_prep_session_id` set,
  `recipe_id`/`recipe_name` set (INV-INV-006). `meal_prep_session_id` column already exists.
- `portion_events` (0004): `INITIALIZED` event per yielded portion (via `addPreppedMeal()`).
- `recipes` / `recipe_ingredients` (0001): read for scaling & shopping aggregation.
- `pantry_items` (0002): read for gap detection.
- `planned_meals` (0006): PREPPED source already supports prepped portions (feature 004).

## Client types (new — `src/lib/planning/mealPrep/types.ts`)

```ts
export type MealPrepSessionStatus = 'PLANNED' | 'COMPLETED' | 'CANCELLED';

export interface MealPrepSessionRecipe {
	id: string;
	recipeId: string;
	recipeName: string;
	servingsToPrep: number;
}

export interface MealPrepSession {
	id: string;
	status: MealPrepSessionStatus;
	prepDay: string;           // ISO date
	completedAt: string | null;
	recipes: MealPrepSessionRecipe[];
}

export interface NewMealPrepSession {
	prepDay: string;
	recipes: { recipeId: string; recipeName: string; servingsToPrep: number }[]; // length >= 1
}

/** Per-recipe storage choice captured at completion. */
export interface YieldChoice {
	sessionRecipeId: string;
	storageLocation: 'FRIDGE' | 'FREEZER';
}

/** Pure prep→shopping output (prepShoppingList.ts). */
export interface PrepShoppingGapItem {
	name: string;
	unit: string;
	quantity: number;
	forRecipes: string[];      // recipe names that contribute this item
}
```

## State transitions

```
            create (>=1 recipe)
   ∅ ───────────────────────────▶ PLANNED
                                     │  complete()  [guard: no existing yielded portions]
                                     │   ├─ yield N prepped_meals (origin=PREP_SESSION, INITIALIZED events)
                                     │   └─ set status=COMPLETED, completed_at=now()
                                     ▼
                                  COMPLETED  (terminal)
   PLANNED ──cancel()──▶ CANCELLED  (terminal; no portions created)
```
Completion is idempotent: re-running `complete()` on a session that already has linked prepped
portions performs no further yield (FR-PP-014).
