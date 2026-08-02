# Quickstart: Meal Prep — Batch Sessions

## What this feature adds
Batch meal-prep **sessions**: pick recipes + servings, schedule a prep day, build a shopping list
for the gap, and on completion **yield** prepped portions into inventory — which then read HAVE_IT
on the planning calendar. Direct-entry prepped meals (already shipped) are left as-is; this closes
the make-ahead side with the batch path.

## Try it (after implementation)
1. `bun install && bun run dev`
2. Sign in, go to **Pantry → Prepped**. The previously-disabled **"Start a prep session"** button
   is now active — click it.
3. Add **two recipes** with servings (e.g. Chili ×6, Oats ×5). Keep the suggested prep day (next
   weekend) or change it.
4. Click **Build shopping list** → a `FROM_PREP` list appears under Shopping, containing only items
   not already in your pantry, each noting which recipe needs it.
5. Click **Mark prepped** → choose fridge/freezer per item → **11 portions** appear under
   Pantry → Prepped with sensible eat-by dates.
6. Go to **Plan**, add a meal for any day, pick the prepped Chili portion → the day shows
   **HAVE_IT**. Log it → the portion count drops.

## Verify
```bash
bun run check          # typecheck
bun run lint           # prettier + eslint
bun run test:unit --run   # services + pure logic + components (node/chromium split)
# RLS (server-side; per worktree-env memory, prefer pgTAP over the browser project in sandboxes):
supabase test db       # pgTAP — meal_prep_sessions / _recipes owner-only + anon-zero-rows
```

## Migrations
- `0009_meal_prep_sessions.sql` — `meal_prep_sessions` + `meal_prep_session_recipes` (+ enum, RLS, grants).
- `0010_shopping_from_prep.sql` — adds `FROM_PREP` to `shopping_list_source`; `shopping_lists.meal_prep_session_id` + CHECK.
After applying, regenerate types from this worktree:
```bash
supabase gen types typescript --local > src/lib/database.types.ts
```

## Scope reminders
- **Yield-to-inventory only.** Completing a session does NOT auto-build/extend the meal plan
  (REQ-PP-005..009 deferred). Place portions onto days via the existing planning flow.
- **No pantry deduction** on completion in v1 (presence-by-name inventory model).
