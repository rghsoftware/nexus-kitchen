# Research: Recipe Management (001-recipes)

Phase 0 research consolidating decisions for the recipes feature. All NEEDS CLARIFICATION
items from spec.md are resolved ([Q1]–[Q4]).

---

## Decision 1: Session source — anonymous sign-in bootstrap

- **Decision:** A client session bootstrap calls `supabase.auth.signInAnonymously()` when no
  session exists. RLS keys to `auth.uid()`; `recipes.owner_id` defaults to `auth.uid()`.
- **Rationale:** Recipes are owner-scoped, but feature 001 has no auth/login feature. Without a
  session, `auth.uid()` is NULL and every insert violates `owner_id NOT NULL` — the feature is
  inert and SC-001 / `/ss:validate` have nothing to run. Anonymous sign-in yields a real
  `auth.uid()` with zero login UI, so RLS is exercised end-to-end and the feature is fully usable
  now. A future auth feature upgrades the anonymous user to a permanent account.
- **Alternatives considered:**
  - _Inert feature (no session):_ rejected — violates SC-001 and makes validation impossible.
  - _Minimal email/magic-link login:_ rejected — expands scope into the auth feature we deferred.
- **Implication:** Anonymous sign-ins must be enabled in the Supabase project's Auth settings.
  Documented in quickstart.md as a prerequisite.

## Decision 2: Migration files, not applied migrations

- **Decision:** This feature authors `supabase/migrations/*.sql`; it does **not** apply them to
  any remote Supabase project. Applying is left to the user / `/ss:ship` / deploy.
- **Rationale:** Applying to a remote project is outward-facing and hard to reverse; doing so
  unprompted is inappropriate. The durable deliverable is the migration SQL.
- **Alternatives considered:** Applying via the Supabase MCP `apply_migration` — rejected (no
  authorization to mutate a live project; would also require credentials/linkage not in scope).

## Decision 3: TypeScript types — hand-authored stand-in for `supabase gen types`

- **Decision:** Hand-author `src/lib/database.types.ts` to match the migration exactly, written
  in the **same task** as the migration so the two cannot drift. Header-comment it as a
  hand-authored stand-in to be regenerated via `supabase gen types` once the DB exists.
- **Rationale:** `supabase gen types` needs a running/linked DB with the migration applied;
  neither exists deterministically here, and we won't apply to remote to get one. Hand-authoring
  keeps the build deterministic and type-safe now.
- **Alternatives considered:** Spin a local Supabase stack (Docker) to run gen types — rejected
  (slow, environment-fragile, and still needs the migration applied first).

## Decision 4: Per-user metadata split (`user_recipe_meta`)

- **Decision:** Favorite, rating, timesCooked, lastCookedAt live in a separate
  `user_recipe_meta` table keyed `(user_id, recipe_id)` unique, not inline on `recipes`.
- **Rationale:** This is the canonical model in `invariants §1.2` (INV-RC-009/012) and
  `logical-arch line 120`. CLAUDE.md designates invariants as canonical over the domain-spec's
  inline fields. The split also makes per-user state correct once recipes can be household-shared.
- **Alternatives considered:** Inline rating/isFavorite on `recipes` (domain-spec §2.2) —
  rejected as non-canonical and wrong for shared recipes.

## Decision 5: Ingredients are free-text with a reserved nullable link

- **Decision:** `recipe_ingredients.ingredient_id uuid NULL` is reserved for future linkage to a
  master `ingredients` catalog, but **no FK and no master table** are created in this feature.
  Ingredients are free-text (`name`, `quantity`, `unit`).
- **Rationale:** [Q2] — defers the master catalog + nutrition DB while keeping the schema
  forward-compatible. Avoids catalog seeding/management UI in the first slice.

## Decision 6: Single primary image via Supabase Storage

- **Decision:** `recipes.image_url text NULL` holds one uploaded image; a private Storage bucket
  `recipe-images` holds files under a `{auth.uid()}/...` path prefix with Storage RLS scoping
  access to the owner. Multi-image gallery deferred ([Q3]).
- **Rationale:** Establishes the Storage + RLS pattern with minimal surface area. Owner-prefixed
  paths are the standard Supabase pattern for per-user Storage isolation.
- **Alternatives considered:** Multi-image gallery (deferred), URL-only (rejected — manual
  recipes need uploadable photos).

## Decision 7: Data-access layer = typed repository over supabase-js + PostgREST

- **Decision:** A `src/lib/recipes/` module exposes typed repository functions (list, search,
  get, create, update, delete, setFavorite, setRating) built on `supabase-js` PostgREST queries.
  No REST/GraphQL server is written (SPA + PostgREST; constitution P1/P2 forbid server endpoints).
- **Rationale:** Matches the architecture (client-side data access via supabase-js; Edge
  Functions only for privileged/secret work, none needed here). Centralizing queries keeps RLS
  assumptions and caching in one place.

## Decision 8: State & caching — Svelte 5 runes with a disposable read cache

- **Decision:** A runes-based store (`*.svelte.ts`) holds the library list + a per-recipe cache,
  applies optimistic updates for favorite/rating/edits, and reconciles against server responses
  (rollback on rejection). Server is authoritative; cache is disposable (P15, ADR-0002).
- **Rationale:** Constitution P3 (runes) + P15 (online-first). Search target <500 ms (SC-002) is
  met by filtering the cached library client-side after the initial fetch.

## Decision 9: Serving scale is display-only

- **Decision:** A pure function scales displayed ingredient quantities by
  `targetServings / recipe.servings`; it never mutates stored data (FR-016, SC-006). Lives in a
  unit-testable module.

## Decision 10: Validation mirrors invariants at three layers

- **Decision:** Recipe invariants (INV-RC-001..012) are enforced in (a) DB constraints/checks
  where expressible, (b) a shared client validation module used by the form, and (c) tests.
- **Rationale:** SC-003 requires 100% invariant enforcement. DB checks are the backstop; client
  validation gives immediate, shame-free feedback (design system voice).

---

## Open Decisions deferred (not blocking)

- Master ingredient catalog + nutrition computation — future feature.
- AI URL/photo import — future feature (Edge Function + capability router per logical-arch).
- Cooking/kitchen mode, timers, step granularity — future feature (REQ-CA-\*).
- Cross-feature actions (Add to Plan, Shop, Start Cooking) — owned by planning/shopping/cooking.
- Household sharing UI — future (schema keeps nullable `household_id`).
