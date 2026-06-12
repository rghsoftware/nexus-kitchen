# Tasks: Substitute Ingredient Picker UI (005)

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md -->
<!-- No new dependencies. No prohibited technologies. -->

**Feature**: Substitute ingredient picker in `IngredientEditor.svelte` + display on detail page.
**Branch**: `worktree-feat+sub-picker-ui`
**Parent**: `main`

---

## User Stories

| ID | Story | Priority |
|----|-------|----------|
| US1 | As a recipe author, I can mark an ingredient as a substitute for another ingredient in the editor | P1 |
| US2 | As a cook, I can see substitute options listed on the recipe detail page | P2 |
| US3 | Tests — picker disable logic, display rendering, and reindexing regression guard | P3 |

---

## Phase 1: US1 — Substitute picker in IngredientEditor

### T001 [US1] Add substitute `<select>` to each ingredient row — `src/lib/components/recipes/IngredientEditor.svelte`

**Implementation details:**

Inside the `.controls` div, after the `<label class="optional">` checkbox, add:

```svelte
<label class="substitute">
  <span class="lbl">Sub:</span>
  <select
    aria-label="Substitute for ingredient {i + 1}"
    disabled={ingredients.length < 2}
    value={ingredient.substituteForIndex != null ? String(ingredient.substituteForIndex) : ''}
    onchange={(e) => {
      const v = (e.currentTarget as HTMLSelectElement).value;
      ingredient.substituteForIndex = v === '' ? null : Number(v);
    }}
  >
    <option value="">None</option>
    {#each ingredients as sibling, j (sibling.uid ?? j)}
      {#if j !== i}
        <option value={String(j)}>{sibling.name || `Ingredient ${j + 1}`}</option>
      {/if}
    {/each}
  </select>
</label>
```

Style the `.substitute` label to match `.optional` (same `.controls` row):
- `display: inline-flex; align-items: center; gap: var(--space-2)`
- `font-size: var(--text-sm); color: var(--text-secondary)`
- The `<select>` uses: `background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-sm); min-height: var(--tap-min); padding: 0 var(--space-3); font-size: var(--text-sm); font-family: var(--font-sans); color: var(--text)`
- Focus: `outline: 3px solid var(--focus-ring); outline-offset: 1px; border-color: var(--primary)`

Also: remove the `// TODO(001-substitutes)` comment from `removeIngredient` — the UI is now implemented.

**Acceptance**: Picker renders per row; disabled with 1 ingredient; enabled with 2+; selecting a sibling sets `substituteForIndex`; selecting "None" clears to `null`.

---

## Phase 2: US2 — Substitute display on detail page

### T002 [P] [US2] Add substitute reverse-lookup and "or: [name]" annotation — `src/routes/recipes/[id]/+page.svelte`

**Implementation details:**

1. Add a `$derived` that builds a `Map<string, string[]>` from `scaledIngredients`:

```ts
const substitutesByPrimaryId = $derived((() => {
  const map = new Map<string, string[]>();
  for (const ing of scaledIngredients) {
    if (ing.substituteFor) {
      const existing = map.get(ing.substituteFor) ?? [];
      map.set(ing.substituteFor, [...existing, ing.name]);
    }
  }
  return map;
})());
```

2. In the `{#each scaledIngredients as ing}` loop, within the `<span class="iname">` or as a sibling span, add:

```svelte
{#if (substitutesByPrimaryId.get(ing.id) ?? []).length > 0}
  <span class="sub-hint">or: {substitutesByPrimaryId.get(ing.id)!.join(', ')}</span>
{/if}
```

3. Style `.sub-hint`:
```css
.sub-hint {
  display: block;
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--space-1);
}
```

**Acceptance**: Primary ingredient rows with substitutes pointing at them show "or: [name]". Rows with no substitutes show nothing.

---

## Phase 3: US3 — Tests

### T003 [US3] Create IngredientEditor test file with picker behaviour and regression cases — `src/lib/components/recipes/IngredientEditor.svelte.spec.ts`

**This is a new file** — no existing test file for `IngredientEditor.svelte`.

Test cases (vitest browser project, `vitest-browser-svelte`):

1. **Picker disabled with one ingredient** — render with 1 ingredient; assert select is disabled.
2. **Picker enabled with two ingredients** — render with 2 ingredients; assert select is not disabled.
3. **Options list siblings, excludes self** — render with 3 named ingredients; for ingredient[0]'s select, assert options contain ingredient[1] and ingredient[2] names but NOT ingredient[0]'s name.
4. **Selecting a sibling sets substituteForIndex** — interact with select for ingredient[1]; select ingredient[0]'s option; assert `ingredients[1].substituteForIndex === 0`.
5. **Selecting "None" clears substituteForIndex** — start with `substituteForIndex = 0`; interact; select "None"; assert `substituteForIndex === null`.
6. **removeIngredient for target nulls dependent reference** — render with A (index 0) and B (substituteForIndex = 0); remove A; assert B.substituteForIndex is null (regression guard for existing `removeIngredient` logic).
7. **removeIngredient for non-target decrements index** — render with A (0), B (1), C (substituteForIndex = 1); remove A (index 0); assert C.substituteForIndex === 0 (decremented).

Use `render` from `vitest-browser-svelte`, pass `ingredients` as a `$bindable` prop ref, and use `userEvent` or direct interaction for selects.

Every test must include at least one `expect.*` assertion (P12).

---

## Completion Tracker

- [X] T001 [US1] Add substitute `<select>` picker to each ingredient row — `src/lib/components/recipes/IngredientEditor.svelte`
- [X] T002 [P] [US2] Add substitute reverse-lookup map and "or: [name]" annotation — `src/routes/recipes/[id]/+page.svelte`
- [X] T003 [US3] Create IngredientEditor test file — `src/lib/components/recipes/IngredientEditor.svelte.spec.ts`

---

## Dependencies

```
T001 ──► T003
T002        (independent of T001 and T003)
```

T001 and T002 can be executed in parallel. T003 requires T001 to exist.

---

## Parallel Execution

Stream A: T001 → T003  
Stream B: T002  

Both streams can run concurrently.

---

## Definition of Done

All three tasks complete when:
- `bun run check` — no new type errors
- `bun run lint` — no new lint errors
- `bun run test:unit` — all new tests pass, no existing tests broken
- `// TODO(001-substitutes)` removed from `IngredientEditor.svelte`
- Manual smoke: add 2+ ingredients in the editor; assign a substitute; save; reopen; verify picker pre-selects; open detail page; verify "or:" annotation appears
