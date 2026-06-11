---
parent_branch: worktree-feat+fulfillment-state
feature_number: 004
status: Complete
created_at: 2026-06-10T18:45:00-05:00
references_consulted:
  - nexus-kitchen-differentiator.md
  - nexus-kitchen-requirements.md
  - nexus-kitchen-invariants.md
  - nexus-kitchen-domain-specification.md
  - nexus-kitchen-design-system.md
---

# Feature: Fulfillment State (HAVE_IT / CAN_MAKE_IT / MUST_ACQUIRE)

## Overview

This feature implements the product's core thesis (per the Differentiator): a planned meal
is a **requirement to be fulfilled**, and the app's job is to show — at a glance — which
requirements are already covered and which still need action. For each planned meal, the
system derives and displays one of three fulfillment states (REQ-MP-012):

- **HAVE_IT** — a ready-to-eat portion already exists (source = PREPPED and the referenced
  portion has portions remaining > 0). *Per Domain Specification §2.4.*
- **CAN_MAKE_IT** — a recipe whose ingredients are on hand in the pantry (source = RECIPE
  and every ingredient is available). *Per Domain Specification §2.4.*
- **MUST_ACQUIRE** — not yet satisfiable: a RECIPE missing ingredients (cook/shop), or a
  STORE_BOUGHT meal not yet purchased (buy). *Per Domain Specification §2.4.*

QUICK meals carry **no fulfillment state by design** (Domain Specification §2.4: "not
fulfillment-tracked").

Fulfillment state is **derived, never stored** (INV-PL-017): it is computed per planned meal
from current inventory (pantry items + prepped portions) and the plan, at display time. No
database column, no persistence, no migration of stored state.

The planning calendar (feature 003) and the inventory features (pantry + prepped portions,
feature 002) already exist; this feature is the connective tissue between them — the
`InventorySnapshot` interface (`getInventorySnapshot()`, FR-FC-003) was stubbed for exactly
this consumer.

## Clarifications

### Session 2026-06-10

- Q: Should this feature enable PREPPED placement so HAVE_IT is reachable end-to-end?
  → A: **Yes — include PREPPED placement.** Add "prepped portion" as a placeable source in
  the Add-meal flow (selecting from portions with portions remaining > 0). No migration
  needed (`planned_meals.prepped_meal_id` already exists).
- Q: What does "ingredient is on hand in the pantry" mean for CAN_MAKE_IT?
  → A: **Presence by name.** A pantry item whose normalized name matches the recipe
  ingredient's name (case/whitespace-insensitive) with quantity > 0 counts as on hand.
  No quantity/unit math in v1.

## Scope

**Included:**

- A pure derivation function computing fulfillment state for a planned meal given the
  current inventory snapshot (pantry items, prepped portions) and recipe ingredient lists.
- Display of the derived state on every planned-meal surface in the calendar: meal cards
  (day/week/month views) and the meal detail sheet.
- For MUST_ACQUIRE recipe meals: the detail sheet lists which ingredients are missing
  (the gap that needs closing).
- **Placing a prepped portion on the calendar** (PREPPED source), making HAVE_IT reachable
  end-to-end: the Add-meal flow offers the user's prepped portions (those with portions
  remaining > 0) alongside recipes, store-bought, and quick entries. Uses the existing
  reserved `prepped_meal_id` reference; no schema change. *(Clarified 2026-06-10.)*

**Excluded:**

- Shopping-list generation from MUST_ACQUIRE gaps (the buy-gap operation; separate feature).
- "Cook it" / "Mark as prepped" conversion flows (the make-gap operation; separate feature).
- Pantry quantity deduction when cooking (separate feature).
- Any persistence of fulfillment state (forbidden by INV-PL-017).
- Suggestions/intelligence that use fulfillment (REQ-MP-006..010; separate features).

## User Scenarios

### Primary: See the week's gaps at a glance

A user opens the planning calendar. Each planned meal shows its fulfillment state as a calm,
worded chip with an icon (never color alone, REQ-AC-003): "Have it", "Can make it", or
"To get". The user can immediately see which days are covered and which still need action —
without holding any of it in their head (the Differentiator's core promise).

### Check why a meal isn't makeable

A user taps a recipe meal showing "To get". The detail sheet lists the ingredients that are
missing from the pantry (e.g., "Missing: chicken thighs, coconut milk"), so the user knows
the exact gap to close by shopping or substituting.

### A pantry change is reflected in the plan

A user adds the missing ingredients to their pantry (e.g., after shopping). When they return
to the planning calendar, the affected recipe meals now show "Can make it" — derived fresh
from current inventory, never from a stale stored value.

### Prepped portion runs out

A planned meal references a prepped portion (source = PREPPED). While portions remain, it
shows "Have it". If the portions are consumed by other meals first (portions remaining
reaches 0), the meal shows "To get" instead — the requirement is no longer covered.

### Place a prepped portion on a day

A user adds a meal to Thursday dinner and chooses one of their prepped portions ("Chili —
3 portions left, freezer"). The meal lands on the calendar showing "Have it" — the
requirement is covered the moment it's placed.

### Edge cases

- **QUICK meals** ("Takeout", "Leftovers"): show no fulfillment chip at all — they are not
  fulfillment-tracked.
- **Referenced prepped portion deleted** (reference set null, FR-FS-011): the meal stays
  visible with a neutral fallback name and derives as MUST_ACQUIRE.
- **LOGGED / SKIPPED meals**: the requirement is already resolved (eaten or dismissed); no
  fulfillment state is shown (see Assumptions).
- **Recipe with zero ingredients on record** (e.g., deleted recipe leaving only the title
  snapshot, FR-PL-019): cannot be verified as makeable; treated as MUST_ACQUIRE.
- **Optional ingredients**: missing optional ingredients do not block CAN_MAKE_IT (see
  Assumptions).
- **Inventory not yet loaded** (online-first, cached reads): surfaces show a neutral
  no-state until the snapshot is available — never a wrong state, and never an alarming
  loading treatment.

## Functional Requirements

- FR-FS-001: The system shall derive a fulfillment state for every planned meal with source
  RECIPE, PREPPED, or STORE_BOUGHT, per the canonical rules in Domain Specification §2.4:
  - HAVE_IT ⇔ source = PREPPED ∧ referenced portion's portions remaining > 0
  - CAN_MAKE_IT ⇔ source = RECIPE ∧ every required ingredient is on hand in the pantry
  - MUST_ACQUIRE ⇔ otherwise (RECIPE missing ingredients; STORE_BOUGHT not yet purchased;
    PREPPED whose portion is exhausted or no longer exists)
- FR-FS-002: QUICK-source meals shall carry no fulfillment state (none displayed).
- FR-FS-003: Fulfillment state shall never be persisted (INV-PL-017); it is computed from
  the current inventory snapshot at display time.
- FR-FS-004: An ingredient is "on hand" when a pantry item whose **normalized name matches**
  the recipe ingredient's name (case-insensitive, whitespace-trimmed/collapsed) exists with
  quantity > 0. Presence-only — no quantity or unit comparison in v1 (there is no master
  ingredient table or unit-conversion model to base one on). *(Clarified 2026-06-10.)*
- FR-FS-005: Every planned-meal surface in the calendar (meal cards in day/week/month
  views, meal detail sheet) shall display the derived state as an icon + worded label
  (REQ-AC-003: never color alone; design system: icons always pair with a text label).
- FR-FS-006: For a RECIPE meal in MUST_ACQUIRE, the meal detail sheet shall list the
  missing required ingredients by name.
- FR-FS-007: Fulfillment display shall use the calm status vocabulary of the design system:
  no alarm-red, no shaming language ("To get", never "You're missing…" as a reproach);
  MUST_ACQUIRE uses the warm `--attention` treatment at most.
- FR-FS-008: The derivation shall consume the existing `InventorySnapshot` interface
  (FR-FC-003) as its inventory input, keeping the derivation a pure function that is
  unit-testable without a backend.
- FR-FS-009: When the inventory snapshot is not yet available, surfaces shall omit the
  fulfillment chip rather than show a possibly-wrong state.
- FR-FS-010: Users shall be able to place a prepped portion on the calendar as a planned
  meal (source = PREPPED, referencing the portion). The picker shall offer only portions
  with portions remaining > 0. Exactly-one-source integrity (INV-PL-003) continues to hold;
  the existing `prepped_meal_id` reference is used (no schema change).
- FR-FS-011: A PREPPED planned meal shall display the prepped portion's name; if the
  referenced portion is later deleted (reference set null), the meal shall remain visible
  with a neutral fallback name and derive as MUST_ACQUIRE.

## Success Criteria

- Opening the planning calendar shows a fulfillment label on 100% of RECIPE, PREPPED, and
  STORE_BOUGHT planned meals, and on 0% of QUICK meals.
- A user can determine which planned meals need action this week in under 5 seconds,
  without opening any meal's detail.
- Adding the missing ingredients of a recipe meal to the pantry changes that meal's
  displayed state to "Can make it" on next view, with no manual refresh action beyond
  normal navigation.
- For any meal shown as "To get" with a recipe source, the user can see the exact missing
  ingredients within one tap.
- Fulfillment state appears nowhere in the database schema (verifiable: no migration in
  this feature adds a fulfillment column).
- All derivation rules are covered by automated tests, including the edge cases above
  (QUICK, exhausted portion, zero-ingredient recipe, optional ingredients).

## Key Entities

No new persisted entities. The feature introduces **derived, in-memory concepts only**:

- **FulfillmentState** — `HAVE_IT | CAN_MAKE_IT | MUST_ACQUIRE` (client-side union; not a
  Postgres enum, per INV-PL-017).
- **FulfillmentResult** (per planned meal) — the state plus supporting detail (e.g., the
  list of missing ingredient names for a RECIPE in MUST_ACQUIRE).

Existing entities consumed (read-only): PlannedMeal (feature 003), PantryItem, PreppedMeal /
portions remaining (feature 002), RecipeIngredient (feature 001).

## Assumptions

- **STORE_BOUGHT is always MUST_ACQUIRE.** The domain model has no "purchased" flag on a
  planned meal; per Domain Specification §2437, buying a store-bought item enters it as
  ready-to-eat inventory (a prepped portion), at which point covering the meal means
  pointing it at that portion (PREPPED → HAVE_IT). Until then it remains a buy-gap.
- **LOGGED and SKIPPED meals show no fulfillment state.** The requirement is resolved;
  showing "To get" on an already-eaten meal would be noise (and contradict the shame-free
  voice). SWAPPED likewise. Only PLANNED meals are fulfillment-tracked.
- **Optional ingredients don't block CAN_MAKE_IT.** `recipe_ingredients.is_optional = true`
  rows are excluded from the "every ingredient on hand" check; substitutes
  (`substitute_for` set) count as alternatives — the base ingredient OR its substitute on
  hand satisfies the requirement.
- **Derivation is client-side.** Consistent with the SPA architecture (data access via
  supabase-js, no server compute needed for pure derivation) and with the existing
  client-side derived fields pattern (`isExpiringSoon`, `isRunningLow` in feature 002).
- **Freshness is "current cached inventory".** Online-first: the snapshot reflects the
  client's current store state (kept fresh by realtime best-effort + refetch on
  navigation). No additional realtime machinery is added by this feature.
- **Expired pantry items still count as "on hand".** Inventory presence, not quality, is
  what the state machine tracks; expiry already has its own calm signal in the pantry. (No
  corpus rule says expired items are excluded from makeability.)

## Sources

This spec was generated by consulting the following references (per `.specswarm/references.md`):

| Source | Sections informing this spec |
|--------|------------------------------|
| `nexus-kitchen-differentiator.md` | Entire document — the three-state requirement model and "move every requirement to have-it" thesis |
| `nexus-kitchen-requirements.md` | §3.1.3 REQ-MP-011/012 (derive & display fulfillment); REQ-AC-003, REQ-UX-007/008 (calm, non-color-only display) |
| `nexus-kitchen-invariants.md` | INV-PL-017 (derived, never stored); INV-INV-004/005 (portion ledger ≥ 0); INV-PL-003 (exactly one source) |
| `nexus-kitchen-domain-specification.md` | §2.4 PlannedMeal / PlannedMealSource / fulfillment-state comment block (lines 487–508); §1250–1252 (INV-PL-017); §2437 (store-bought purchase → prepped portion → HAVE_IT) |
| `nexus-kitchen-design-system.md` | §1 voice, §3 "status is calm" (`--attention`, never alarm-red), §5 `.nk-*` vocabulary, §6 icons pair with labels |
| Memory: `project_supabase-gen-types-workflow.md`, `project_supabase-migration-naming.md` | Noted; no migration is expected for this feature (INV-PL-017) |

No section was fabricated without a corresponding source citation OR `[NEEDS CLARIFICATION]` marker.
