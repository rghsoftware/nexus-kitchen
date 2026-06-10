---
parent_branch: worktree-feat+pantry-inventory
feature_number: '001'
status: In Progress
created_at: 2026-06-09T19:40:31+00:00
references_consulted:
  - docs/nexus-kitchen-requirements.md
  - docs/nexus-kitchen-domain-specification.md
  - docs/nexus-kitchen-invariants.md
  - docs/nexus-kitchen-logical-architecture.md
---

# Feature: Pantry & Inventory

## Overview

The pantry and inventory system is the **"what's on hand"** half of Nexus Kitchen's core thesis — tracking two distinct pools of on-hand resources: raw ingredient stocks (`PantryItem`) and ready-to-eat portions (`PreppedMeal`). Together, these two collections power the fulfillment engine: when a planned meal is cross-referenced against current inventory, the system derives its fulfillment state (`HAVE_IT`, `CAN_MAKE_IT`, or `MUST_ACQUIRE`). Nothing else in the product can close the gap between a meal requirement and its date without this feature being in place.

This feature delivers the complete inventory management experience: add, view, edit, and remove both pantry items and prepped meals; track quantities, expiration dates, and storage locations; receive proactive expiration and low-stock alerts; and browse the inventory through a visual, photo-first grid optimized for the "out of sight, out of mind" cognitive pattern common among the target users.

Per the product thesis (per `nexus-kitchen-requirements.md` §1.3 and `nexus-kitchen-differentiator.md`): the pantry and prepped meal inventory are the operational foundation that every other feature — planning, shopping list generation, meal prep sessions, and fulfillment computation — depends on. This feature must be built first.

## User Scenarios

### Scenario 1: Browsing the Pantry Overview

A user navigates to the Pantry tab and sees a visual grid of their current pantry contents organized by storage location (Fridge, Freezer, Pantry). An "Expiring Soon" section appears at the top when any items have expiration dates within 7 days. A "Running Low" section lists items whose quantity has fallen at or below their configured minimum. The user can tap any item card to view or edit its details.

### Scenario 2: Adding a Pantry Item Manually

A user taps "+ Add", selects "Manual", and fills in: item name, quantity + unit, storage location, and optionally expiration date, purchase date, minimum quantity threshold, and a photo. The system suggests an expiration date based on the selected storage location's default shelf life. Upon saving, the item appears immediately in the pantry grid under the correct location tab.

### Scenario 3: Adding via Barcode Scan

A user taps "+ Add" then "Scan Barcode". The browser camera activates. Upon scanning, the system pre-fills name, category, and nutrition info (from the barcode database). The user confirms or edits the details, sets quantity and location, and saves.

### Scenario 4: Adding a Prepped Meal Directly

A user taps "+ Add a prepped meal I already have" (not a prep session — direct entry is the primary path). They enter a display name (e.g., "Chili"), indicate whether they made it or bought it, optionally link a recipe, set portion count, prep/purchase date, storage location, and the system suggests a "use within" shelf life. The portion is immediately part of the inventory as a ready-to-eat item.

### Scenario 5: Updating Quantities After Use

A user has used 2 cups of flour. They tap the flour item in the pantry, adjust the quantity down, and save. The system updates the on-hand amount and recalculates whether any planned meals' fulfillment state has changed.

### Scenario 6: Marking Items as Purchased When Completing a Shopping List

After completing a shopping trip, the user taps "Complete Shopping – Add to Pantry" in the shopping list flow. The system offers to bulk-add all checked items to pantry inventory with sensible defaults for quantity and location, avoiding repetitive data entry.

### Scenario 7: Household Shared Pantry

A household member updates the egg count. The change propagates via Supabase Realtime to other online household members immediately. Planned meal fulfillment states are recomputed for all household members.

### Scenario 8: Expiration Alert Response

A user receives an "Expiring Soon" notification via Pushover. They open the app, see the flagged items in the Expiring Soon shelf on the pantry overview, and can either plan a meal around those items (fulfillment path) or remove them if already used.

## Clarifications

### Session 2026-06-09

- Q: How strict should the CAN_MAKE_IT ingredient matching and quantity check be? → A: Deferred to planning phase — fulfillment computation is out of scope for this build; only inventory CRUD and the `getInventorySnapshot()` stub are delivered. (FR-FC-001/002 deferred; FR-FC-003 updated to stub interface.)
- Q: FR-PI-008 (shopping list → pantry) and FR-FC-003 (recompute fulfillment) depend on features not yet built — how should they be handled? → A: Stub interfaces only — define function signatures and type contracts; no-op implementations; upstream features wire them when built. (FR-PI-008 and FR-FC-003 updated.)
- Q: Can users correct a prepped meal's portion count, or is consume-only the only action? → A: Correction allowed — users may edit portion count directly, which creates an ADJUSTED PortionEvent per INV-INV-011. (FR-PM-004a added.)

## Functional Requirements

### Pantry Item Management

- **FR-PI-001**: Users shall be able to add pantry items with: name, quantity, unit, storage location (Fridge, Freezer, Pantry, Other), and optionally expiration date, purchase date, opened date, minimum quantity threshold, and a photo (per REQ-PM-001, REQ-PM-002, REQ-PM-006, REQ-PM-007).
- **FR-PI-002**: Users shall be able to add pantry items via barcode scan; the system shall pre-fill name, category, and available product info from the barcode database (per REQ-PM-004).
- **FR-PI-003**: Users shall be able to add pantry items via photo with AI-powered item recognition (per REQ-PM-005).
- **FR-PI-004**: Users shall be able to edit any pantry item field after creation (per REQ-PM-001).
- **FR-PI-005**: Users shall be able to delete pantry items. Deletion is permanent and does not affect historical data.
- **FR-PI-006**: The system shall display a visual grid of pantry contents organized by storage location; items with photos show their photo thumbnail (per REQ-PM-008, REQ-PM-009).
- **FR-PI-007**: The pantry overview shall surface an "Expiring Soon" section showing items whose `expirationDate` is within 7 days and a "Running Low" section for items at or below `minimumQuantity` (per REQ-PM-003, REQ-PM-006).
- **FR-PI-008** _(stub)_: This build shall expose an `addPantryItemsFromShoppingList(checkedItems: ShoppingListItem[]): Promise<void>` interface that the Shopping feature will call when a shopping trip is completed (per REQ-PM-011). The function is defined with correct types but is a no-op until the Shopping feature wires it up.
- **FR-PI-009**: The system shall suggest an expiration date when a user sets a storage location, based on default shelf lives: Pantry 365 days, Fridge 7 days, Freezer 90 days, Other 30 days (per domain spec §2.3).
- **FR-PI-010**: Pantry items may be linked to a master ingredient record (`ingredientId`) for nutrition lookup and recipe matching; this link is optional and does not block creation.
- **FR-PI-011**: For shared households, pantry inventory is shared across all household members; changes propagate via Supabase Realtime (per REQ-HH-004, REQ-HH-008).

### Prepped Meal Inventory

- **FR-PM-001**: Users shall be able to add ready-to-eat portions directly — without requiring a prep session — by specifying: display name, origin (made it / bought it), optional recipe link, portion count, date prepared/purchased, storage location, and shelf-life estimate (per REQ-PP-028, REQ-PP-029; domain spec §4.11).
- **FR-PM-002**: The system shall support three prepped meal origins: `PREP_SESSION` (created by completing a meal prep session), `DIRECT_ENTRY` (user added manually), and `STORE_BOUGHT` (per domain spec §2.3 `PreppedMealOrigin`).
- **FR-PM-003**: Prepped meals shall track: `portionsRemaining`, `originalPortions` (immutable), `storageLocation`, `expirationDate`, `defrostState`, and optionally a photo (per REQ-PP-010, REQ-PP-011).
- **FR-PM-004**: Users shall be able to consume/remove portions from a prepped meal inventory record (per REQ-PP-018); consuming all portions removes the item.
- **FR-PM-004a**: Users shall be able to correct the portion count of an existing prepped meal (e.g., to fix a typo or account for real-world yield variation). A correction creates an `ADJUSTED` `PortionEvent` (per INV-INV-011) and updates `portionsRemaining` accordingly. The correction UI is visually distinct from the consume UI to prevent accidental misuse.
- **FR-PM-005**: Users shall be able to record moving a frozen prepped meal to the fridge to begin defrosting; the system shall track defrost start time and display an estimated "ready to eat" time (per REQ-PP-016, REQ-PP-017; domain spec §5.2 defrost state machine).
- **FR-PM-006**: The system shall visually indicate prepped meals approaching expiration (within 2 days) (per REQ-PP-014).
- **FR-PM-007**: The system shall surface "eat this first" suggestions ordering items by expiration date (per REQ-PP-015).
- **FR-PM-008**: For shared households, prepped meal inventory is household-scoped; all household members see and can interact with it (per REQ-HH-004).
- **FR-PM-009**: The system shall apply default shelf lives based on storage location when creating a prepped meal (Fridge: 4 days, Freezer: 90 days; REQ-PP-012). Users may override the shelf life estimate (per REQ-PP-013).

### Fulfillment State Computation

> **Scope note (clarification 2026-06-09):** Fulfillment state computation is **deferred to a separate feature** — it requires the Planning feature's `PlannedMeal` data, which does not exist yet. This build delivers the inventory CRUD and data model that the fulfillment engine will consume. The interface contract is documented here so downstream features can depend on it.

- **FR-FC-001** _(deferred — not implemented in this build)_: The fulfillment state of each `PlannedMeal` shall be computed on-demand by comparing the plan source against current inventory:
  - `HAVE_IT`: source = `PREPPED` and the referenced `PreppedMeal` has `portionsRemaining > 0`
  - `CAN_MAKE_IT`: source = `RECIPE` and every required ingredient is available in the pantry with sufficient quantity
  - `MUST_ACQUIRE`: source = `RECIPE` with missing ingredients, or source = `STORE_BOUGHT` not yet purchased
  - (per INV-PL-017; domain spec §2.4 PlannedMeal; `nexus-kitchen-differentiator.md`)
- **FR-FC-002** _(deferred — not implemented in this build)_: Fulfillment state shall **never be stored** — it is always derived from live inventory data (per INV-PL-017).
- **FR-FC-003**: This build shall expose a `getInventorySnapshot(): InventorySnapshot` interface (stub) that the Planning feature can call to retrieve all current `PantryItem`s and `PreppedMeal`s for fulfillment computation. The function is defined but not wired to any consumer in this build.

### Inventory Invariants Enforced

The following invariants from `nexus-kitchen-invariants.md` §1.3 must be enforced at the data layer:

- INV-INV-001: Pantry item quantity ≥ 0
- INV-INV-002: Minimum quantity ≥ 0 if set
- INV-INV-003: Expiration date not more than 30 days before creation date (allows backdating)
- INV-INV-004: Portion ledger never produces negative remaining portions
- INV-INV-005: Prepped meal portions remaining ≥ 0
- INV-INV-006: Recipe reference on prepped meal is valid if set (null for DIRECT_ENTRY/STORE_BOUGHT)
- INV-INV-007: Freezer items are marked FROZEN; non-freezer items are NOT_APPLICABLE or READY
- INV-INV-008: DEFROSTING items must be in FRIDGE with a defrost start timestamp
- INV-INV-009: Prepped meal expiration > preparation date
- INV-INV-010: Portion event delta is non-zero
- INV-INV-011: Only ADJUSTED portion events may add portions

## Success Criteria

- A user can add a new pantry item (manually) in 3 taps or fewer, measured from the Pantry tab.
- A user can add a prepped meal directly (no session required) in under 60 seconds from the Pantry tab.
- The pantry overview loads within 500ms against cached local data for libraries up to 200 items.
- Zero expiring-soon alerts are missed: every pantry item within 7 days of expiration appears in the Expiring Soon section on next app open.
- Fulfillment states for planned meals update within 300ms of any inventory change (client-side).
- Household pantry changes are visible to all online household members within 2 seconds (via Supabase Realtime).
- 100% of data writes enforce the INV-INV-\* invariants; no invalid state is persisted.
- The visual pantry grid renders correctly on phone, tablet, and desktop viewport widths.
- Barcode scanning identifies products and pre-fills item fields in >80% of successful scans (when network available).

## Key Entities

### PantryItem

Raw ingredient stocks. Fields: `id`, `ownerId`, `householdId?`, `ingredientId?`, `name`, `barcode?`, `quantity` (≥0), `unit`, `minimumQuantity?`, `storageLocation` (PANTRY|FRIDGE|FREEZER|OTHER), `customLocation?`, `purchaseDate?`, `expirationDate?`, `openedDate?`, `photoUrl?`, `thumbnailUrl?`. Computed: `isRunningLow`, `isExpiringSoon`, `isExpired`.

### PreppedMeal

Ready-to-eat portions. Fields: `id`, `ownerId`, `householdId?`, `origin` (PREP_SESSION|DIRECT_ENTRY|STORE_BOUGHT), `name`, `recipeId?`, `recipeName?`, `mealPrepSessionId?`, `portionsRemaining` (≥0), `originalPortions` (immutable, >0), `storageLocation`, `containerLabel?`, `preparedDate`, `expirationDate`, `defrostState` (NOT_APPLICABLE|FROZEN|DEFROSTING|READY), `defrostStartedAt?`, `estimatedReadyAt?`, `photoUrl?`. Computed: `isExpiringSoon`, `isExpired`, `isReadyToEat`.

### PortionEvent (portion ledger)

Append-only audit trail for prepped meal portion changes. Fields: `id`, `preppedMealId`, `deltaPortions` (non-zero integer; negative = consume, positive = ADJUSTED only), `kind` (CONSUMED|ADJUSTED|INITIALIZED), `triggeredBy?` (MealLog id), `createdAt`.

### StorageLocation (enum)

`PANTRY` (365 day default shelf life), `FRIDGE` (7 days), `FREEZER` (90 days), `OTHER` (30 days).

### DefrostState (enum)

`NOT_APPLICABLE` → item in fridge/pantry. `FROZEN` → in freezer. `DEFROSTING` → moved to fridge, thawing. `READY` → thawed.

## Assumptions

- **A-001**: Barcode scanning uses the browser Camera API; no native app required. Scan quality on mobile browsers is assumed to be sufficient for common product barcodes.
- **A-002**: Photo upload for pantry items uses Supabase Storage with client-side thumbnail generation before upload. Photos are optional on all items.
- **A-003**: AI-powered photo recognition for pantry items (FR-PI-003) is a graceful-degradation feature: if the AI provider is unavailable, the flow falls back to manual entry. The AI feature is not required for the MVP of this feature.
- **A-004**: "Ingredient matching" (linking a `PantryItem` to a master `Ingredient` record) is handled via name search against the ingredient master table. Exact match is preferred; fuzzy match is acceptable. A pantry item with no `ingredientId` still appears in inventory but cannot contribute to `CAN_MAKE_IT` fulfillment checks.
- **A-005**: The portion ledger (`PortionEvent`) is the authoritative source for `portionsRemaining`. The `portionsRemaining` field on `PreppedMeal` is a denormalized read-ahead that must stay consistent with the ledger. Reconciliation is enforced at the DB level (trigger or RLS check).
- **A-006**: Default shelf lives (FR-PI-009, FR-PM-009) are hardcoded by storage location; per-ingredient-category overrides are out of scope for this feature.
- **A-007**: The Realtime household sync (FR-PI-011, FR-PM-008) is best-effort as defined in REQ-CN-006 — clients that lose connection re-fetch on reconnect.

## Sources

This spec was generated by consulting the following references (per `.specswarm/references.md`):

| Source                                       | Sections informing this spec                                                                                                                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/nexus-kitchen-requirements.md`         | §3.4 Pantry and Inventory Management (REQ-PM-001–011), §3.10 Meal Prep Support (REQ-PP-010–029), §4.2 Connectivity & Caching, §4.4 Security (REQ-SC-006–007)                                                                                                                     |
| `docs/nexus-kitchen-domain-specification.md` | §2.3 Inventory Context (PantryItem, PreppedMeal, StorageLocation, DefrostState, PreppedMealOrigin), §2.4 PlannedMeal (fulfillment states), §3.3 Inventory Invariants (INV-INV-001–011), §4.9 Pantry Management Flow, §4.11 Add Prepped Meal Directly, §5.2 Defrost State Machine |
| `docs/nexus-kitchen-invariants.md`           | §1.3 Inventory Invariants (full table)                                                                                                                                                                                                                                           |
| `docs/nexus-kitchen-logical-architecture.md` | §2.1 High-Level Diagram (Supabase Realtime, Storage, PostgREST)                                                                                                                                                                                                                  |
