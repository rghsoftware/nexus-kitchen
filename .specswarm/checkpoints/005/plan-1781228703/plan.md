---
feature: "005"
title: "Substitute Ingredient Picker UI"
parent_branch: main
status: In Progress
created_at: 2026-06-11
---

# Implementation Plan: Substitute Ingredient Picker UI

## Technical Context

**Scope**: Pure UI change — no new Supabase migration, no new TypeScript types, no new
dependencies. All plumbing (`recipe_ingredients.substitute_for` FK, `RecipeIngredientInput
.substituteForIndex`, `RecipeIngredient.substituteFor`, two-pass insert, edit-load seed,
`removeIngredient` reindexing, `validateRecipeInput` INV-RC-011) is already in place.

**Files touched**:
- `src/lib/components/recipes/IngredientEditor.svelte` — add substitute `<select>` picker
- `src/routes/recipes/[id]/+page.svelte` — add substitute annotation on the detail page
- `src/lib/components/recipes/IngredientEditor.svelte.spec.ts` — new test file (browser project)

**Key type facts**:
- `RecipeIngredientInput.substituteForIndex?: number | null` — write path (editor)
- `ScaledIngredient extends RecipeIngredient` → carries `substituteFor: string | null` and `id` — read path (detail page)
- HTML `<select>` always returns a string; conversion to `number | null` is done in the `onchange` handler

## Tech Stack Compliance Report

### ✅ Approved Technologies

- SvelteKit / Svelte 5 runes — core framework
- TypeScript — language
- Vitest (browser project) — component tests
- Tailwind CSS v4 + design tokens — styling

### No new dependencies required

This feature adds no new libraries. All capabilities come from the existing stack.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| P1 SPA only | ✅ | No server files added |
| P2 No server endpoints | ✅ | No `+server.ts` or `+page.server.ts` |
| P3 Svelte 5 runes | ✅ | `$props`, `$derived` used throughout |
| P4 Design tokens | ✅ | All new styles use `var(--token)` / `.nk-*` |
| P5 No `{@html}` | ✅ | Not applicable |
| P12 Tests must assert | ✅ | All new tests use `expect.*` |

## Phase 1: Implementation

### T1 — IngredientEditor: substitute `<select>` picker

**File**: `src/lib/components/recipes/IngredientEditor.svelte`

**Change**: Add a `<select>` control inside the `.controls` div of each ingredient row, after
the existing `<label class="optional">` checkbox.

**Behaviour**:
- Options: first option is value `""` / label "No substitute"; remaining options are the names of
  all sibling ingredients (all indexes ≠ i), with `value={j}` (the sibling's array index as a
  string).
- `disabled` when `ingredients.length < 2`.
- `onchange` handler converts the selected string back to `number | null`:
  - `""` → `ingredient.substituteForIndex = null`
  - `"0"`, `"1"`, etc. → `ingredient.substituteForIndex = Number(value)`
- Current value derived: if `ingredient.substituteForIndex != null`, selected option is
  `String(ingredient.substituteForIndex)`; otherwise `""`.
- ARIA: `aria-label="Substitute for ingredient {i + 1}"`.
- Remove the `// TODO(001-substitutes)` comment from `removeIngredient`.

**Style**: Same `.controls` row as `isOptional`. Label text "Sub:" in `.lbl` style
(`font-size: var(--text-xs); color: var(--text-muted)`). The `<select>` uses the same border,
radius, min-height, font-size, and background tokens as the text inputs above.

---

### T2 — Detail page: substitute display

**File**: `src/routes/recipes/[id]/+page.svelte`

**Change**: Within the Ingredients tab panel, add inline annotations on primary ingredient rows.

**Implementation**:
1. Add a `$derived` that builds a reverse-lookup map from `scaledIngredients`:
   ```
   substitutesByPrimaryId: Map<string, string[]>
   ```
   Key = primary ingredient's `id`; values = names of all ingredients whose `substituteFor`
   equals that `id`.

2. In the `{#each scaledIngredients as ing}` loop, after the existing name/prep/optional spans,
   conditionally render:
   ```
   {#if (substitutesByPrimaryId.get(ing.id) ?? []).length > 0}
     <span class="sub-hint">or: {substitutesByPrimaryId.get(ing.id)!.join(', ')}</span>
   {/if}
   ```

3. Style `.sub-hint`:
   - `font-size: var(--text-xs)`
   - `color: var(--text-muted)`
   - Displayed on a new line below the ingredient name (block or flex-column).

---

### T3 — Tests: IngredientEditor picker

**File**: `src/lib/components/recipes/IngredientEditor.svelte.spec.ts` (new — browser project)

**Cases**:
1. Picker is `disabled` when there is exactly one ingredient.
2. Picker is enabled when there are two or more ingredients.
3. Picker options list all siblings (by name) and excludes self.
4. Selecting a sibling value sets `substituteForIndex` to that sibling's index.
5. Selecting the empty option resets `substituteForIndex` to `null`.
6. After a `move` (reorder), the selected value tracks the moved ingredient — the index is
   updated by the existing `resequence` + binding (regression: verify no stale index).
7. `removeIngredient` for the target of a substitute reference nulls the dependent's
   `substituteForIndex` (regression guard for existing reindexing logic).

---

## Sequence

```
T1 (IngredientEditor picker)
  ↓
T2 (detail page display)   ← can overlap with T1, no dependency
  ↓
T3 (tests)                 ← after T1 and T2 exist
```

T1 and T2 are independent. T3 depends on T1 (component must exist to test).

## Definition of Done

- [ ] Substitute `<select>` renders in every ingredient row in the editor.
- [ ] Picker is `disabled` with one ingredient, enabled with two+.
- [ ] Selecting a sibling sets `substituteForIndex`; selecting "No substitute" clears it.
- [ ] `removeIngredient` for a substitute target nulls dependent references (no regression).
- [ ] Recipe detail page shows "or: [name]" annotation on primary ingredient rows.
- [ ] Ingredients with no substitutes pointing at them show no annotation.
- [ ] All new styles use design tokens only (no raw hex / raw values).
- [ ] `bun run check` passes with no new type errors.
- [ ] All new tests pass; every test makes at least one assertion (P12).
- [ ] `// TODO(001-substitutes)` comment removed from `IngredientEditor.svelte`.
