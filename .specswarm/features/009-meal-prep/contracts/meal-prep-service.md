# Contracts: Meal Prep Service

SPA data access is client-side `supabase-js` against PostgREST (no REST endpoints of our own). The
"contracts" are therefore the client service signatures and the PostgREST operations they perform,
plus their invariants. All operations run under the caller's RLS context (owner-scoped).

## `mealPrepService.ts`

```ts
// CREATE — session + its recipes (>=1). INV-PL-006 enforced here (reject empty).
createSession(draft: NewMealPrepSession): Promise<MealPrepSession>
//   inserts meal_prep_sessions (status PLANNED) + meal_prep_session_recipes rows.
//   throws if draft.recipes.length < 1 or any servingsToPrep <= 0 (INV-PL-007).

// READ
getSessions(householdId?: string | null): Promise<MealPrepSession[]>   // PLANNED first, then by prep_day
getSession(id: string): Promise<MealPrepSession | null>

// UPDATE (PLANNED only)
addRecipe(sessionId: string, r: { recipeId; recipeName; servingsToPrep }): Promise<MealPrepSession>
removeRecipe(sessionId: string, sessionRecipeId: string): Promise<MealPrepSession>
//   rejects removal of the last recipe (would violate INV-PL-006).
updateServings(sessionRecipeId: string, servingsToPrep: number): Promise<void>  // > 0
setPrepDay(sessionId: string, prepDay: string): Promise<void>                   // not in past

// COMPLETE — yield to inventory (idempotent). FR-PP-014/015/016.
completeSession(sessionId: string, yields: YieldChoice[]): Promise<MealPrepSession>
//   guard: SELECT prepped_meals WHERE meal_prep_session_id = sessionId.
//          if rows exist -> return session unchanged (already yielded).
//   for each session recipe: addPreppedMeal({
//      origin: 'PREP_SESSION', recipe_id, recipe_name, meal_prep_session_id: sessionId,
//      name: recipeName, original_portions: servingsToPrep, portions_remaining: servingsToPrep,
//      storage_location, prepared_date: today, expiration_date: today + shelfLife(storage),
//      defrost_state: storage === 'FREEZER' ? 'FROZEN' : 'NOT_APPLICABLE' })
//   then UPDATE meal_prep_sessions SET status='COMPLETED', completed_at=now().
//   NOTE: addPreppedMeal is being FIXED in this feature to NOT fire a positive INITIALIZED event
//   (Design A) — the row insert is authoritative for the starting count (INV-INV-011/INV-CC-006).

// CANCEL — PLANNED -> CANCELLED, no portions. FR-PP-017.
cancelSession(sessionId: string): Promise<MealPrepSession>

// PREP -> SHOPPING. FR-PP-020..023.
generatePrepShoppingList(sessionId: string): Promise<{ shoppingListId: string; itemCount: number }>
//   loads each recipe's ingredients, scales by servingsToPrep/recipe.servings,
//   computes gap vs pantry index, then writes shopping_lists(source_type='FROM_PREP',
//   meal_prep_session_id=sessionId) + shopping_list_items (each item notes forRecipes).
//   available while session is PLANNED (does not require completion).
```

### Errors
- `MealPrepServiceError(message, cause?)` — wraps supabase errors, mirrors `PreppedMealServiceError`.
- Yield reuses `PreppedMealServiceError` / `PortionLedgerError` from the prepped stack unchanged.

## `prepShoppingList.ts` (pure — no I/O, node-testable)

```ts
interface RecipeForPrep {
	recipeId: string;
	recipeName: string;
	baseServings: number;                 // recipes.servings (>0)
	servingsToPrep: number;               // >0
	ingredients: { name: string; unit: string; quantity: number; isOptional: boolean }[];
}

// required = quantity * (servingsToPrep / baseServings); aggregate by (normName, unit);
// drop items whose normName is in pantryIndex; optional ingredients excluded from the gap.
computePrepShoppingGap(
	recipes: RecipeForPrep[],
	pantryIndex: Set<string>              // normalized names with quantity > 0
): PrepShoppingGapItem[]

// normName = name.trim().toLowerCase().replace(/\s+/g, ' ')   (matches fulfillment.ts)
```

## `mealPrepStore.svelte.ts` (runes)
Exposes: `sessions()`, `sessionsLoading()`, `sessionsError()`, `loadSessions()`,
`optimisticCreateSession()`, `optimisticCompleteSession()`, `optimisticCancelSession()`,
`optimisticAddRecipe()`, `optimisticRemoveRecipe()`. Optimistic-update-then-resync, mirroring
`preppedMealStore.svelte.ts`. After `completeSession`, also triggers `loadPreppedMeals()` so the
Prepped tab reflects the new yield.

## Invariant checklist (verified by tests)
- INV-PL-006: cannot create/leave a session with 0 recipes.
- INV-PL-007: `servings_to_prep > 0` (DB CHECK + service guard).
- INV-PL-008: `completed_at` set ⟺ `status='COMPLETED'` (DB CHECK).
- INV-INV-006: yielded portions have valid `recipe_id` + `recipe_name`.
- INV-INV-007/009: FREEZER yields are FROZEN; `expiration_date > prepared_date`.
- INV-CC-006/P14: portions written only via `portion_events` (no blind column write).
- INV-XD-004: `FROM_PREP` shopping list always references a valid session (DB CHECK).
- FR-PP-014: re-completion yields no duplicate portions (idempotency guard).
- P7: pgTAP asserts owner-only access + anon sees zero rows on both new tables.
