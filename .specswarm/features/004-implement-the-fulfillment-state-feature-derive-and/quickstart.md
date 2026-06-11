# Quickstart: Fulfillment State

## Verify locally

```bash
supabase start                 # local stack (ports 563xx)
supabase migration up          # applies 0006_prepped_name_snapshot.sql
supabase gen types typescript --local > src/lib/database.types.ts
bun run check && bun run lint
bun run test:unit -- --run
bun run dev
```

## Manual walkthrough

1. **Pantry setup**: add pantry items "Rice" and "Black beans" (any quantity > 0).
2. **Recipe**: create a recipe "Beans & rice" with required ingredients Rice + Black
   beans, and one missing ingredient marked optional (e.g., "Cilantro", optional).
3. **Plan — CAN_MAKE_IT**: place "Beans & rice" on tomorrow → card shows **"Can make it"**.
4. **Plan — MUST_ACQUIRE (recipe)**: add a required ingredient the pantry lacks (e.g.,
   "Chicken thighs") to the recipe → meal shows **"To get"**; detail sheet lists
   *Missing: chicken thighs*.
5. **Plan — MUST_ACQUIRE (store-bought)**: add "Frozen lasagna" via the Store-bought tab
   → always **"To get"**.
6. **Plan — HAVE_IT**: create a prepped portion in Pantry → Prepped ("Chili", 3 portions);
   in the plan, Add meal → **Prepped** tab → pick "Chili" → card shows **"Have it"**.
7. **Exhaustion**: consume all Chili portions in the pantry screen → plan card flips to
   **"To get"**.
8. **QUICK**: add "Takeout" → no fulfillment chip at all.

## Key invariant to eyeball

`git diff supabase/` must show **no fulfillment/state column** — only
`prepped_name_snapshot` and the rewritten one-source CHECK (INV-PL-017).
