---
parent_branch: worktree-feat+shopping
feature_number: 005
status: In Progress
created_at: 2026-06-11T21:53:40-05:00
references_consulted:
  - nexus-kitchen-differentiator.md
  - nexus-kitchen-requirements.md
  - nexus-kitchen-invariants.md
  - nexus-kitchen-domain-specification.md
  - nexus-kitchen-design-system.md
---

# Feature: Shopping — close the buy-gap

## Overview

Per the Differentiator, shopping **is the buy-gap operation**: planning expresses demand,
and shopping is one of the two operations (with prep/cook) that moves a requirement to
"have it" before it's due. This feature turns MUST_ACQUIRE gaps — surfaced by the
fulfillment feature (004) — into an actionable shopping list, supports the act of
shopping itself (checking items off), and **closes the loop by replenishing the pantry**
when the trip completes (REQ-PM-011): bought items become inventory, which in turn flips
the affected planned meals from "To get" to "Can make it" / "Have it" — derived fresh,
never stored (INV-PL-017).

Concretely, the feature delivers:

- **Shopping lists** the user can create manually and fill by hand (REQ-SL-001,
  REQ-SL-003) or **generate from the meal plan** — required ingredients minus pantry
  inventory (REQ-SL-002), i.e. exactly the missing ingredients already computed per
  MUST_ACQUIRE recipe meal, plus store-bought meals still to buy.
- **Add-from-recipe**: push a recipe's (missing) ingredients onto a list directly
  (REQ-SL-004).
- **The shopping trip**: check items off as they land in the cart (REQ-SL-009); checked
  items move to a "completed" section rather than disappearing (REQ-SL-010); items can be
  unchecked or marked unavailable (Domain Specification §5.3 item state machine).
- **Pantry replenishment on completion**: completing a list offers to add the checked
  items to pantry inventory (REQ-PM-011), via the seam the pantry feature already
  reserved for exactly this (`addPantryItemsFromShoppingList`, FR-PI-008 stub).

## Clarifications

### Session 2026-06-11

- Q: Are store sections / store layouts in scope? → A: **Fixed category grouping.**
  Items are grouped by a built-in ingredient-category set (Produce, Dairy, Canned…).
  No custom StoreLayout/StoreSection entities, no layout editor (REQ-SL-006..008 custom
  layouts defer to a later feature; this delivers the aisle-ish organization half of
  REQ-SL-006 now).
- Q: Which planned meals feed generation? → A: **User-chosen date range, default
  today → +6 days.** The generation step shows a range picker pre-filled with the next
  7 days; the user can widen/narrow before generating.
- Q: Store-bought purchases on completion? → A: **Auto-link.** A checked item that was
  generated from a STORE_BOUGHT planned meal becomes a ready-to-eat prepped portion
  (origin = STORE_BOUGHT, per Domain Spec §2437) AND the source planned meal is pointed
  at that portion, deriving HAVE_IT with zero extra steps. (Resolved partly from corpus:
  the prepped-portion mechanism was already canonical; the auto-link was the open call.)

## User Scenarios

### Primary: Close the week's buy-gaps in one trip

A user opens Shopping and taps "Generate from meal plan". The system gathers every
MUST_ACQUIRE planned meal in the chosen date range, collects the missing recipe
ingredients (deduplicated by name, each annotated with which recipes need it, per Domain
Specification §4.7 "For: Marinara, Soup") and the store-bought meals still to buy, and
creates a list. At the store the user checks items off; checked items slide into the
collapsed "Checked" section. Tapping "Complete shopping — add to pantry" adds the checked
items to the pantry. Back on the planning calendar, the affected meals now derive
"Can make it" — the buy-gap is closed without the user holding any of it in their head.

### Manual list for a corner-store run

A user creates a list named "Corner store", types three items with quantities, checks
them off at the store, and completes the trip. The same replenishment offer applies.

### Add missing ingredients from a recipe

While viewing a recipe (or its planned-meal detail showing "Missing: chicken thighs,
coconut milk"), the user taps "Add to shopping list" and picks (or creates) a list. Only
the ingredients missing from the pantry are pre-selected; the user can adjust before
adding (REQ-SL-004).

### An item isn't available at the store

Mid-trip, the store is out of coconut milk. The user marks the item unavailable instead
of checking it. On completion, unavailable (and still-pending) items are NOT added to the
pantry, and the user is offered to carry them onto a new/active list so the gap stays
visible rather than silently dropped.

### Re-generating after the plan changes

The user adds two more dinners to the plan, then regenerates. Generation always computes
against *current* plan + *current* pantry; items the user already has on the active
generated list are not duplicated (matched by normalized name).

### Edge cases

- **Empty gap**: generating when nothing is MUST_ACQUIRE produces no list; the user is
  told the plan is fully covered (a calm success state, not an error — INV-SH-001 forbids
  an active empty list).
- **Checked-item timestamps**: checking an item records when (INV-SH-003); completing a
  list records when (INV-SH-004).
- **Uncheck after check**: returns the item to pending and clears its checked timestamp
  (Domain Specification §5.3).
- **Quantity edits**: item quantities must stay positive (INV-SH-002); the UI prevents
  zero/negative entry.
- **Deleting the last item of an active list**: the user is prompted that this will
  archive/delete the list (INV-SH-001), never left with an empty active list.
- **QUICK meals**: never contribute to generation — they are not fulfillment-tracked
  (Domain Specification §2.4).

## Functional Requirements

### Lists

- FR-SH-001: Users shall be able to create, rename, and archive shopping lists, and
  maintain multiple lists at once (REQ-SL-001, REQ-SL-003).
- FR-SH-002: A shopping list shall carry a status — ACTIVE, SHOPPING, COMPLETED,
  ARCHIVED — per Domain Specification §2.5 `ShoppingListStatus`.
- FR-SH-003: A shopping list shall record its source: MANUAL or FROM_PLAN (Domain
  Specification §2.5 `ShoppingListSource`; FROM_PREP is out of scope until the prep
  feature exists, INV-XD-004 noted for then).
- FR-SH-004: Completed lists shall record `completedAt` (INV-SH-004) and remain visible
  as recent/historical lists (Domain Specification §4.7 "Recent lists").

### Items

- FR-SH-005: Users shall be able to add items manually (name, quantity, free-text unit),
  edit them, and remove them (REQ-SL-001); quantity must be positive (INV-SH-002).
- FR-SH-006: An item shall carry a status — PENDING, CHECKED, UNAVAILABLE, REMOVED — and
  follow the item state machine in Domain Specification §5.3 (check ↔ uncheck; checked →
  unavailable; removal).
- FR-SH-007: Checking an item shall record `checkedAt` (INV-SH-003); unchecking clears it.
- FR-SH-008: Checked items shall move to a visually separate "completed" section that
  remains visible (collapsible), never disappearing from the list (REQ-SL-010).
- FR-SH-009: Generated items shall record which recipes need them ("For: …" attribution,
  Domain Specification §2.5 `neededForRecipeIds`, §4.7 flow).

### Generation — must-acquire gaps into a list

- FR-SH-010: The system shall generate a shopping list from the meal plan: for every
  MUST_ACQUIRE planned meal in the selected date range, include its missing recipe
  ingredients (required ingredients minus pantry inventory, REQ-SL-002) and, for
  STORE_BOUGHT meals, the meal itself as an item to buy.
- FR-SH-011: Generation shall deduplicate items by normalized name (same normalization as
  fulfillment matching, feature 004 clarification: presence-by-name), merging recipe
  attributions; it shall not duplicate items already pending on the target list.
- FR-SH-012: Missing-ingredient computation shall use the same derivation the fulfillment
  feature uses (single source of truth) so the list and the calendar chips never disagree.
- FR-SH-013: Users shall be able to add a recipe's missing ingredients to a list directly
  from recipe-facing surfaces (REQ-SL-004).
- FR-SH-014: Generation shall operate over a user-chosen date range, pre-filled with
  today → +6 days (clarified 2026-06-11); the user can adjust the range before
  generating.

### Completing the trip — replenish the pantry

- FR-SH-015: When the user completes a list, the system shall offer to add the CHECKED
  items to pantry inventory (REQ-PM-011) through the existing pantry seam
  (`addPantryItemsFromShoppingList`, FR-PI-008); the user can review/adjust before
  confirming, and may decline.
- FR-SH-016: Items added to the pantry shall appear as pantry items with the purchased
  quantity and unit; if a pantry item with the same normalized name already exists, the
  quantities are merged rather than creating a duplicate entry.
- FR-SH-017: PENDING and UNAVAILABLE items at completion shall be offered as carry-over
  to another (new or existing active) list so unmet gaps remain visible.
- FR-SH-018: A checked item that was generated from a STORE_BOUGHT planned meal shall,
  on completion, be added to inventory as a ready-to-eat prepped portion (origin =
  STORE_BOUGHT, Domain Specification §2437) — not a pantry item — and the source planned
  meal shall be automatically pointed at that portion so it derives HAVE_IT (clarified
  2026-06-11). Generated items therefore record which planned meal they were created
  for. If the source meal was meanwhile deleted or no longer PLANNED, the portion is
  still created; only the link is skipped.

### Organization

- FR-SH-019: Pending items shall be grouped by a built-in ingredient-category set
  (e.g., Produce, Dairy, Meat & Seafood, Canned, Frozen, Bakery, Pantry staples, Other)
  in a fixed order (clarified 2026-06-11). Users can change an item's category; manual
  items default to "Other". Custom store layouts (REQ-SL-007..008, StoreLayout/
  StoreSection entities) are deferred to a later feature.

### Data & security

- FR-SH-020: Shopping data is per-user; all shopping tables enforce default-deny
  row-level security so users only see their own lists (project data rules; household
  sharing INV-SH-007 / REQ-HH-005 is out of scope until households exist).
- FR-SH-021: All shopping invariants enforceable at the data layer (INV-SH-002,
  INV-SH-003, INV-SH-004) shall be enforced there, not only in the UI.

## Success Criteria

- A user can go from a planned week with buy-gaps to a generated shopping list in under
  10 seconds and at most 3 interactions.
- After completing a shopping trip and accepting replenishment, every recipe meal whose
  missing ingredients were all purchased shows "Can make it" on the calendar without any
  manual pantry entry.
- Generated lists contain no duplicate entries for the same ingredient name, and every
  generated ingredient line shows which meals/recipes need it.
- Checked items remain visible (in the completed section) for the entire trip; nothing
  the user checked ever disappears before completion.
- No active list ever displays with zero items; no checked item ever lacks a checked
  time; no completed list ever lacks a completion time (INV-SH-001..004 hold in
  production data).
- All shopping screens work on both desktop and mobile widths (responsive SPA, SRS
  scope §1).

## Key Entities

Per Domain Specification §2.5 (Shopping Context):

- **ShoppingList** — id, owner, name, sourceType (MANUAL | FROM_PLAN), optional
  mealPlanId, status (ACTIVE | SHOPPING | COMPLETED | ARCHIVED), completedAt, timestamps.
  (householdId, storeLayoutId deferred with their parent features.)
- **ShoppingListItem** — id, list, optional ingredient identity, name, quantity
  (positive), free-text unit, built-in category (FR-SH-019), status (PENDING | CHECKED |
  UNAVAILABLE | REMOVED), checkedAt, neededForRecipeIds (attribution), source planned
  meal reference for STORE_BOUGHT-generated items (FR-SH-018), sortOrder, timestamps.
  (photoUrl, assignedToUserId, online-ordering fields, storeSectionId deferred.)
- **StoreLayout / StoreSection** — deferred to a later feature (clarified 2026-06-11);
  v1 uses a fixed built-in category set instead.

Existing entities consumed (not modified): PlannedMeal + fulfillment derivation
(feature 004), PantryItem (feature 001/002) via the reserved replenishment seam.

## Assumptions

- **Single-user scope**: households/sharing (REQ-HH-005, REQ-HH-009..010, INV-SH-007)
  don't exist yet; lists are private to their owner. Schema leaves room (nullable
  household reference) but no sharing behavior ships.
- **Name-level matching, no unit math**: consistent with feature 004's clarified rule,
  "required minus pantry" is computed by normalized-name presence, not quantity/unit
  arithmetic (units are free text). Generated item quantities default from the recipe's
  stated quantity where one recipe needs it; when several recipes need the same
  ingredient, the item is listed once with attribution and a user-editable quantity
  (no cross-unit summing is attempted).
- **Replenishment storage location**: items added to the pantry default to the PANTRY
  storage location; the user can adjust in the review step (the reserved seam already
  accepts an optional storage location per item).
- **Deferred per corpus but out of this feature**: product photos on items (REQ-SL-005),
  barcode scanning (REQ-SL-011, REQ-PM-004), online product links / export to grocery
  services (REQ-SL-012..014), prep-session generation (REQ-PP-021..022), item assignment
  (REQ-HH-009). Each is a later feature; nothing in this design blocks them.
- **Recently viewed shopping data is cached** for responsive navigation with optimistic
  check-off updates reconciled against the server (REQ-CN-002, REQ-CN-003) — same
  online-first pattern as existing features (ADR-0002).

## Sources

This spec was generated by consulting the following references (per
`.specswarm/references.md`):

| Source | Sections informing this spec |
|--------|------------------------------|
| `nexus-kitchen-differentiator.md` | Core model ("Shopping = the buy-gap"); tiebreaker question |
| `nexus-kitchen-requirements.md` | §3.4.3 REQ-PM-011 (replenish on completion); §3.5 REQ-SL-001..014 (lists, generation, shopping experience); §3.7 REQ-CN-002/003 (caching, optimistic UI) |
| `nexus-kitchen-domain-specification.md` | §2.5 Shopping Context (ShoppingList/Item, statuses, sources, StoreLayout); §3.5 invariants; §4.7 Shopping Flow (UI flow, attribution, complete-to-pantry); §5.3 item state machine |
| `nexus-kitchen-invariants.md` | §1.5 INV-SH-001..007; INV-PL-017 (derived fulfillment); INV-XD-004 (FROM_PREP, deferred) |
| Feature 004 spec + `src/lib/planning/fulfillment.ts` | MUST_ACQUIRE derivation, missing-ingredients list, presence-by-name matching, STORE_BOUGHT assumption |
| `src/lib/pantry/shoppingListIntegration.ts` + `types.ts` | Reserved replenishment seam (FR-PI-008 stub, `ShoppingListItem` shape) |

No section was fabricated without a corresponding source citation OR
`[NEEDS CLARIFICATION]` marker.
