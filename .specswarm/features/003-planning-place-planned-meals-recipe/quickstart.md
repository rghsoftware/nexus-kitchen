# Quickstart: Planning feature

```bash
# 1. Apply schema + regen types
supabase db reset            # or: supabase migration up
bun run db:types

# 2. Dev server
bun run dev                  # → http://localhost:5173/plan

# 3. Checks
bun run check && bun run lint
bun run test:unit -- --run   # weekMath + planningService specs
bun run test:e2e             # tests/plan.e2e.ts
```

Manual smoke (SC-001/002): open /plan → week view → tap a slot band → add a recipe meal,
a store-bought "Frozen lasagna", and a quick "Takeout" → drag one to another day
(desktop) and tap-move it back (mobile emulation) → reload and confirm everything is
where you left it.
