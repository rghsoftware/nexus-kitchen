# Quickstart: Recipe Management (001-recipes)

## Prerequisites

- **Supabase project** with env vars set (already wired in `src/lib/supabaseClient.ts`):
  `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Anonymous sign-ins ENABLED** in Supabase Auth settings (Authentication → Providers →
  Anonymous). The session bootstrap relies on this; without it, recipes cannot be created.
- **Apply the migration** before using against a live DB (this feature only authors it):
  ```bash
  supabase db push           # or apply supabase/migrations/<ts>_recipes.sql
  supabase gen types typescript --linked > src/lib/database.types.ts   # regenerate types
  ```
  Until applied, `src/lib/database.types.ts` is the hand-authored stand-in committed by this feature.

## Run

```bash
bun install
bun run dev        # open the app, navigate to /recipes
```

## Verify the feature

1. **Create:** /recipes → "Add" → enter title, servings, ≥1 ingredient, ≥1 step → Save.
   The recipe appears in the library grid. (FR-001/002, SC-001)
2. **Browse/search/filter:** type in search; toggle All / Favorites / Quick (<30 min) / tag
   chips. (FR-011/012/013)
3. **Detail + scale:** open a recipe → Ingredients tab → change serving count → quantities
   rescale without persisting. (FR-015/016, SC-006)
4. **Favorite + rate:** toggle favorite, set a 1–5 rating; reload — state persists. (FR-008/009)
5. **Edit/delete:** edit ingredients/steps (add, remove, reorder) and save; delete a recipe with
   confirmation. (FR-006/007)

## Validate quality

```bash
bun run check      # svelte-check typecheck
bun run lint       # prettier --check + eslint
bun run test:unit  # vitest (scaling, validation, components)
```

## Invariant spot-checks (SC-003 / SC-004)

- Saving with 0 ingredients or 0 steps is rejected with a friendly message.
- Servings ≤ 0, quantity ≤ 0, rating outside 1–5, active>total are rejected.
- A second browser session (different anon user) cannot read/edit the first user's recipes (RLS).
