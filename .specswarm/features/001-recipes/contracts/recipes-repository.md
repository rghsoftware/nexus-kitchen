# Contract: Recipes Data-Access Repository

> This is an SPA — there is **no** REST/GraphQL server endpoint (constitution P1/P2 forbid
> SvelteKit server code). The "contract" is the typed client repository in
> `src/lib/recipes/recipesRepository.ts`, built on `supabase-js` PostgREST queries. Each
> operation runs under the caller's RLS context (`auth.uid()` from anonymous sign-in).

All functions are async, return typed results, and surface errors (never swallow). Optimistic
UI + cache reconciliation live in the store layer, not here.

---

## Types (domain shapes; DB row types come from `database.types.ts`)

```ts
type Recipe = {
	id: string;
	ownerId: string;
	householdId: string | null;
	title: string;
	description: string | null;
	servings: number;
	prepTimeMinutes: number | null;
	cookTimeMinutes: number | null;
	activeTimeMinutes: number | null;
	totalTimeMinutes: number; // generated
	cuisineType: string | null;
	mealTypes: string[];
	notes: string | null;
	imageUrl: string | null;
	sourceUrl: string | null;
	nutritionPerServing: NutritionInfo | null;
	nutritionSource: 'COMPUTED' | 'MANUAL' | 'EXTERNAL';
	createdAt: string;
	updatedAt: string;
};

type RecipeIngredient = {
	id: string;
	recipeId: string;
	ingredientId: string | null;
	name: string;
	quantity: number;
	unit: string;
	preparation: string | null;
	isOptional: boolean;
	substituteFor: string | null;
	sortOrder: number;
};

type RecipeStep = {
	id: string;
	recipeId: string;
	instruction: string;
	durationMinutes: number | null;
	timerMinutes: number | null;
	timerLabel: string | null;
	imageUrl: string | null;
	sortOrder: number;
};

type RecipeTag = { id: string; recipeId: string; name: string; category: TagCategory };
type TagCategory = 'DIETARY' | 'CUISINE' | 'MEAL_TYPE' | 'COOKING_METHOD' | 'CUSTOM';

type UserRecipeMeta = {
	id: string;
	userId: string;
	recipeId: string;
	isFavorite: boolean;
	rating: number | null;
	timesCooked: number;
	lastCookedAt: string | null;
};

type RecipeWithDetail = Recipe & {
	ingredients: RecipeIngredient[];
	steps: RecipeStep[];
	tags: RecipeTag[];
	meta: UserRecipeMeta | null;
};

// Input shapes (no server-managed fields)
type RecipeInput = Omit<
	Recipe,
	'id' | 'ownerId' | 'totalTimeMinutes' | 'createdAt' | 'updatedAt'
> & {
	ingredients: Array<Omit<RecipeIngredient, 'id' | 'recipeId'>>;
	steps: Array<Omit<RecipeStep, 'id' | 'recipeId'>>;
	tags: Array<Omit<RecipeTag, 'id' | 'recipeId'>>;
};
```

---

## Operations

| Function            | Signature                                                     | Behavior                                                                                                                          | RLS / Invariants                                    |
| ------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `listRecipes`       | `() => Promise<Recipe[]>`                                     | Owner's recipes for the library grid; ordered `created_at DESC`. Joins `user_recipe_meta` for favorite/rating badges.             | recipes_select; only owner rows                     |
| `getRecipe`         | `(id: string) => Promise<RecipeWithDetail>`                   | Full detail: recipe + ingredients + steps (ordered by `sort_order`) + tags + caller's meta.                                       | recipes_select + child policies                     |
| `createRecipe`      | `(input: RecipeInput) => Promise<RecipeWithDetail>`           | Validates (≥1 ingredient, ≥1 step, substitute_for refs within set), then inserts recipe + children. `owner_id` set by DB default. | recipes_insert; INV-RC-001/002/011 (app), DB checks |
| `updateRecipe`      | `(id, input: RecipeInput) => Promise<RecipeWithDetail>`       | Updates recipe; diffs/replaces children (add/remove/reorder) preserving unique sort orders.                                       | recipes_update; INV-RC-006/007                      |
| `deleteRecipe`      | `(id: string) => Promise<void>`                               | Deletes recipe; children cascade.                                                                                                 | recipes_delete; INV-DB-008                          |
| `setFavorite`       | `(recipeId, isFavorite) => Promise<UserRecipeMeta>`           | Upserts `user_recipe_meta` on `(user_id, recipe_id)`.                                                                             | urm_all; INV-RC-012                                 |
| `setRating`         | `(recipeId, rating: 1..5 \| null) => Promise<UserRecipeMeta>` | Upserts rating.                                                                                                                   | urm_all; INV-RC-009                                 |
| `uploadRecipeImage` | `(recipeId, file: File) => Promise<string>`                   | Uploads to `recipe-images/{uid}/{recipeId}/...`; returns public/signed URL; caller sets `recipes.image_url`.                      | Storage RLS owner-prefix                            |

### Atomicity note

`createRecipe`/`updateRecipe` touch multiple tables. PostgREST has no client transaction across
tables. Options (chosen at implement time, documented in the module):

1. **Postgres RPC** (`create_recipe_with_children(jsonb)`) — single SECURITY INVOKER function for
   true atomicity. **Preferred** for create/update.
2. Sequential inserts with compensating delete on failure (fallback).

The RPC approach keeps invariant enforcement (≥1 ingredient/step) server-side too and is
recommended; if used, add it to the migration as a `SECURITY INVOKER` function (RLS still applies).

---

## Error contract

- All functions throw/return a typed error on failure (RLS denial, constraint violation,
  network). No silent fallback to empty/partial results (silent-failure-hunter applies).
- Constraint violations (e.g. rating out of range, duplicate sort order) map to user-friendly,
  shame-free messages in the UI layer — never raw Postgres errors.
