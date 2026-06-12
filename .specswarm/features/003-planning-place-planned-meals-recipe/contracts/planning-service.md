# Contract: planningService (`src/lib/planning/planningService.ts`)

The SPA's data "API" is PostgREST via supabase-js; this service module is the contract
surface the store and UI depend on. All functions reject with a typed `PlanningError`
(`message`, `cause`) on failure; none swallow errors.

```ts
import type {
	MealPlan,
	PlannedMeal,
	PlannedMealDraft,
	PlannedMealPlacement
} from './types';

/**
 * Find or create the implicit plan for the week containing `dateISO` (FR-PL-011).
 * Monday-start week (A-009). Upsert on (owner_id, start_date) — race-safe.
 */
export function getOrCreatePlanForWeek(dateISO: string): Promise<MealPlan>;

/**
 * All planned meals with date in [fromISO, toISO], any plan, owner-scoped by RLS.
 * Ordered by date, meal_slot (nulls last), sort_order. Feeds day/week/month views.
 */
export function listPlannedMeals(fromISO: string, toISO: string): Promise<PlannedMeal[]>;

/**
 * Create a planned meal at `placement` (FR-PL-005..010).
 * - Resolves the target week's plan via getOrCreatePlanForWeek(placement.date).
 * - Appends: sort_order = max(group) + 1 (retries once on unique-violation race).
 * - RECIPE drafts capture recipeTitle as recipe_title_snapshot (A-005).
 */
export function addPlannedMeal(
	draft: PlannedMealDraft,
	placement: PlannedMealPlacement
): Promise<PlannedMeal>;

/**
 * Patch servings / slot / source-detail fields of an existing meal (FR-PL-012).
 * Slot changes re-append within the new (date, slot) group.
 * Source-kind itself is immutable; changing kind = remove + add (UI concern).
 */
export function updatePlannedMeal(
	id: string,
	patch: Partial<{
		servings: number;
		mealSlot: PlannedMeal['mealSlot'];
		storeBoughtName: string;
		quickMealName: string;
		recipeId: string;
		recipeTitleSnapshot: string;
	}>
): Promise<PlannedMeal>;

/**
 * Move a meal to a new date and/or slot (FR-PL-013, FR-PL-015).
 * Cross-week moves re-home: getOrCreatePlanForWeek(target.date), update
 * meal_plan_id + date + meal_slot, append to target group's order.
 */
export function movePlannedMeal(
	id: string,
	target: PlannedMealPlacement
): Promise<PlannedMeal>;

/** Delete a planned meal (FR-PL-014). */
export function removePlannedMeal(id: string): Promise<void>;
```

## Behavioral guarantees

| Guarantee | Backstop |
|-----------|----------|
| Exactly one source reference per meal | DB CHECK (INV-PL-003); `PlannedMealDraft` union makes invalid drafts untypeable |
| servings > 0 | DB CHECK (INV-PL-004); UI input min |
| date within plan range | trigger (INV-PL-002); service always routes through the date's week-plan |
| unique sort_order per (plan, date, slot) | UNIQUE NULLS NOT DISTINCT (INV-PL-012); append+retry |
| owner isolation | RLS on both tables (FR-PL-017) — service passes no owner filters; the database enforces |
| PREPPED not creatable | absent from `PlannedMealDraft`; enum value reserved in DB |
