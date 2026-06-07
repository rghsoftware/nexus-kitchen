---
parent_branch: worktree-feat+recipes
feature_number: 001
status: Implemented
created_at: 2026-06-07T00:00:00-00:00
references_consulted:
  - nexus-kitchen-requirements.md
  - nexus-kitchen-invariants.md
  - nexus-kitchen-logical-architecture.md
  - nexus-kitchen-domain-specification.md
  - nexus-kitchen-design-system.md
---

# Feature: Recipe Management

## Overview

Recipe Management is the foundational feature of Nexus Kitchen: a personal library
where a user can create, browse, search, view, edit, and delete recipes. Each recipe
captures the information needed to cook a dish — title, description, servings, prep/cook/active
times, tags, an ordered ingredient list, ordered preparation steps, notes, and photos — and
each user can mark recipes as favorites and rate them.

This is the project's **first** feature, so it also establishes the database foundation the
rest of the app inherits: the first Supabase migration, the first set of Row-Level Security
policies, and the first generated TypeScript types. Subsequent features (meal planning, pantry,
shopping, cooking mode, AI import) read from the recipe data this feature creates.

To keep this first slice coherent and shippable, it is scoped to **manual recipe authoring and
library management**. AI-assisted import (URL/photo), nutrition auto-computation, an
interactive cooking/kitchen mode with timers, and cross-feature integrations (meal plan,
shopping list, pantry deduction) are explicitly out of scope and tracked as separate features.

## User Scenarios

### Primary: Create a recipe (manual entry)

A user opens the Recipes tab, taps **+ Add**, enters a title, servings, optional times and
description, adds one or more ingredients (each with quantity, unit, and name), adds one or
more ordered preparation steps, optionally tags the recipe and attaches photos, and saves.
The new recipe appears in their library.

### Browse and search the library

A user opens the Recipes tab and sees their recipe library as a grid of cards (image, title,
time, favorite indicator). They can search by title/ingredient text and filter by quick
chips (All, Favorites, Quick <30 min, and tag categories such as meal type/dietary/cuisine).

### View recipe detail

Tapping a card opens the recipe detail: header (image, title, rating, total time, servings,
tags) and tabbed content — **Ingredients** (with a client-side serving-scale control) and
**Instructions** (ordered steps). The user can favorite/unfavorite and rate (1–5) from here.

### Edit and delete

From a recipe they own, a user can edit any field (including adding/removing/reordering
ingredients and steps) or delete the recipe entirely (with confirmation).

### Edge cases

- Saving a recipe with zero ingredients or zero steps is rejected with a clear message (INV-RC-001, INV-RC-002).
- Non-positive servings or ingredient quantities are rejected (INV-RC-003, INV-RC-005).
- A rating outside 1–5 is rejected (INV-RC-009).
- Active time greater than total time is rejected (INV-RC-008).
- A user cannot view, edit, or delete a recipe they do not own (RLS; INV-SEC-\*).
- Reordering steps/ingredients keeps sort orders unique within the recipe (INV-RC-006, INV-RC-007).
- Empty library shows an inviting empty state prompting the first recipe.
- Search/filter that matches nothing shows a "no results" state.

## Functional Requirements

Derived from `nexus-kitchen-requirements.md §3.2 Recipe Management`.

### Recipe storage & authoring

- **FR-001**: Users can create recipes with title, description, servings, prep time, cook time,
  active (hands-on) time, ingredients, steps, notes, tags, and photos. (REQ-RC-001, REQ-RC-014)
- **FR-002**: Each recipe has at least one ingredient and at least one step; the system rejects
  saves that violate this. (INV-RC-001, INV-RC-002)
- **FR-003**: Ingredients are ordered and capture name (display), quantity, unit, optional
  preparation note (e.g. "diced"), optional-flag, and optional substitute reference within the
  same recipe. (domain-spec §2.2 RecipeIngredient; INV-RC-005, INV-RC-007, INV-RC-011)
- **FR-004**: Steps are ordered and capture an instruction, optional duration, optional timer
  minutes + label, and optional image. (domain-spec §2.2 RecipeStep; INV-RC-006)
- **FR-005**: Users can categorize recipes with tags across categories DIETARY, CUISINE,
  MEAL_TYPE, COOKING_METHOD, CUSTOM. (REQ-RC-002; domain-spec §2.2 RecipeTag)
- **FR-006**: Users can edit any field of a recipe they own, including adding, removing, and
  reordering ingredients and steps.
- **FR-007**: Users can delete a recipe they own (with confirmation); deleting a recipe removes
  its child ingredient and step rows. (INV-DB-008 — no orphaned children)

### Per-user metadata

- **FR-008**: Users can mark/unmark a recipe as a favorite. (REQ-RC-004)
- **FR-009**: Users can rate a recipe 1–5; rating is per-user. (REQ-RC-003; INV-RC-009, INV-RC-012)
- **FR-010**: `timesCooked` and `lastCookedAt` are tracked per user for future "times cooked"
  display. They are not incremented by any flow in this feature (no cooking mode yet) but the
  storage exists. (domain-spec §2.2; logical-arch event `RecipeCooked`)

### Library, search & filtering

- **FR-011**: Users see their recipes as a card grid (image, title, total time, favorite,
  rating). (domain-spec §4.5 Recipe Library)
- **FR-012**: Users can search recipes by title and ingredient text. (REQ-RC search; REQ-PR-003)
- **FR-013**: Users can filter the library by: All, Favorites, Quick (<30 min total), and tag
  values (meal type, dietary, cuisine). (domain-spec §4.5 filter bar)
- **FR-014**: Recipe search against locally cached data returns results responsively
  (target <500 ms). (REQ-PR-003)

### Detail & scaling

- **FR-015**: The recipe detail view presents header info and tabbed Ingredients / Instructions.
  (domain-spec §4.5 Recipe Detail)
- **FR-016**: On the detail view, users can scale displayed ingredient quantities to a different
  serving count; scaling is a display-only, client-side calculation and does not mutate the
  stored recipe. (REQ-RC-010)

### Data foundation, security & caching

- **FR-017**: All recipe data is owned by the creating user and protected by Row-Level Security
  so users can only read/write their own recipes. RLS is enabled default-deny before the tables
  are exposed. (CLAUDE.md data rules; invariants §security)
- **FR-018**: Recipe identifiers are UUIDs; timestamps are stored as `timestamptz` in UTC.
  (CLAUDE.md data rules)
- **FR-019**: Recently viewed recipes and the recipe library are cached locally for responsive
  navigation; the server remains authoritative (online-first, optimistic UI). (REQ-CN-002;
  ADR-0002; logical-arch read cache)
- **FR-020**: Users can upload one primary photo per recipe to Supabase Storage; the recipe
  stores a single `image_url` (plus an optional `source_url`). Multi-image gallery deferred.
  ([Q3]; domain-spec §2.2 imageUrls)

## Success Criteria

- **SC-001**: A user can create a complete recipe (title, ≥1 ingredient, ≥1 step) and see it in
  their library in under 2 minutes.
- **SC-002**: Recipe search returns matching results in under 500 ms against cached data for a
  library of up to 10,000 recipes. (REQ-PR-003, REQ-PR-005, INV-PERF-005)
- **SC-003**: 100% of recipe domain invariants (INV-RC-001..012) are enforced — invalid recipes
  cannot be saved.
- **SC-004**: A user can never read or modify another user's recipe (verified by RLS tests).
- **SC-005**: Editing a recipe's ingredients/steps (add, remove, reorder) persists correctly and
  preserves unique sort ordering.
- **SC-006**: Serving-scale on the detail view updates displayed quantities without altering the
  stored recipe.

## Key Entities

Tables built in this feature (subset of the canonical recipe set per `logical-arch line 120`
and `invariants §1.2`): `recipes`, `recipe_steps`, `recipe_ingredients`, `recipe_tags`,
`user_recipe_meta`. The `ingredients` master table is **out of scope for v1** ([Q2]).

- **Recipe** — owner-scoped; core info (title, description, servings), times (prep/cook/active;
  total computed), classification (cuisine, meal types, tags), notes, a single `image_url`,
  `source_url`, optional nutrition (stored, not computed in this feature), timestamps.
  (domain-spec §2.2)
- **RecipeIngredient** — child of Recipe; name (free-text), quantity, unit, preparation, optional
  flag, substitute reference, sort order; nullable `ingredient_id` reserved for future master
  linkage (no FK enforced in v1). ([Q2])
- **RecipeStep** — child of Recipe; instruction, optional duration/timer/label/image, sort order.
- **RecipeTag** — name + category (DIETARY | CUISINE | MEAL_TYPE | COOKING_METHOD | CUSTOM).
- **UserRecipeMeta** — per-user (userId + recipeId unique) favorite, rating (1–5), timesCooked,
  lastCookedAt. Separates per-user state from the shared recipe record. (invariants INV-RC-009,
  INV-RC-012)

## Assumptions

- **Manual entry only.** AI-assisted import from URLs (REQ-RC-006) and photos (REQ-RC-007),
  along with auto-computed nutrition (REQ-RC-009, REQ-NT-002), require an Edge Function + AI
  provider and are deferred to a later feature. This feature implements manual entry
  (REQ-RC-008). ([Q1])
- **Personal recipes only.** Recipes are owner-scoped. The schema keeps a nullable
  `household_id` for forward compatibility with household sharing (REQ-HH-007), but no sharing
  UI or household feature exists yet.
- **Session via anonymous sign-in.** No auth/login feature exists yet (this is feature 001).
  A session bootstrap calls `supabase.auth.signInAnonymously()` when no session exists, giving a
  real `auth.uid()` so RLS works end-to-end and recipes are usable/testable now. No login UI is
  built; a future auth feature upgrades the anonymous user to a real account. ([Q4], resolved
  2026-06-07)
- **No cross-feature integration yet.** "Start Cooking", "Add to Plan", and "Shop" actions
  shown in the domain-spec detail mockup are out of scope; they belong to the cooking, planning,
  and shopping features respectively. Recipe detail may show these as disabled/absent.
- **Nutrition is storable but not computed.** `nutritionPerServing` can be persisted (MANUAL
  source) but the app does not auto-calculate it in this feature.
- **English-only, metric/imperial unit values stored as entered.** No unit conversion engine in
  this slice (REQ-RC beyond scaling deferred).
- **Standard SPA + Supabase conventions** apply: Svelte 5 runes, `ssr=false`, design tokens
  first, client-side data access via supabase-js, server-authoritative with local read cache.

## Resolved Clarifications

> Resolved during `/ss:clarify` (2026-06-07).

- **[Q1] Import scope → Manual entry only.** v1 ships manual recipe authoring (REQ-RC-008).
  AI-assisted URL/photo import (REQ-RC-006/007) and auto-nutrition are deferred to a later
  feature requiring an Edge Function + AI provider.
- **[Q2] Ingredients → Free-text with nullable link.** Recipe ingredients are free-text
  (name/quantity/unit) with a nullable `ingredient_id` column reserved for future linkage. The
  master `ingredients` catalog and nutrition DB are **not** built in this feature; `recipe_ingredients`
  is the only ingredient storage. The `ingredients` master table is **out of scope** for v1.
- **[Q3] Photos → Single primary image upload.** Implement Supabase Storage upload for one
  primary recipe image per recipe, establishing the Storage bucket + RLS pattern. The
  multi-image gallery (up to 10) is deferred; `recipes` stores a single `image_url` (plus
  optional `source_url`) in v1.

## Sources

This spec was generated by consulting the following references (per `.specswarm/references.md`):

| Source                                  | Sections informing this spec                                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nexus-kitchen-requirements.md`         | §3.2 Recipe Management (REQ-RC-001..014), §3.5 Nutrition (REQ-NT-002), §3.8.1 Adaptive Recipe Instructions (scope exclusion), Performance (REQ-PR-003/005), Connectivity (REQ-CN-002)   |
| `nexus-kitchen-domain-specification.md` | §2.2 Recipe Context (Recipe, RecipeIngredient, RecipeStep, RecipeTag, Ingredient, Nutrition entities), §3.2 Recipe Invariants, §4.5 Recipe Management Flow (library/detail/add mockups) |
| `nexus-kitchen-invariants.md`           | §1.2 Recipe Invariants (INV-RC-001..012), §DB invariants (INV-DB-008 no orphaned children), §performance (INV-PERF-005)                                                                 |
| `nexus-kitchen-logical-architecture.md` | Module table (line 120 canonical recipe table set + `recipes/` module), read-cache, online-first data flow                                                                              |
| `nexus-kitchen-design-system.md`        | UI primitives / design-token usage (informs plan, not requirements)                                                                                                                     |

No requirement was fabricated without a corresponding source citation OR an Open Clarification marker.
