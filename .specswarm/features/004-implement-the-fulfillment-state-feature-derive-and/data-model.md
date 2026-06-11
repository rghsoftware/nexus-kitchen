# Data Model: Fulfillment State

## Persisted changes (migration 0006)

### `planned_meals` (altered — no new tables)

| Column | Type | Change |
|--------|------|--------|
| `prepped_name_snapshot` | `text` NULL, CHECK length 1..500 when set | **NEW** — denormalized portion name captured at placement (mirrors `recipe_title_snapshot`, FR-PL-019 pattern) |
| `prepped_meal_id` | `uuid` FK → `prepped_meals` ON DELETE SET NULL | unchanged column; CHECK no longer requires it for PREPPED rows |

### Constraint rewrite: `planned_meals_exactly_one_source` (INV-PL-003)

| source | required | must be NULL |
|--------|----------|--------------|
| RECIPE | `recipe_title_snapshot` | `prepped_meal_id`, `prepped_name_snapshot`, `store_bought_name`, `quick_meal_name` |
| PREPPED | `prepped_name_snapshot` | `recipe_id`, `recipe_title_snapshot`, `store_bought_name`, `quick_meal_name` |
| STORE_BOUGHT | `store_bought_name` | `recipe_id`, `recipe_title_snapshot`, `prepped_meal_id`, `prepped_name_snapshot`, `quick_meal_name` |
| QUICK | `quick_meal_name` | `recipe_id`, `recipe_title_snapshot`, `prepped_meal_id`, `prepped_name_snapshot`, `store_bought_name` |

(`recipe_id` nullable for RECIPE, `prepped_meal_id` nullable for PREPPED — both SET NULL-safe.)

**Explicitly NOT added**: any fulfillment-state column (INV-PL-017).

## Derived, in-memory types (client only)

```ts
// src/lib/planning/fulfillment.ts
export type FulfillmentState = 'HAVE_IT' | 'CAN_MAKE_IT' | 'MUST_ACQUIRE';

export interface FulfillmentResult {
	state: FulfillmentState;
	/** Required-ingredient names not on hand; non-empty only for RECIPE + MUST_ACQUIRE. */
	missingIngredients: string[];
}

/** null = not fulfillment-tracked (QUICK, non-PLANNED status) or inputs unavailable. */
export interface FulfillmentInputs {
	pantryIndex: Set<string>; // normalized names of pantry items with quantity > 0
	preppedById: Map<string, { portionsRemaining: number }>;
	ingredientsByRecipeId: Map<string, IngredientForMatch[]> | null; // null until fetched
}

export interface IngredientForMatch {
	id: string;
	name: string;
	isOptional: boolean;
	substituteFor: string | null; // recipe_ingredients.id of the base ingredient
}
```

### Derivation rules (FR-FS-001..004, Assumptions)

```
status ≠ PLANNED            → null (not tracked)
source = QUICK              → null (not tracked)
source = PREPPED:
  portion exists ∧ portionsRemaining > 0   → HAVE_IT
  otherwise (exhausted / deleted ref)      → MUST_ACQUIRE
source = STORE_BOUGHT       → MUST_ACQUIRE (always; buy-gap)
source = RECIPE:
  recipeId null ∨ ingredients unknown/empty → MUST_ACQUIRE (cannot verify)
  required = ingredients where !isOptional ∧ no other ingredient substitutes... (see below)
  each required ing satisfied ⇔ normalized(ing.name) ∈ pantryIndex
                                ∨ ∃ sub: sub.substituteFor = ing.id ∧ normalized(sub.name) ∈ pantryIndex
  all satisfied               → CAN_MAKE_IT
  else                        → MUST_ACQUIRE with missingIngredients = unsatisfied names
```

Normalization: `name.trim().toLowerCase().replace(/\s+/g, ' ')`.

## Application-shape changes

```ts
// src/lib/planning/types.ts
interface PlannedMeal {
	// ... existing fields ...
	preppedMealId: string | null;        // NEW mapping (column existed)
	preppedNameSnapshot: string | null;  // NEW
}

type PlannedMealDraft =
	| { source: 'RECIPE'; recipeId: string; recipeTitle: string; servings: number }
	| { source: 'PREPPED'; preppedMealId: string; preppedName: string; servings: number } // NEW
	| { source: 'STORE_BOUGHT'; storeBoughtName: string; servings: number }
	| { source: 'QUICK'; quickMealName: string; servings: number };
```

`plannedMealName()` PREPPED case returns `preppedNameSnapshot ?? 'Prepped meal'`.

## Relationships consumed (read-only)

- `recipe_ingredients` (feature 001): `recipe_id`, `name`, `is_optional`, `substitute_for`
- `pantry_items` (feature 002): `name`, `quantity`
- `prepped_meals` (feature 002): `id`, `name`, `portions_remaining`, `storage_location`
