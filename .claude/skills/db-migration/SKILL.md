---
name: db-migration
description: >-
  Scaffold a new Supabase schema migration for Nexus Kitchen the right way —
  timestamped CLI migration, RLS enabled default-deny, owner-scoped policies,
  then regenerate client types. Use when adding or changing a table, view, or
  policy.
disable-model-invocation: true
---

# Create a Supabase migration

The Supabase project is **linked** (`supabase/` exists; ref in
`supabase/.temp/linked-project.json`). Schema changes go through CLI migrations —
never hand-edit the remote schema or the generated types file.

The CLI is not installed globally; run it with `bunx supabase ...`.

## Steps

1. **Create the migration file**

   ```bash
   bunx supabase migration new <short_snake_case_name>
   ```

   This writes `supabase/migrations/<timestamp>_<name>.sql`. Open it and write
   the DDL there.

2. **Follow the data rules** (CLAUDE.md):
   - UUID primary keys (`id uuid primary key default gen_random_uuid()`).
   - Timestamps are `timestamptz`, stored UTC (`created_at timestamptz not null
     default now()`).
   - Name tables/columns in `snake_case`.

3. **Enable RLS default-deny BEFORE the table can be reached.** Every new table:

   ```sql
   alter table public.<table> enable row level security;
   ```

   With RLS on and no policy, the table is deny-all. Add only the policies you
   intend, scoped to the owner — e.g.:

   ```sql
   create policy "<table>_select_own" on public.<table>
     for select using (auth.uid() = user_id);
   create policy "<table>_modify_own" on public.<table>
     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```

   Never ship `using (true)` / `with check (true)` unless the table is
   deliberately public. Check the change against `docs/nexus-kitchen-invariants.md`.

4. **Apply the migration**
   - Local stack: `bunx supabase db reset` (replays all migrations) or
     `bunx supabase migration up`.
   - Remote: `bunx supabase db push` (pushes pending migrations to the linked
     project). Confirm with the user before pushing to remote.

5. **Regenerate client types** so `supabase-js` stays in sync:

   ```bash
   bunx supabase gen types typescript --linked > src/lib/database.types.ts
   ```

   (Use `--local` instead of `--linked` when generating against the local stack.)

6. **Verify**: `bun run check` for type errors, then consider running the
   `supabase-rls-reviewer` agent on the new migration before committing.

## Don't

- Don't edit the generated types file by hand — regenerate it.
- Don't expose a table without RLS enabled and policies reviewed.
- Don't put service-role logic in the client; privileged work goes in an Edge
  Function.
