# Data Model: Shopping

## Enums

```sql
CREATE TYPE shopping_list_source AS ENUM ('MANUAL', 'FROM_PLAN');           -- FROM_PREP deferred (INV-XD-004)
CREATE TYPE shopping_list_status AS ENUM ('ACTIVE', 'SHOPPING', 'COMPLETED', 'ARCHIVED');
CREATE TYPE shopping_item_status AS ENUM ('PENDING', 'CHECKED', 'UNAVAILABLE', 'REMOVED');
CREATE TYPE shopping_category    AS ENUM ('PRODUCE', 'DAIRY', 'MEAT_SEAFOOD', 'CANNED',
                                          'FROZEN', 'BAKERY', 'PANTRY_STAPLES', 'OTHER');
```

Display order of categories = enum order. Statuses per Domain Specification §2.5 and
the §5.3 item state machine.

## Table: shopping_lists

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `gen_random_uuid()` (P8) |
| owner_id | uuid | NOT NULL, default `auth.uid()`, FK `auth.users` ON DELETE CASCADE |
| household_id | uuid | nullable, no FK (Household feature later) |
| name | text | NOT NULL, `char_length BETWEEN 1 AND 100` |
| source_type | shopping_list_source | NOT NULL, default `'MANUAL'` |
| generated_range_start | date | nullable; set iff FROM_PLAN |
| generated_range_end | date | nullable; set iff FROM_PLAN; `>= start` |
| status | shopping_list_status | NOT NULL, default `'ACTIVE'` |
| completed_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | NOT NULL default now(); `set_updated_at()` trigger (P9) |

CHECKs:
- `shopping_lists_completed_at_pairing`: `status <> 'COMPLETED' OR completed_at IS NOT NULL` (INV-SH-004)
- `shopping_lists_range_pairing`: `(source_type = 'FROM_PLAN') = (generated_range_start IS NOT NULL AND generated_range_end IS NOT NULL)`
- `shopping_lists_range_valid`: `generated_range_end IS NULL OR generated_range_end >= generated_range_start`

Indexes: `(owner_id)`, `(owner_id, status)`.

RLS (P7, default-deny): single owner-all policy `owner_id = auth.uid()` (FOR ALL,
USING + WITH CHECK), same as pantry_items/meal_plans.

## Table: shopping_list_items

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default `gen_random_uuid()` |
| shopping_list_id | uuid | NOT NULL, FK `shopping_lists` ON DELETE CASCADE |
| ingredient_id | uuid | nullable (no master ingredient table yet) |
| name | text | NOT NULL, `char_length BETWEEN 1 AND 200` |
| quantity | numeric(10,3) | NOT NULL default 1, `CHECK (quantity > 0)` (INV-SH-002) |
| unit | text | NOT NULL default `'x'` (free text) |
| category | shopping_category | NOT NULL default `'OTHER'` (FR-SH-019) |
| needed_for | jsonb | NOT NULL default `'[]'` — `[{ "recipeId": uuid\|null, "title": text }]` (FR-SH-009; title is a snapshot) |
| source_planned_meal_id | uuid | nullable, FK `planned_meals` ON DELETE SET NULL (FR-SH-018) |
| status | shopping_item_status | NOT NULL default `'PENDING'` |
| checked_at | timestamptz | nullable |
| checked_by_user_id | uuid | nullable (attribution, REQ-HH-010-ready) |
| sort_order | integer | NOT NULL default 0, `CHECK (sort_order >= 0)` |
| created_at / updated_at | timestamptz | NOT NULL default now(); trigger |

CHECKs:
- `shopping_list_items_checked_at_pairing`: `status <> 'CHECKED' OR checked_at IS NOT NULL` (INV-SH-003)

Indexes: `(shopping_list_id)`, `(shopping_list_id, status)`.

RLS (P7): policies via parent-list ownership —
`EXISTS (SELECT 1 FROM shopping_lists sl WHERE sl.id = shopping_list_id AND sl.owner_id = auth.uid())`
for ALL (USING + WITH CHECK), mirroring `planned_meals` policies in 0005.

**Not enforced in DB**: INV-SH-001 (active list ≥ 1 item) — cross-row; app-layer
(see research R1).

## State machines

- **List**: ACTIVE → SHOPPING → COMPLETED; ACTIVE/SHOPPING/COMPLETED → ARCHIVED.
  (SHOPPING is entered when the user opens the trip view / first check; cosmetic,
  no constraint hangs on it.)
- **Item** (Domain Spec §5.3): PENDING ⇄ CHECKED (uncheck clears `checked_at`);
  CHECKED → UNAVAILABLE; any → REMOVED. REMOVED rows are kept (filtered out of UI)
  so completion accounting stays truthful.

## Application types (`src/lib/shopping/types.ts`)

```ts
export type ShoppingListSource = Enums<'shopping_list_source'>;
export type ShoppingListStatus = Enums<'shopping_list_status'>;
export type ShoppingItemStatus = Enums<'shopping_item_status'>;
export type ShoppingCategory  = Enums<'shopping_category'>;

export interface ShoppingList {
  id: string; ownerId: string; name: string;
  sourceType: ShoppingListSource;
  generatedRangeStart: ISODate | null; generatedRangeEnd: ISODate | null;
  status: ShoppingListStatus; completedAt: string | null;
  createdAt: string; updatedAt: string;
}

export interface NeededFor { recipeId: string | null; title: string }

export interface ShoppingItem {
  id: string; shoppingListId: string;
  name: string; quantity: number; unit: string;
  category: ShoppingCategory;
  neededFor: NeededFor[];
  sourcePlannedMealId: string | null;
  status: ShoppingItemStatus; checkedAt: string | null;
  sortOrder: number; createdAt: string; updatedAt: string;
}
```

Note: the pantry seam keeps its own minimal `ShoppingListItem` shape
(`{ id, name, quantity, unit, storageLocation? }`) in `src/lib/pantry/types.ts` —
the shopping side maps to it when calling `addPantryItemsFromShoppingList`.

## Derived/pure interfaces

```ts
// generation.ts
export interface IngredientGap { name: string; suggestedQuantity: number; unit: string;
                                 category: ShoppingCategory; neededFor: NeededFor[] }
export interface StoreBoughtGap { plannedMealId: string; name: string; servings: number }
export interface GapResult { ingredientGaps: IngredientGap[]; storeBoughtGaps: StoreBoughtGap[] }

computeBuyGaps(meals: PlannedMeal[], inputs: FulfillmentInputs,
               existingPendingNames: ReadonlySet<string>): GapResult

// categorize.ts
categorize(name: string): ShoppingCategory   // keyword map, default OTHER

// replenishment.ts
planReplenishment(checkedItems: ShoppingItem[], pantryItems: PantryItem[]):
  { merges: {pantryItemId, addQuantity}[], inserts: NewPantryItem[] }   // pure
completeTrip(list, items, options): Promise<CompletionReport>          // orchestration
```
