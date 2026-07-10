# Quickstart: Today dashboard & meal logging

## Migrate + types

```bash
bunx supabase start -x edge-runtime   # local stack (563xx ports)
bunx supabase migration up            # applies 0009_meal_logs.sql
bun run db:types                      # regen src/lib/database.types.ts (CI checks drift)
```

## Automated tests

```bash
bun run check
bun run lint
bun run test:unit -- --run
bunx supabase test db                 # pgTAP incl. meal_logs_rls.test.sql
bunx playwright test tests/today.e2e.ts
```

## Manual end-to-end loop (human)

1. `bun run dev`, open the app — root should land on **/today** with greeting + date;
   "Today" nav item active.
2. Seed context: create a recipe; add a prepped meal (2 portions); plan today's lunch
   from the prepped meal and dinner from the recipe.
3. Today shows coverage chips (lunch have-it, dinner per pantry) and two meal cards.
4. Tap **Log it** on lunch → instant "Eaten · time", prepped portions show 1 left in
   pantry, verdict prompt appears inline. Tap **Again** → Keeper mark.
5. Planner (/plan) shows lunch as logged.
6. **Log a meal** → sheet: slot defaults sensibly; tap **I ate something** → logged,
   sheet closes with calm confirmation.
7. Reopen sheet: "Recent" shows the logged items; the kept meal appears under Keepers
   with a times-made count.
8. Next day (or adjust clock): recap card asks about unrated dinner; verdict from the
   recap card sticks.
9. Nudge banner: within a slot window with an unlogged planned meal, banner appears;
   **Not now** hides it for the day (survives reload — localStorage).
10. Responsive pass: mobile (bottom sheet, FAB), desktop (4-col meal grid) per mockups;
    keyboard: sheet closes on Escape, focus returns to the opener; verdict buttons are
    44 px and announce pressed state.
