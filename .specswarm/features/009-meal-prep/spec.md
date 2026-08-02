---
parent_branch: worktree-feat+meal-prep
feature_number: 006
status: In Progress
created_at: 2026-06-13T15:10:00-05:00
references_consulted:
  - nexus-kitchen-requirements.md
  - nexus-kitchen-invariants.md
  - nexus-kitchen-logical-architecture.md
  - nexus-kitchen-differentiator.md
  - nexus-kitchen-domain-specification.md
---

# Feature: Meal Prep — Batch Sessions & Make-Ahead Integrations

## Overview

This feature closes the **make-ahead side** of the product's core loop (per the Differentiator:
"move every requirement to *have it* before it's due"). Prepped portions are the canonical
**HAVE_IT** source — a planned meal sourced from a prepped portion with portions remaining > 0
already reads HAVE_IT today (feature 004, INV-PL-017). What's missing is a way to *produce*
those portions in bulk and to feed the operations around them.

The make-ahead capability is delivered in two slices, matching the user's framing:

1. **Direct entry (small — already built, verified here).** Adding a ready-to-eat portion
   directly to inventory (origin `DIRECT_ENTRY` / `STORE_BOUGHT`) is production-ready from
   feature 001 (`PreppedMealForm`, portion ledger, `/pantry?tab=PREPPED`). This slice is a
   **verification pass** that confirms direct-entry portions reach inventory and correctly
   produce HAVE_IT end-to-end — no rebuild, regression coverage only, plus closing any small
   gap in the PREPPED calendar picker.

2. **Batch meal-prep sessions (bigger — the real build).** A session lets the user pick one or
   more recipes with servings to prepare, schedule a prep day, and on completion **yield**
   those servings into inventory as `PREP_SESSION`-origin prepped portions. This is the missing
   subsystem (`meal_prep_sessions` does not exist; the "Start a prep session" button is disabled
   with "coming soon"). It carries two integrations:
   - **Prep → Shopping (REQ-PP-019..022):** aggregate the ingredients a session needs across all
     its recipes, subtract what's on hand, and generate a shopping list for the gap.
   - **Planning (REQ-PP-023..026):** prepped inventory is surfaced as a non-forcing suggestion
     when planning, and prepped portions are placeable on the calendar (the HAVE_IT path).

**Distribution is explicitly out of scope (clarified):** a completed session yields portions to
inventory only. It does **not** auto-generate or extend the meal plan, compute a planning
horizon, or replan (REQ-PP-005..009). Users place prepped portions onto days through the
existing planning flow, which already supports the PREPPED source.

## Clarifications

### Session 2026-06-13

- Q: Direct entry is already built and already feeds HAVE_IT. What should feature 006 deliver?
  → A: **Batch sessions + integrations.** Treat direct-entry as done (verify, don't rebuild).
  Build the batch meal-prep session subsystem, plus the prep→shopping-list integration
  (REQ-PP-019..022) and the planning suggestion/picker integration (REQ-PP-023..026).
- Q: How far should the first cut of batch sessions go on distributing prepped portions into the
  meal plan (REQ-PP-005..009)?
  → A: **Yield to inventory only.** A completed session creates the prepped portions and drops
  them into inventory. Auto-distribution, planning-horizon calculation, replan, and automatic
  day assignment are deferred; users place portions via the existing planning flow.
- Q: Empirical testing found `addPreppedMeal()` (the only prepped-portion creation path) throws
  against a real DB — it fires a positive `INITIALIZED` portion event that the client guard,
  the DB CHECK, and INV-INV-011 all forbid; the unit test only passes because it mocks the
  ledger. Direct-entry is therefore **not** actually working, and batch-yield would inherit the
  bug. How to handle?
  → A: **Fix it (Design A).** Remove the redundant positive `INITIALIZED` event — the
  `prepped_meals` row insert already sets `portions_remaining = original_portions` directly, and
  the ledger records only consume/adjust deltas (consistent with INV-INV-011 + INV-CC-006).
  Add non-mocked coverage so it can't regress silently. Batch-yield then reuses the **fixed**
  `addPreppedMeal()`. This makes the "direct-entry first (small)" slice a real, foundational fix.
- Q: How are ingredient requirements scaled for prep→shopping when servings-to-prepare differs
  from the recipe's yield? *(Auto-resolved from schema, not asked.)*
  → A: **Scale by base yield.** Required quantity = `recipe_ingredient.quantity ×
  (servingsToPrep / recipe.servings)`. Source: `0001_recipes.sql` — `recipes.servings` is
  `integer NOT NULL CHECK (servings BETWEEN 1 AND 100)` and `recipe_ingredients.quantity` is
  `numeric NOT NULL CHECK (quantity > 0)` with a `unit`. No base-yield ambiguity remains.

## Scope

**Included:**

- **Verification slice (direct entry → HAVE_IT):** regression coverage proving a `DIRECT_ENTRY`
  / `STORE_BOUGHT` portion with portions remaining > 0 produces HAVE_IT for a PREPPED planned
  meal, and that the prepped portion is placeable on the calendar. Fix any gap found; no rebuild.
- **Batch meal-prep sessions:**
  - Create a session by selecting **one or more recipes** (INV-PL-006) with a **positive
    servings-to-prepare** per recipe (REQ-PP-001/002, INV-PL-007).
  - A **suggested prep day** defaulting to the next common prep day (weekend), user-overridable
    (REQ-PP-003/004).
  - Session lifecycle `PLANNED → COMPLETED` (with completion timestamp, INV-PL-008) and
    `PLANNED → CANCELLED` (discard before cooking).
  - On **completion**, **yield** servings into inventory: one `prepped_meals` row per recipe with
    `origin = PREP_SESSION`, `recipe_id` + denormalized `recipe_name` set (INV-INV-006),
    `meal_prep_session_id` set, `portions_remaining = original_portions = servingsToPrep`, a
    default shelf life applied by storage location (REQ-PP-012), and an `INITIALIZED` portion
    event (INV-CC-006). Storage location and prepared date are captured at completion.
- **Prep → Shopping integration (REQ-PP-019..022):**
  - Aggregate required ingredients across all selected recipes scaled by servings-to-prepare.
  - Compare against current pantry on-hand (presence-by-name, consistent with fulfillment v1)
    and drop satisfied items.
  - Generate a `FROM_PREP` shopping list for the remaining gap, referencing the session
    (INV-XD-004), with each item annotated by which recipe(s) require it (REQ-PP-022).
- **Planning integration (REQ-PP-023..026):**
  - Prepped portions are surfaced as a **non-forcing suggestion** with expiration indicators when
    planning (REQ-PP-025/026), and remain placeable on the calendar as the PREPPED source
    (REQ-PP-023; verifies/extends the feature-004 picker).
  - REQ-PP-027 (auto-decrement prepped inventory on meal logging) already exists; this feature
    confirms it still holds for `PREP_SESSION`-origin portions.

**Excluded (deferred):**

- **Auto-distribution & planning horizon (REQ-PP-005..009):** generating/extending a meal plan
  from a completed session, computing the default horizon `(new + existing servings) / meals per
  day`, manual horizon override, one-action replan, and manual day reassignment. Deferred per the
  "yield to inventory only" decision. The schema leaves room to add this later without rework.
- **Pantry quantity deduction on completion:** the logical architecture (§4.2) notes completion
  could deduct pantry quantities. v1 keeps the presence-by-name inventory model (matching
  fulfillment v1, which does no quantity math) and does **not** mutate pantry quantities on
  completion. Captured as a known follow-up.
- **Step-by-step / timed cooking execution during a session.** A session tracks intent and yield,
  not a guided cook-along.
- The full preference-driven *generation* prompt (REQ-PP-024) is meaningful only alongside
  auto-distribution and is deferred with it; the prepped-inventory **preview** (REQ-PP-025) is
  retained as a passive suggestion surface.

## User Scenarios

### Scenario 1 — Sunday batch cook (primary)
A user opens meal prep and starts a session. They add "Chili" (6 servings) and "Overnight oats"
(5 servings), keep the suggested prep day (next Sunday), and tap "Build shopping list." The app
shows the ingredients both recipes need, minus what's already in the pantry, as a single
`FROM_PREP` list — each line noting which recipe it's for. On Sunday after cooking, they open the
session and tap "Mark prepped," choosing fridge for the oats and freezer for half the chili. Eleven
prepped portions appear in `/pantry?tab=PREPPED`, each with a sensible eat-by date.

### Scenario 2 — Portions become HAVE_IT
Later that week the user plans Tuesday dinner and picks the prepped chili portion. The Tuesday meal
card immediately shows **HAVE_IT** (no shopping, no cooking needed). Logging the meal decrements the
chili portions remaining; when it hits zero, future planned meals referencing it read MUST_ACQUIRE.

### Scenario 3 — Verify direct entry still feeds HAVE_IT (regression)
A user adds a store-bought lasagna directly (2 portions, freezer) via the existing Prepped tab,
then places it on Thursday. Thursday reads HAVE_IT. (No new UI; this scenario guards the existing
path.)

### Scenario 4 — Cancel before cooking
A user creates a session, builds the shopping list, then changes plans and cancels the session. No
prepped portions are created; the session is marked CANCELLED and leaves inventory untouched.

## Functional Requirements

### A. Verification slice — direct entry → HAVE_IT
- **FR-PP-001:** The system MUST have regression coverage proving a prepped portion of origin
  `DIRECT_ENTRY` or `STORE_BOUGHT` with `portions_remaining > 0`, when referenced by a PREPPED
  planned meal, derives **HAVE_IT** (guards feature 004 / INV-PL-017).
- **FR-PP-002:** A prepped portion with portions remaining MUST be selectable as the source when
  placing a planned meal on the calendar (PREPPED source). If the feature-004 picker is missing or
  regressed in this branch, this feature closes that gap; otherwise it is covered by tests only.

### B. Batch meal-prep sessions
- **FR-PP-010:** Users MUST be able to create a meal-prep session containing **one or more**
  recipes (a session with zero recipes cannot be created — INV-PL-006).
- **FR-PP-011:** Each recipe in a session MUST carry a **positive integer servings-to-prepare**
  (INV-PL-007); non-positive values are rejected.
- **FR-PP-012:** The system MUST suggest a prep day defaulting to the next weekend day, and MUST
  allow the user to override it to any date not in the past (REQ-PP-003/004).
- **FR-PP-013:** A session MUST have a status of `PLANNED`, `COMPLETED`, or `CANCELLED`. A new
  session starts `PLANNED`.
- **FR-PP-014:** Completing a session MUST record a completion timestamp (INV-PL-008) and MUST be
  idempotent — completing an already-completed session does not double-yield portions.
- **FR-PP-015:** On completion, the system MUST create exactly one prepped portion record per
  session recipe, with `origin = PREP_SESSION`, `recipe_id` and denormalized `recipe_name` set
  (INV-INV-006), `meal_prep_session_id` referencing the session,
  `portions_remaining = original_portions = servingsToPrep`, and an `INITIALIZED` portion event of
  the same magnitude (INV-CC-006).
- **FR-PP-016:** At completion the user MUST choose a **storage location** (fridge/freezer) per
  yielded portion (or a session default), and the system MUST apply the storage-appropriate default
  shelf life to compute `expiration_date` (> `prepared_date`, INV-INV-009; REQ-PP-012). Freezer
  yields MUST be marked `FROZEN` (INV-INV-007).
- **FR-PP-017:** Cancelling a `PLANNED` session MUST NOT create any prepped portions and MUST leave
  pantry and inventory unchanged.
- **FR-PP-018:** A session and its recipes MUST be owner-scoped under RLS (default-deny; owner
  full access), consistent with `prepped_meals` and `pantry_items`.

### C. Prep → Shopping integration (REQ-PP-019..022)
- **FR-PP-020:** From a session, the system MUST aggregate required ingredients across all its
  recipes, scaling each recipe's ingredients by that recipe's servings-to-prepare relative to the
  recipe's base yield.
- **FR-PP-021:** The aggregated requirement MUST be compared against current pantry on-hand
  (normalized presence-by-name, quantity > 0) and satisfied items dropped, leaving only the gap.
- **FR-PP-022:** The system MUST generate a shopping list of source type `FROM_PREP` for the gap,
  referencing the session (INV-XD-004), and each item MUST indicate which recipe(s) require it
  (REQ-PP-022).
- **FR-PP-023:** Generating the prep shopping list MUST NOT require the session to be completed; it
  is available while the session is `PLANNED`.

### D. Planning integration (REQ-PP-023..026)
- **FR-PP-030:** When planning, the system MUST surface current prepped inventory as a passive
  suggestion with expiration indicators (REQ-PP-025) without forcing its use (REQ-PP-026).
- **FR-PP-031:** A `PREP_SESSION`-origin portion MUST decrement through the same consume path as
  any other origin (the CONSUMED portion-event ledger), and its planned-meal fulfillment MUST move
  from HAVE_IT to MUST_ACQUIRE once exhausted. *Note:* REQ-PP-027's **automatic** decrement on
  meal-**logging** is deferred with the meal-logging feature — no `meal_logs` table/flow exists yet;
  this feature guarantees the consume mechanism works identically for session yields, not an
  auto-on-log trigger.

## Key Entities

- **MealPrepSession** (`meal_prep_sessions`, new) — owner-scoped batch-cook intent. Fields:
  id (uuid PK), owner_id, household_id (nullable, no FK yet), status
  (`PLANNED`/`COMPLETED`/`CANCELLED`), prep_day (date), completed_at (timestamptz, set iff
  COMPLETED — INV-PL-008), created_at, updated_at. Has ≥1 recipe (INV-PL-006).
- **MealPrepSessionRecipe** (`meal_prep_session_recipes`, new) — a recipe line within a session:
  id, meal_prep_session_id (FK, ON DELETE CASCADE), recipe_id (FK → recipes), recipe_name
  (denormalized snapshot), servings_to_prep (int > 0 — INV-PL-007). Unique (session, recipe).
- **PreppedMeal** (`prepped_meals`, existing) — yield target; `origin = PREP_SESSION`,
  `meal_prep_session_id` set, `recipe_id`/`recipe_name` set (INV-INV-006).
- **PortionEvent** (`portion_events`, existing) — `INITIALIZED` event written per yielded portion.
- **ShoppingList** (`shopping_lists`, existing — altered) — gains `FROM_PREP` source value and a
  nullable `meal_prep_session_id` (INV-XD-004); FROM_PLAN range constraint left intact.

## Success Criteria

- **SC-001:** A user can go from "no prepped food" to portions in inventory entirely through a
  batch session — create → (optional) build shopping list → complete → portions visible in
  `/pantry?tab=PREPPED` — without touching the direct-entry form.
- **SC-002:** A planned meal sourced from a session-yielded portion shows HAVE_IT within one screen
  refresh of placement, with no shopping or cooking action required.
- **SC-003:** A session with N recipes yields exactly N prepped portion records on completion, each
  with the correct servings count, recipe link, and a valid future eat-by date; re-completing yields
  no duplicates.
- **SC-004:** A prep shopping list contains only ingredients not already on hand, and every line
  names the recipe(s) that need it.
- **SC-005:** Cancelling a planned session leaves inventory and pantry byte-for-byte unchanged.
- **SC-006:** All existing direct-entry, fulfillment, planning, and shopping tests continue to pass
  (no regression to the make-ahead path already shipped).

## Assumptions

- **Servings ⇒ portions 1:1.** One serving-to-prepare yields one prepped portion unit; no
  per-recipe portion-size conversion in v1.
- **Ingredient scaling uses recipe base yield (confirmed against schema).** Required quantity =
  `recipe_ingredient.quantity × (servingsToPrep / recipe.servings)`. `recipes.servings` is a
  guaranteed non-null base yield (1..100) and `recipe_ingredients.quantity` is non-null > 0, so
  no fallback or default-yield branch is needed.
- **Presence-by-name pantry match.** Prep→shopping gap detection uses the same normalized
  name-presence rule as fulfillment v1 (`trim().toLowerCase().replace(/\s+/g,' ')`, quantity > 0);
  no unit math.
- **Default shelf lives** follow REQ-PP-012 storage defaults already encoded for direct entry
  (reuse the existing fridge/freezer defaults rather than inventing new ones).
- **Weekend = Saturday/Sunday** for the suggested prep day; "next weekend day" is the nearest
  upcoming Sat or Sun (today if today is one).
- **No auto meal-plan generation** (deferred); `planning_horizon_days` is intentionally NOT added
  to the schema in v1 to avoid an unused, constraint-bearing column (INV-PL-009 applies only once
  distribution lands).
- Pantry quantities are **not** decremented on completion in v1 (see Excluded).

## Sources

This spec was generated by consulting the following references (per `.specswarm/references.md`):

| Source | Sections informing this spec |
|--------|------------------------------|
| `nexus-kitchen-requirements.md` | §3.10.1 Session Planning (REQ-PP-001..009), §3.10.2 Prepped Inventory (REQ-PP-010..018), §3.10.3 Shopping integration (REQ-PP-019..022), §3.10.4 Planning integration (REQ-PP-023..027), §3.10.5 Direct Entry (REQ-PP-028/029), REQ-MP-012 |
| `nexus-kitchen-invariants.md` | INV-PL-006/007/008/009 (session rules), INV-XD-003/004 (consume + shopping-from-prep), INV-INV-006/007/009 (prepped recipe ref, freezer, expiration), INV-CC-006 (portion ledger), INV-PL-017 (fulfillment derived) |
| `nexus-kitchen-logical-architecture.md` | §4.2 Meal Prep Session flow (completion → create prepped_meals, deduct pantry, distribute), §3 module table (planning/inventory tables) |
| `nexus-kitchen-differentiator.md` | "move every requirement to *have it*" thesis; make-ahead framing |
| Feature 004 `spec.md` / `data-model.md` (in-repo) | Existing PREPPED placement + fulfillment derivation that this feature builds on |

No requirement was fabricated without a corresponding source citation, an explicit Assumption, or a
deferral recorded in Excluded.
