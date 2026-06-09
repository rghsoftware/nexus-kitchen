# Implementation Plan: Recipe Management (001-recipes)

**Branch:** `001-recipes` · **Parent:** `worktree-feat+recipes` · **Spec:** [spec.md](./spec.md)
**Inputs:** [research.md](./research.md) · [data-model.md](./data-model.md) ·
[contracts/recipes-repository.md](./contracts/recipes-repository.md)

---

## Summary

Build the project's first feature: manual recipe authoring + a searchable recipe library, on the
project's first Supabase schema (recipes + children + per-user meta), with RLS default-deny, a
single-image Storage path, an anonymous-sign-in session bootstrap, a typed data-access
repository, runes-based state with a disposable read cache, and the Svelte 5 UI (library, detail
with serving-scale, create/edit form). Deliverable includes migration SQL (not applied) and a
hand-authored types stand-in.

## Technical Context

| Aspect       | Choice                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Language     | TypeScript (strict), Svelte 5 (runes forced)                                                    |
| Framework    | SvelteKit SPA, `adapter-static`, `ssr=false`/`prerender=false`                                  |
| Data access  | `@supabase/supabase-js` PostgREST (client-side); optional Postgres RPC for atomic create/update |
| Backend      | Supabase Postgres + RLS + Storage; **migration files only, not applied**                        |
| Auth/session | `supabase.auth.signInAnonymously()` bootstrap → real `auth.uid()`                               |
| Styling      | Design tokens (`src/lib/styles/`) + `.nk-*` classes; Tailwind v4 available                      |
| State        | Svelte 5 runes store (`*.svelte.ts`), optimistic UI, server-authoritative cache                 |
| Types        | Hand-authored `src/lib/database.types.ts` (stand-in for `supabase gen types`)                   |
| Testing      | Vitest (client=chromium for `*.svelte.{test,spec}.ts`, server=node), Playwright e2e             |

**No NEEDS CLARIFICATION remain** — [Q1]–[Q4] resolved in spec.md / research.md.

## Tech Stack Compliance Report

_All technologies are already approved in `.specswarm/tech-stack.md`._

### ✅ Approved (already in stack)

- SvelteKit / Svelte 5 runes, TypeScript, Vite, `@supabase/supabase-js`, Supabase Storage,
  Supabase Postgres + RLS, Tailwind v4 + project tokens, Vitest, Playwright, prettier/eslint.

### ➕ New technologies (auto-added)

- **None.** No new dependencies introduced.

### ⚠️ Conflicts

- **None.**

### ❌ Prohibited used

- **None.** Plan honors all prohibitions: no SSR/server load files, no service-role key in
  client, no `{@html}`, no serial PKs, no offline sync, runes-only.

> Bits UI / Phosphor Icons are _planned_ (tech-stack "Open Decisions") but **not yet
> dependencies**. To avoid adding deps in this feature, v1 uses native elements + accessible
> markup and the existing `.nk-*` classes; icons are text-labeled (design system §6). Adding Bits
> UI / Phosphor is deferred to avoid scope creep — noted for a future UI-polish pass.

## Constitution Check (gates)

| Principle                         | Status   | How the plan satisfies it                                                                                          |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| P1 SPA only (ssr=false)           | ✅       | New routes under `src/routes/recipes/`; root `+layout.ts` unchanged. No load servers.                              |
| P2 No server endpoints            | ✅       | No `+server.ts`/`+*.server.ts`. Privilege-free; all via supabase-js/PostgREST.                                     |
| P3 Svelte 5 runes                 | ✅       | `$state/$derived/$effect/$props` only; no `export let`/`$:`.                                                       |
| P4 Design tokens first            | ✅       | Components use `var(--token)`/`.nk-*`; no raw hex.                                                                 |
| P5 No `{@html}`                   | ✅       | All recipe text rendered via Svelte escaping.                                                                      |
| P6 Service-role server-only       | ✅       | Only anon/publishable key in client; no service-role reference.                                                    |
| P7 RLS default-deny               | ✅       | **Every** table (incl. 3 children + storage) enables RLS + policies in the same migration. ⚠️ block-hook enforced. |
| P8 UUID PKs                       | ✅       | All PKs `uuid`/`gen_random_uuid()`; no serial.                                                                     |
| P9 timestamptz UTC                | ✅       | All timestamps `timestamptz`.                                                                                      |
| P10 Injection-safe                | ✅       | PostgREST/parameterized; any RPC uses params, no string SQL.                                                       |
| P11 AI untrusted                  | ✅ (n/a) | No AI in this feature.                                                                                             |
| P12 Tests assert; server isolated | ✅       | Every test asserts; server-only helpers under `src/lib/server/**` if any.                                          |
| P13 No clinical labels            | ✅       | Shame-free copy; no "ADHD"/clinical terms; empty states say "Add".                                                 |
| P14 Append-only records           | ✅ (n/a) | No MealLog/PortionEvent here.                                                                                      |
| P15 Online-first                  | ✅       | Cache disposable; optimistic updates reconcile + rollback.                                                         |

**Gate result: PASS.** No violations, no justifications needed.

## Project Structure (planned additions)

```
supabase/
  migrations/
    <ts>_recipes.sql            # tables + checks + indexes + RLS + triggers + (optional) RPC + storage bucket/policies
src/lib/
  database.types.ts             # hand-authored stand-in for `supabase gen types`
  session/
    session.svelte.ts           # anonymous sign-in bootstrap + current-user accessor
  recipes/
    types.ts                    # domain types (Recipe, RecipeWithDetail, RecipeInput, …)
    recipeValidation.ts         # INV-RC-001/002/003/005/008/009/011 client validation
    recipeScaling.ts            # pure serving-scale (FR-016)
    recipesRepository.ts        # typed PostgREST data access (contract)
    recipesStore.svelte.ts      # runes store: library list + per-recipe cache, optimistic ops
src/routes/recipes/
  +page.svelte                  # library: grid, search, filter chips, empty/no-results states
  new/+page.svelte              # create form
  [id]/+page.svelte             # detail: header + Ingredients(scale)/Instructions tabs, favorite, rating
  [id]/edit/+page.svelte        # edit form (reuses form component)
src/lib/components/recipes/
  RecipeCard.svelte             # library card (image/tile fallback, title, time, favorite, rating)
  RecipeForm.svelte             # shared create/edit form
  IngredientEditor.svelte       # add/remove/reorder ingredients
  StepEditor.svelte             # add/remove/reorder steps
  RecipeFilters.svelte          # All / Favorites / Quick / tag chips
  RatingControl.svelte          # 1–5 rating (.nk-rating vocabulary)
  ServingScaler.svelte          # serving-count control (display-only)
tests: co-located *.svelte.{test,spec}.ts (client) + *.spec.ts (server/unit)
```

## Implementation Phases (high level — detailed in tasks.md)

1. **Data foundation (must precede everything):**
   migration SQL (all 5 tables + RLS + checks + indexes + triggers + storage bucket/policies +
   optional create/update RPC) → hand-authored `database.types.ts` (same task, no drift).
2. **Session + repository + pure logic:** anon sign-in bootstrap; `recipesRepository`;
   `recipeValidation`; `recipeScaling`. (Repository depends on types.)
3. **State:** `recipesStore.svelte.ts` (depends on repository + types).
4. **UI components:** cards, form + editors, filters, rating, scaler (depend on store/types/validation).
5. **Routes:** library, new, detail, edit (depend on components + store).
6. **Tests:** unit (scaling, validation), component (card, form, rating, filters), and an
   RLS/policy verification (SQL-level or documented), plus a happy-path e2e if a session is
   reachable.

> **Dependency chain is hard:** migration → types → repository/store → components → routes.
> tasks.md must order these as prerequisite streams; UI tasks must NOT run parallel to the
> migration/types task.

## Risks & Mitigations

- **RLS child-table omission** → data exposure. Mitigation: explicit policies for all 3 children
  - `supabase-rls-reviewer` review of the migration.
- **Types drift** from migration. Mitigation: author types in the same task; document
  `supabase gen types` regeneration.
- **Anonymous auth disabled** in the Supabase project → session bootstrap fails. Mitigation:
  documented prerequisite in quickstart; graceful, shame-free error if sign-in fails.
- **Cross-table atomicity** for create/update. Mitigation: prefer Postgres RPC; fallback
  compensating deletes; tests cover partial-failure rollback.
