---
parent_branch: main
feature_number: "005"
status: In Progress
created_at: 2026-06-11T20:30:00-05:00
references_consulted:
  - docs/nexus-kitchen-requirements.md
  - docs/nexus-kitchen-invariants.md
  - docs/nexus-kitchen-logical-architecture.md
---

# Feature: Substitute Ingredient Picker UI

## Overview

The substitute-ingredient data model is fully wired end-to-end (DB column
`recipe_ingredients.substitute_for`, validation, repository two-pass insert, domain mapper).
What is missing is the **user-facing surface** to set a substitute relationship while editing a
recipe, and the display of those relationships on the recipe detail page.

This feature adds (a) a substitute picker control inside `IngredientEditor.svelte` so users can
declare "Ingredient B is a substitute for Ingredient A", and (b) a visual indicator on
`/recipes/[id]` that surfaces substitute pairs so a cook can act on them.

## User Scenarios

### Scenario 1 — Author assigns a substitute while creating or editing a recipe

1. User opens New Recipe or Edit Recipe.
2. User adds at least two ingredients.
3. For a given ingredient row, user opens the substitute picker and selects another ingredient
   from the list of siblings (self excluded).
4. The selected ingredient's name appears as the confirmed substitute.
5. User saves the recipe; the substitute relationship is persisted via the existing repository.

### Scenario 2 — Author removes a substitute assignment

1. User edits a recipe where an ingredient already has a substitute.
2. User clears the substitute picker back to "None".
3. The `substituteForIndex` returns to `null`; save persists the cleared relationship.

### Scenario 3 — Substitute control disabled with only one ingredient

1. User is editing a recipe that has exactly one ingredient.
2. The substitute picker is absent or visibly disabled — no self-substitution is possible.
3. The picker becomes enabled once a second ingredient is added.

### Scenario 4 — Ingredient removal correctly reindexes substitutes

1. User edits a recipe where ingredient B is marked as a substitute for ingredient A (index 0).
2. User removes ingredient A.
3. Ingredient B's `substituteForIndex` is cleared to `null` (already handled by `removeIngredient`;
   the UI must not regress this behaviour).

### Scenario 5 — Cook views substitute relationships on the detail page

1. User opens the detail view of a recipe that has substitute relationships.
2. In the Ingredients tab, each ingredient that has a substitute shows a "Substitute: [Name]"
   annotation below or alongside it.
3. Ingredients with no substitute show nothing extra.
4. The annotation is legible at the serving-scaled quantity.

### Scenario 6 — Edit load round-trips correctly (regression guard)

1. User opens an existing recipe that has persisted substitute relationships.
2. `RecipeForm.svelte` seeds `substituteForIndex` correctly from the UUID in `substituteFor`
   (already implemented in PR #1 — must not regress).
3. The picker pre-selects the correct sibling ingredient.

## Functional Requirements

### FR-1: Substitute picker control in IngredientEditor

- Each ingredient row in `IngredientEditor.svelte` MUST include a control that lets the user
  select a substitute ingredient.
- The control MUST be a `<select>` element whose options are populated with the **names** of all
  sibling ingredients excluding the current ingredient.
- The control MUST include a "None" / empty option that clears `substituteForIndex` to `null`.
- The control MUST be `disabled` when `ingredients.length < 2`.
- Selecting a sibling MUST set `ingredient.substituteForIndex` to that sibling's current array
  index.
- The control's value MUST stay consistent after a reorder (move up/down) or removal — the
  existing `removeIngredient` reindexing logic is authoritative; the picker simply reflects it.
- The control MUST carry an accessible label scoped to the ingredient row (e.g.
  `aria-label="Substitute for ingredient {i + 1}"`).

### FR-2: Substitute display on the recipe detail page

- On `/recipes/[id]`, within the Ingredients tab, each ingredient whose `substituteFor` is
  non-null MUST display the name of its substitute in a secondary annotation.
- The annotation MUST be visually subordinate to the primary ingredient name (smaller text, muted
  colour).
- The annotation text SHOULD follow the pattern "sub: [name]" or "Substitute: [name]" (exact
  wording TBD in implementation; must be consistent).
- When an ingredient has no substitute, the annotation MUST NOT be rendered (no empty placeholder).
- The substitute lookup MUST work against the `scaledIngredients` array already used by the page
  (resolve by `id` matching `substituteFor`).

### FR-3: Design token compliance

- All new styles MUST use existing design tokens (`var(--token)` / `.nk-*`) before introducing
  raw values — per the project's Conventions & Gotchas.
- The picker MUST match the visual style of the existing `isOptional` checkbox control (same
  `.controls` row, same `font-size: var(--text-sm)` / `color: var(--text-secondary)` treatment).

### FR-4: No regression on existing behaviour

- `removeIngredient` reindexing of `substituteForIndex` MUST remain intact.
- `RecipeForm.svelte` seed of `substituteForIndex` from `substituteFor` UUID MUST remain intact.
- `validateRecipeInput` INV-RC-011 enforcement MUST remain intact.

## Success Criteria

1. A user with two or more ingredients can assign a substitute within the recipe editor without
   leaving the ingredient row.
2. A user with one ingredient cannot activate the substitute picker (control is disabled or absent).
3. Removing an ingredient that is the target of a substitute reference correctly clears that
   reference for all dependents — no dangling index.
4. A cook viewing the recipe detail page can identify substitute options without navigating to the
   edit view.
5. Saving and re-opening a recipe that has substitute relationships round-trips without data loss.
6. All new interactive elements are keyboard-accessible and carry appropriate ARIA labels.

## Key Entities

- `RecipeIngredientInput.substituteForIndex: number | null` — client-side index (write path)
- `RecipeIngredient.substituteFor: string | null` — UUID FK (read/display path)
- `IngredientEditor.svelte` — editor component receiving a `$bindable` `ingredients` array
- `/recipes/[id]/+page.svelte` — detail page displaying `scaledIngredients`

## Assumptions

- The substitute picker is a `<select>`, not a full dialog/sheet. The issue mentions either
  approach; a select is simpler, consistent with the existing optional-checkbox pattern, and
  sufficient for ADHD-friendly UX at this stage.
- The detail-page annotation is inline text within the existing `<li>` element, not a separate
  expandable section.
- No new Supabase migration is required — `recipe_ingredients.substitute_for` already exists.
- No new TypeScript types are required — `RecipeIngredientInput.substituteForIndex` and
  `RecipeIngredient.substituteFor` already exist.
- Test coverage: new unit tests cover (a) the picker's disable logic, (b) the detail page's
  annotation rendering, and (c) the existing reindexing behaviour (regression test). The
  vitest browser project covers `.svelte` components.
