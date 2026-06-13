# Quickstart: Shopping

## Apply the migration & regenerate types

```bash
# from this worktree (memory: gen-types workflow)
supabase start            # or against the linked project
supabase db reset         # applies 0001..0007 locally
supabase gen types typescript --local > src/lib/database.types.ts
```

Migration `0007_shopping.sql` follows the repo's sequential `000N_name` convention
(memory: unique numeric prefixes or `supabase start` collides).

## Try the loop end-to-end

1. `bun run dev`, sign in, plan a few meals for this week (`/plan`) — at least one
   RECIPE meal missing pantry ingredients and one STORE_BOUGHT meal.
2. Open **Shopping** (now live in the nav) → "Generate from meal plan" → keep the
   default 7-day range → Generate.
3. The list shows missing ingredients grouped by category with "For: …" attribution,
   plus the store-bought meal.
4. Check items off — they slide into the collapsed **Checked** section.
5. Tap **Complete shopping — add to pantry**, review the items (storage location,
   quantities, store-bought expiration), confirm.
6. Verify: pantry has the new/merged items; the store-bought planned meal now shows
   **Have it** (it points at a new prepped portion); the recipe meal shows
   **Can make it**.

## Tests

```bash
bun run check
bun run lint
bun run test:unit -- --run --project=server   # pure logic: generation, categorize, replenishment, service mapping
```

(Browser-project component tests hang in agent sandboxes — memory; verify components
manually via the dev server.)
