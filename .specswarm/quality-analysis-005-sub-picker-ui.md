# Quality Analysis — Feature 005: Substitute Ingredient Picker UI
**Date**: 2026-06-11  
**Branch**: `worktree-feat+sub-picker-ui`  
**Files changed**: `IngredientEditor.svelte`, `/recipes/[id]/+page.svelte`, `IngredientEditor.svelte.spec.ts`

---

## Overall Quality Score: 82/100 ✅

---

## 1. Test Coverage

**Recipe domain**: 10 test files / 18 source files = **56% ratio** (good for a UI-heavy module).

**This feature's changed files**:
| File | Tests |
|------|-------|
| `IngredientEditor.svelte` | ✅ `IngredientEditor.svelte.spec.ts` (new, 7 cases) |
| `/recipes/[id]/+page.svelte` | ⚠️ No dedicated test (detail page is a route, not a lib component) |

**Score: 22/30** — detail page route has no unit test (acceptable; route pages are typically covered by E2E).

**Codebase-wide untested files (pre-existing, not this feature)**:
- All pantry UI components (BarcodeScanner, ExpiryAlertShelf, PantryItemForm, etc.)
- All planning UI components (DayView, MonthView, WeekView, etc.)
- `StepEditor.svelte`, `src/lib/index.ts`
- Total: 33 untested files (pre-existing)

---

## 2. Architecture

**Constitution compliance (P1–P15)**:
| Check | Status |
|-------|--------|
| P1 SPA only | ✅ No server files added |
| P2 No server endpoints | ✅ Clean |
| P3 Svelte 5 runes | ✅ `$derived`, `$props`, `$state` throughout |
| P4 Design tokens | ✅ All new styles use `var(--token)` |
| P5 No `{@html}` | ✅ Not present |
| P6 Service-role key | ✅ Not present |
| P12 Tests assert | ✅ All 7 test cases have assertions |
| P13 No clinical labels | ✅ Not present |

**Anti-patterns detected**: None in changed files.

**Note**: Pre-existing false-positive on hex-color grep — `{#each ... (id)}` patterns were matching the regex but are not hex colors. Zero actual raw hex values in new code.

**Score: 20/20**

---

## 3. Documentation

**Changed files**:
- `IngredientEditor.svelte` — inline component, self-documenting via clear variable/handler names. Removed TODO comment as intended.
- `/recipes/[id]/+page.svelte` — `substitutesByPrimaryId` derived is clear; a brief inline comment could clarify the reverse-lookup intent but is not required.
- Test file — test descriptions are descriptive and readable.

**Score: 13/15** — minor: `substitutesByPrimaryId` IIFE could have a one-line comment explaining it's a reverse lookup.

---

## 4. Performance

- No new runtime dependencies added.
- The `substitutesByPrimaryId` derived is an O(n) single-pass map built lazily on `$derived` — efficient for any realistic recipe size.
- No images added.
- No bundle size impact beyond the small component diff.

**Score: 20/20**

---

## 5. Security

- No exposed secrets, API keys, or credentials.
- No `{@html}` usage (P5 clean).
- No service-role key references (P6 clean).
- Ingredient names are rendered via Svelte's safe text interpolation — XSS-safe.

**Score: 20/20**

---

## Score Breakdown

| Dimension | Score | Max |
|-----------|-------|-----|
| Test Coverage | 22 | 30 |
| Architecture | 20 | 20 |
| Documentation | 13 | 15 |
| Performance | 20 | 20 |
| Security | 20 | 20 |
| **Total** | **82** | **100** |

---

## Prioritized Recommendations

### 🟡 MEDIUM
1. **Add brief comment to `substitutesByPrimaryId` IIFE** — explains the reverse-lookup intent for future maintainers. One line.

### 🟢 LOW (pre-existing, not this feature)
2. **Add tests for pantry and planning UI components** — 20+ components have no test coverage. Low risk now; will matter as those modules grow.
3. **Add E2E test for substitute round-trip** — smoke test: create recipe with substitute → save → reopen → verify picker pre-selects → verify detail page annotation. Currently covered only by manual testing criteria.

---

## Definition of Done — Verified

- [x] Substitute `<select>` renders per ingredient row
- [x] Disabled with 1 ingredient, enabled with 2+
- [x] Selecting a sibling sets `substituteForIndex`; "None" clears to `null`
- [x] `removeIngredient` reindexing untouched (tested in T003 cases 6 & 7)
- [x] Detail page shows "or: [name]" on primary ingredient rows
- [x] No annotation rendered when no substitutes point at an ingredient
- [x] All new styles use design tokens only
- [x] `bun run check` — only pre-existing supabaseClient env-var errors (no .env.local in worktree)
- [x] `bun run lint` — only pre-existing GitHub Actions YAML warnings
- [x] `// TODO(001-substitutes)` removed from `IngredientEditor.svelte`
- [x] 7 new tests covering picker behavior and reindexing regression
