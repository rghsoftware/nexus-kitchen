# Nexus Kitchen — Project Invariants

**Document Version:** 1.0.0  
**Date:** January 10, 2026  
**Purpose:** Comprehensive developer reference for all system invariants across domain, architecture, sync, security,
and API layers.

> **Document relationship:**  
> This document consolidates and extends the invariants defined in the
> [Domain Specification](./domain-specification.md) §3.  
> Domain invariants (INV-\*) are authoritative in the Domain Specification; this document adds architectural and
> operational invariants.

---

## Table of Contents

1. [Domain/Business Invariants](#1-domainbusiness-invariants)
2. [Aggregate & Consistency Invariants](#2-aggregate--consistency-invariants)
3. [Sync & Offline Invariants](#3-sync--offline-invariants)
4. [Data Integrity Invariants](#4-data-integrity-invariants)
5. [API Contract Invariants](#5-api-contract-invariants)
6. [Security Invariants](#6-security-invariants)
7. [Privacy & Data Ownership Invariants](#7-privacy--data-ownership-invariants)
8. [Performance Invariants](#8-performance-invariants)
9. [Cross-Cutting Invariants](#9-cross-cutting-invariants)

---

## 1. Domain/Business Invariants

These invariants define the rules that must always hold true within the business domain.
They are enforced at the authoritative write boundary (owning context on the server).
Clients should enforce them locally where practical but may temporarily hold pending or conflicted states while offline.

> **Source:** Domain Specification §3

### 1.1 Identity Invariants

| ID         | Invariant                                                           | Formal Expression                                                                                                              |
| ---------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| INV-ID-001 | User email must be unique across all users                          | ∀ u1, u2 ∈ Users: u1.id ≠ u2.id → u1.email ≠ u2.email                                                                          |
| INV-ID-002 | A user can be a member of at most one household                     | ∀ u ∈ Users: \|{m ∈ HouseholdMembers : m.userId = u.id}\| ≤ 1                                                                  |
| INV-ID-003 | Every household must have at least one ADMIN member                 | ∀ h ∈ Households: \|{m ∈ h.members : m.role = ADMIN}\| ≥ 1                                                                     |
| INV-ID-004 | The household creator must be an ADMIN member                       | ∀ h ∈ Households: ∃ m ∈ h.members : m.userId = h.createdBy ∧ m.role = ADMIN                                                    |
| INV-ID-005 | User's currentHouseholdId must reference a household they belong to | ∀ u ∈ Users where u.currentHouseholdId ≠ null: ∃ m ∈ HouseholdMembers : m.userId = u.id ∧ m.householdId = u.currentHouseholdId |

### 1.2 Recipe Invariants

| ID         | Invariant                                           | Formal Expression                                                                                                    |
| ---------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| INV-RC-001 | Recipe must have at least one ingredient            | ∀ r ∈ Recipes: \|r.ingredients\| ≥ 1                                                                                 |
| INV-RC-002 | Recipe must have at least one step                  | ∀ r ∈ Recipes: \|r.steps\| ≥ 1                                                                                       |
| INV-RC-003 | Recipe servings must be positive                    | ∀ r ∈ Recipes: r.servings > 0.0                                                                                      |
| INV-RC-004 | Recipe effort level must be 1-5                     | ∀ r ∈ Recipes: 1 ≤ r.effortLevel ≤ 5                                                                                 |
| INV-RC-005 | Ingredient quantities must be positive              | ∀ r ∈ Recipes, i ∈ r.ingredients: i.quantity > 0                                                                     |
| INV-RC-006 | Step sort orders must be unique within recipe       | ∀ r ∈ Recipes: ∀ s1, s2 ∈ r.steps: s1.id ≠ s2.id → s1.sortOrder ≠ s2.sortOrder                                       |
| INV-RC-007 | Ingredient sort orders must be unique within recipe | ∀ r ∈ Recipes: ∀ i1, i2 ∈ r.ingredients: i1.id ≠ i2.id → i1.sortOrder ≠ i2.sortOrder                                 |
| INV-RC-008 | Active time cannot exceed total time                | ∀ r ∈ Recipes where r.activeTimeMinutes ≠ null ∧ r.totalTimeMinutes ≠ null: r.activeTimeMinutes ≤ r.totalTimeMinutes |
| INV-RC-009 | User recipe rating must be 1-5 if set               | ∀ m ∈ UserRecipeMetas where m.rating ≠ null: 1 ≤ m.rating ≤ 5                                                        |
| INV-RC-010 | Shared recipe must have householdId set             | ∀ r ∈ Recipes where r.householdId ≠ null: ∃ h ∈ Households : h.id = r.householdId                                    |
| INV-RC-011 | Substitute ingredient must exist in same recipe     | ∀ r ∈ Recipes, i ∈ r.ingredients where i.substituteFor ≠ null: ∃ i2 ∈ r.ingredients : i2.id = i.substituteFor        |
| INV-RC-012 | Only one user meta record per user+recipe           | ∀ m1, m2 ∈ UserRecipeMetas: (m1.userId = m2.userId ∧ m1.recipeId = m2.recipeId) → m1.id = m2.id                      |

### 1.3 Inventory Invariants

| ID          | Invariant                                                   | Formal Expression                                                                                                |
| ----------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| INV-INV-001 | Pantry item quantity must be non-negative                   | ∀ p ∈ PantryItems: p.quantity ≥ 0                                                                                |
| INV-INV-002 | Minimum quantity must be non-negative if set                | ∀ p ∈ PantryItems where p.minimumQuantity ≠ null: p.minimumQuantity ≥ 0                                          |
| INV-INV-003 | Expiration date must not be in distant past when created    | ∀ p ∈ PantryItems where p.expirationDate ≠ null: p.expirationDate ≥ p.createdAt - 30 days                        |
| INV-INV-004 | Portion ledger must not produce negative remaining portions | ∀ pm ∈ PreppedMeals: pm.originalPortions + Σ e.deltaPortions (for e where e.preppedMealId = pm.id) ≥ 0           |
| INV-INV-005 | Prepped meal portions must be non-negative                  | ∀ pm ∈ PreppedMeals: pm.portionsRemaining ≥ 0.0                                                                  |
| INV-INV-006 | Prepped meal must reference valid recipe                    | ∀ pm ∈ PreppedMeals: ∃ r ∈ Recipes : r.id = pm.recipeId                                                          |
| INV-INV-007 | Freezer items must be marked FROZEN                         | ∀ pm ∈ PreppedMeals: (pm.storageLocation = FREEZER ↔ pm.defrostState = FROZEN)                                   |
| INV-INV-008 | DEFROSTING items must be in FRIDGE with defrost start       | ∀ pm ∈ PreppedMeals where pm.defrostState = DEFROSTING: pm.storageLocation = FRIDGE ∧ pm.defrostStartedAt ≠ null |
| INV-INV-009 | Prepped meal expiration must be after preparation date      | ∀ pm ∈ PreppedMeals: pm.expirationDate > pm.preparedDate                                                         |
| INV-INV-010 | Portion event delta must be non-zero                        | ∀ e ∈ PortionEvents: e.deltaPortions ∈ ℤ ∧ e.deltaPortions ≠ 0                                                   |
| INV-INV-011 | Only ADJUSTED portion events may add portions               | ∀ e ∈ PortionEvents: (e.deltaPortions > 0) → (e.kind = ADJUSTED)                                                 |

### 1.4 Planning Invariants

| ID         | Invariant                                                      | Formal Expression                                                                                                         |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| INV-PL-001 | Meal plan end date must be on or after start date              | ∀ mp ∈ MealPlans: mp.endDate ≥ mp.startDate                                                                               |
| INV-PL-002 | Planned meal date must be within meal plan range               | ∀ mp ∈ MealPlans, pm ∈ mp.plannedMeals: mp.startDate ≤ pm.date ≤ mp.endDate                                               |
| INV-PL-003 | Planned meal must have exactly one source                      | (source = RECIPE ∧ recipeId ≠ null) ∨ (source = PREPPED ∧ preppedMealId ≠ null) ∨ (source = QUICK ∧ quickMealName ≠ null) |
| INV-PL-004 | Planned meal servings must be positive                         | ∀ pm ∈ PlannedMeals: pm.servings > 0.0                                                                                    |
| INV-PL-005 | Logged meals must have logged timestamp                        | ∀ pm ∈ PlannedMeals where pm.status = LOGGED: pm.loggedAt ≠ null                                                          |
| INV-PL-006 | Meal prep session must have at least one recipe                | ∀ mps ∈ MealPrepSessions: \|mps.recipes\| ≥ 1                                                                             |
| INV-PL-007 | Meal prep recipe servings must be positive                     | ∀ mps ∈ MealPrepSessions, r ∈ mps.recipes: r.servingsToPrep > 0.0                                                         |
| INV-PL-008 | Completed meal prep session must have completion timestamp     | ∀ mps ∈ MealPrepSessions where mps.status = COMPLETED: mps.completedAt ≠ null                                             |
| INV-PL-009 | Planning horizon must be positive                              | ∀ mps ∈ MealPrepSessions: mps.planningHorizonDays > 0                                                                     |
| INV-PL-010 | Meal reminder time must be valid                               | ∀ mr ∈ MealReminders: 00:00 ≤ mr.reminderTime ≤ 23:59                                                                     |
| INV-PL-011 | Enabled reminder must have at least one day selected           | ∀ mr ∈ MealReminders where mr.isEnabled = true: \|mr.daysOfWeek\| ≥ 1                                                     |
| INV-PL-012 | Enabled meal schedule rule must have at least one day selected | ∀ msr ∈ MealScheduleRules where msr.isEnabled = true: \|msr.daysOfWeek\| ≥ 1                                              |
| INV-PL-013 | Meal schedule rule must have exactly one source                | Same as INV-PL-003                                                                                                        |
| INV-PL-014 | Meal suggestion feedback must reference exactly one target     | Same source rules as INV-PL-003                                                                                           |

### 1.5 Shopping Invariants

| ID         | Invariant                                                | Formal Expression                                                                                                                                                                   |
| ---------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-SH-001 | Active shopping list must have at least one item         | ∀ sl ∈ ShoppingLists where sl.status = ACTIVE: \|sl.items\| ≥ 1                                                                                                                     |
| INV-SH-002 | Item quantity must be positive                           | ∀ sl ∈ ShoppingLists, i ∈ sl.items: i.quantity > 0                                                                                                                                  |
| INV-SH-003 | Checked items must have checked timestamp                | ∀ i ∈ ShoppingListItems where i.status = CHECKED: i.checkedAt ≠ null                                                                                                                |
| INV-SH-004 | Completed list must have completion timestamp            | ∀ sl ∈ ShoppingLists where sl.status = COMPLETED: sl.completedAt ≠ null                                                                                                             |
| INV-SH-005 | Store section sort orders must be unique within layout   | ∀ sl ∈ StoreLayouts: ∀ s1, s2 ∈ sl.sections: s1.id ≠ s2.id → s1.sortOrder ≠ s2.sortOrder                                                                                            |
| INV-SH-006 | Only one default store layout per user                   | ∀ u ∈ Users: \|{sl ∈ StoreLayouts : sl.userId = u.id ∧ sl.isDefault = true}\| ≤ 1                                                                                                   |
| INV-SH-007 | Assigned user must be household member if list is shared | ∀ sl ∈ ShoppingLists, i ∈ sl.items where sl.householdId ≠ null ∧ i.assignedToUserId ≠ null: ∃ m ∈ HouseholdMembers : m.householdId = sl.householdId ∧ m.userId = i.assignedToUserId |

### 1.6 Energy Invariants

| ID         | Invariant                                    | Formal Expression                                                                                                                            |
| ---------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-EN-001 | Energy level must be 1-5                     | ∀ el ∈ EnergyLogs: 1 ≤ el.energyLevel ≤ 5                                                                                                    |
| INV-EN-002 | Energy pattern average must be within range  | ∀ ep ∈ EnergyPatterns: 1.0 ≤ ep.averageEnergy ≤ 5.0                                                                                          |
| INV-EN-003 | Energy pattern confidence must be 0-1        | ∀ ep ∈ EnergyPatterns: 0.0 ≤ ep.confidence ≤ 1.0                                                                                             |
| INV-EN-004 | Energy pattern sample count must be positive | ∀ ep ∈ EnergyPatterns: ep.sampleCount > 0                                                                                                    |
| INV-EN-005 | One pattern per user per time slot per day   | ∀ ep1, ep2 ∈ EnergyPatterns where ep1.userId = ep2.userId: ep1.id ≠ ep2.id → (ep1.timeOfDay ≠ ep2.timeOfDay ∨ ep1.dayOfWeek ≠ ep2.dayOfWeek) |

### 1.7 Nutrition Invariants

| ID         | Invariant                               | Formal Expression                                                                                                                              |
| ---------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-NT-001 | Nutrition values must be non-negative   | ∀ n ∈ NutritionInfo: n.calories ≥ 0 ∧ n.proteinGrams ≥ 0 ∧ n.carbsGrams ≥ 0 ∧ n.fatGrams ≥ 0                                                   |
| INV-NT-002 | Nutrition goals must be positive if set | ∀ ng ∈ NutritionGoals: (ng.dailyCalories = null ∨ ng.dailyCalories > 0) ∧ ...                                                                  |
| INV-NT-003 | Goal effective period must be valid     | ∀ ng ∈ NutritionGoals where ng.effectiveTo ≠ null: ng.effectiveTo ≥ ng.effectiveFrom                                                           |
| INV-NT-004 | Only one active goal per user at a time | ∀ u ∈ Users, d ∈ Dates: \|{ng ∈ NutritionGoals : ng.userId = u.id ∧ ng.effectiveFrom ≤ d ∧ (ng.effectiveTo = null ∨ ng.effectiveTo ≥ d)}\| ≤ 1 |

### 1.8 Variety Invariants

| ID         | Invariant                                                   | Formal Expression                                                            |
| ---------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| INV-VR-001 | Food hyperfixation end date must be after start date if set | ∀ fh ∈ FoodHyperfixations where fh.endedAt ≠ null: fh.endedAt > fh.startedAt |
| INV-VR-002 | Active hyperfixation must not have end date                 | ∀ fh ∈ FoodHyperfixations where fh.isActive = true: fh.endedAt = null        |
| INV-VR-003 | Ended hyperfixation must not be active                      | ∀ fh ∈ FoodHyperfixations where fh.endedAt ≠ null: fh.isActive = false       |
| INV-VR-004 | Hyperfixation occurrence count must be positive             | ∀ fh ∈ FoodHyperfixations: fh.occurrenceCount > 0                            |
| INV-VR-005 | Chain suggestion must not suggest same food                 | ∀ cs ∈ ChainSuggestions: cs.currentFoodName ≠ cs.suggestedFoodName           |
| INV-VR-006 | Tried suggestions must have liked feedback                  | ∀ cs ∈ ChainSuggestions where cs.status = TRIED: cs.wasLiked ≠ null          |

### 1.9 Cross-Domain Invariants

| ID         | Invariant                                                   | Formal Expression                                                                                                                            |
| ---------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-XD-001 | Meal log from plan must reference valid planned meal        | ∀ ml ∈ MealLogs where ml.logType = FROM_PLAN: ml.plannedMealId ≠ null ∧ ∃ pm ∈ PlannedMeals : pm.id = ml.plannedMealId                       |
| INV-XD-002 | Meal log from prepped must reference valid prepped meal     | ∀ ml ∈ MealLogs where ml.logType = FROM_PREPPED: ml.preppedMealId ≠ null ∧ ∃ pm ∈ PreppedMeals : pm.id = ml.preppedMealId                    |
| INV-XD-003 | Consuming prepped meal decrements portions                  | When meal logged: preppedMeal.portionsRemaining -= mealLog.servings (enforced via domain event)                                              |
| INV-XD-004 | Shopping list from prep references valid session            | ∀ sl ∈ ShoppingLists where sl.sourceType = FROM_PREP: sl.mealPrepSessionId ≠ null ∧ ∃ mps ∈ MealPrepSessions : mps.id = sl.mealPrepSessionId |
| INV-XD-005 | Planned meal from prepped must reference meal with portions | ∀ pm ∈ PlannedMeals where pm.source = PREPPED: ∃ prm ∈ PreppedMeals : prm.id = pm.preppedMealId ∧ prm.portionsRemaining > 0.0                |
| INV-XD-006 | Household resources accessible only to members              | Enforced via authorization, not structural invariant                                                                                         |

---

## 2. Aggregate & Consistency Invariants

These invariants define consistency boundaries within domain-driven design aggregates.

### 2.1 Bounded Context Ownership

| ID          | Invariant                       | Description                                                                                                                                 |
| ----------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-AGG-001 | Single owner per aggregate      | Every aggregate/entity has exactly one owning context (system of record). Only the owning context may enforce invariants and accept writes. |
| INV-AGG-002 | Cross-context writes prohibited | Cross-context reads are allowed via references and projections; cross-context writes are not.                                               |
| INV-AGG-003 | Foreign references immutable    | Foreign IDs stored in other contexts (e.g., `RecipeId` in `PreppedMeal`) are immutable after creation.                                      |

### 2.2 Context Ownership Matrix

| Context   | Owns (Authoritative Write Models)                                                       |
| --------- | --------------------------------------------------------------------------------------- |
| Identity  | `User`, `Household`, `HouseholdMember`, `UserPreferences`, `DietaryProfile`             |
| Recipes   | `Recipe`, `RecipeStep`, `RecipeIngredient`, `Ingredient`, `RecipeTag`, `UserRecipeMeta` |
| Inventory | `PantryItem`, `PreppedMeal`, `PortionEvent`, `StorageLocation`                          |
| Planning  | `MealPlan`, `PlannedMeal`, `MealPrepSession`, `MealReminder`, `MealLog`                 |
| Shopping  | `ShoppingList`, `ShoppingListItem`, `StoreLayout`, `StoreSection`                       |
| Nutrition | `NutritionGoal` (write), `DailyNutritionSummary` (projection)                           |
| Energy    | `EnergyLog` (write), `EnergyPattern` (projection)                                       |
| Variety   | `FoodProfile`, `FoodHyperfixation`, `ChainSuggestion`, `VariationIdea`                  |

### 2.3 Transaction Boundaries

| ID          | Invariant                          | Description                                                                                                   |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| INV-AGG-004 | Within-context strong consistency  | Within a context, strong consistency (transactions) for its own aggregates and invariants.                    |
| INV-AGG-005 | Cross-context eventual consistency | Across contexts, eventual consistency via events or explicit application-layer orchestration.                 |
| INV-AGG-006 | Aggregate root transactions        | All modifications to entities within an aggregate must go through the aggregate root in a single transaction. |

---

## 3. Sync & Offline Invariants

These invariants govern the offline-first sync system behavior.

### 3.1 Data Flow Invariants

| ID           | Invariant              | Description                                                                                                                   |
| ------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| INV-SYNC-001 | Server is canonical    | The server database is canonical for shared household data; clients maintain local replicas as a working set.                 |
| INV-SYNC-002 | At-least-once delivery | Event delivery is at-least-once; handlers must be idempotent and tolerate reordering.                                         |
| INV-SYNC-003 | Change idempotency     | Every `Change` must include a stable `changeId` (unique per client); the server must be idempotent on `(clientId, changeId)`. |
| INV-SYNC-004 | Optimistic concurrency | PATCH operations must include `base.version`; server rejects if current version differs (VERSION_MISMATCH).                   |

### 3.2 Conflict Resolution Invariants

| ID           | Invariant                     | Conflict Strategy                                            |
| ------------ | ----------------------------- | ------------------------------------------------------------ |
| INV-SYNC-005 | User/Preferences conflicts    | Last-write-wins (personal, single-user most of the time)     |
| INV-SYNC-006 | Recipe conflicts              | LWW (personal) / Merge (household)                           |
| INV-SYNC-007 | PantryItem conflicts          | Merge quantities; LWW for other fields                       |
| INV-SYNC-008 | PreppedMeal portion conflicts | Append-only PortionEvent ledger (never LWW on portions)      |
| INV-SYNC-009 | MealPlan conflicts            | Merge by `(date, mealSlot)` (slotKey)                        |
| INV-SYNC-010 | PlannedMeal slot conflicts    | LWW for a slot; preserve loser as "unscheduled" for recovery |
| INV-SYNC-011 | ShoppingList conflicts        | Merge items at item level                                    |
| INV-SYNC-012 | ShoppingListItem conflicts    | LWW / status-driven; most recent toggle wins                 |
| INV-SYNC-013 | MealLog conflicts             | Append-only (logs should not conflict)                       |
| INV-SYNC-014 | EnergyLog conflicts           | Append-only (logs should not conflict)                       |

### 3.3 Projection Invariants

| ID           | Invariant                   | Description                                                                                                          |
| ------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| INV-SYNC-015 | Projections idempotent      | All projections must be idempotent (safe to apply twice).                                                            |
| INV-SYNC-016 | Projections rebuildable     | All projections must be rebuildable from source-of-truth data.                                                       |
| INV-SYNC-017 | Snapshots non-authoritative | Denormalized snapshot fields (e.g., `recipeName` in `PreppedMeal`) are non-authoritative and may be stale.           |
| INV-SYNC-018 | Projections respect opt-in  | Feature-gated projections (e.g., `DailyNutritionSummary`) must respect the opt-in flag (`nutritionTracking = true`). |

### 3.4 Slot Key Invariants (Meal Planning)

| ID           | Invariant                  | Description                                                                                                          |
| ------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| INV-SYNC-019 | Canonical slotKey format   | `slotKey` = `YYYY-MM-DD:<MEAL_SLOT>` (e.g., `2026-01-10:BREAKFAST`)                                                  |
| INV-SYNC-020 | SlotKey deterministic      | `slotKey` must be deterministic for a given `(date, mealSlot)`.                                                      |
| INV-SYNC-021 | One active meal per slot   | At most one active (`status=PLANNED`) `PlannedMeal` per `(mealPlanId, date, mealSlot)` for all slots except `OTHER`. |
| INV-SYNC-022 | OTHER slot allows multiple | `OTHER` may contain multiple items per day, ordered by `PlannedMeal.sortOrder`.                                      |

---

## 4. Data Integrity Invariants

These invariants govern database-level constraints and data consistency.

### 4.1 Schema Conventions

| ID         | Invariant                   | Description                                                                            |
| ---------- | --------------------------- | -------------------------------------------------------------------------------------- |
| INV-DB-001 | Primary keys are UUIDs      | `id TEXT PRIMARY KEY` — UUIDs for sync compatibility; no auto-increment.               |
| INV-DB-002 | Timestamps are UTC epoch    | Timestamps stored as `BIGINT` (UTC epoch milliseconds) for cross-platform consistency. |
| INV-DB-003 | Soft deletes required       | Use `deleted_at` for soft deletes; sync requires tombstones.                           |
| INV-DB-004 | No secrets in synced tables | Password hashes, tokens, and sensitive data stay server-only (not synced to clients).  |
| INV-DB-005 | IDs are opaque              | Never encode meaning into IDs; treat as opaque strings.                                |

### 4.2 Referential Integrity

| ID         | Invariant                    | Description                                                                                 |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| INV-DB-006 | Foreign keys validated       | All foreign key references must point to existing records (enforced at write time).         |
| INV-DB-007 | Cascading deletes controlled | Soft-delete cascades follow domain rules; hard deletes cascade via foreign key constraints. |
| INV-DB-008 | Orphaned records prohibited  | No orphaned child records (e.g., `RecipeIngredient` without `Recipe`).                      |

### 4.3 Migration Invariants

| ID         | Invariant                       | Description                                                                                                                                |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| INV-DB-009 | Expand-migrate-contract pattern | Schema changes must follow: (1) Expand (add nullable/default), (2) Migrate (backfill + deploy new code), (3) Contract (remove old column). |
| INV-DB-010 | Backward-compatible migrations  | Older clients must continue working during rollout.                                                                                        |
| INV-DB-011 | Single schema source of truth   | PostgreSQL schema via Flyway is the canonical schema source.                                                                               |

---

## 5. API Contract Invariants

These invariants govern the guarantees made by the API layer.

### 5.1 Request/Response Invariants

| ID          | Invariant                            | Description                                                                              |
| ----------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| INV-API-001 | All endpoints require authentication | Except: `/api/auth/register`, `/api/auth/login`, `/api/health/*`                         |
| INV-API-002 | All endpoints validate authorization | Resource access validated against user's household membership and role.                  |
| INV-API-003 | Validation before processing         | Request validation occurs before any business logic or data access.                      |
| INV-API-004 | Consistent error format              | All errors return structured format: `{ error: string, code: string, details?: object }` |

### 5.2 Versioning Invariants

| ID          | Invariant                     | Description                                                                    |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------ |
| INV-API-005 | Schema versioning             | Every envelope has `schemaVersion` (integer).                                  |
| INV-API-006 | Backward-compatible additions | Additions must be optional fields; breaking changes increment `schemaVersion`. |
| INV-API-007 | OpenAPI as contract           | API contracts defined in OpenAPI spec; TypeScript types generated from spec.   |

### 5.3 Sync API Invariants

| ID          | Invariant                   | Description                                                                          |
| ----------- | --------------------------- | ------------------------------------------------------------------------------------ |
| INV-API-008 | Sync endpoint idempotency   | Sync endpoints must be idempotent based on `(clientId, changeId)`.                   |
| INV-API-009 | Conflict response structure | Conflicts return: `{ changeId, conflictType, serverValue, clientValue, resolution }` |
| INV-API-010 | Sync cursor monotonic       | `syncCursor` is monotonically increasing; clients must not rewind.                   |

### 5.4 Rate Limiting Invariants

| ID          | Invariant                   | Description                                                                         |
| ----------- | --------------------------- | ----------------------------------------------------------------------------------- |
| INV-API-011 | Auth endpoint rate limiting | Auth endpoints (`/register`, `/login`) must be rate-limited to prevent brute force. |
| INV-API-012 | Rate limit headers          | Rate-limited responses must include `X-RateLimit-*` headers.                        |

---

## 6. Security Invariants

These invariants govern security requirements across the system.

### 6.1 Authentication Invariants

| ID          | Invariant               | Description                                                                         |
| ----------- | ----------------------- | ----------------------------------------------------------------------------------- |
| INV-SEC-001 | Secure password hashing | Passwords hashed using Argon2id (preferred) or bcrypt.                              |
| INV-SEC-002 | Token-based auth        | JWT tokens for API access; short-lived access (~15 min) + longer refresh (~7 days). |
| INV-SEC-003 | Refresh token rotation  | Refresh tokens rotated on use; old tokens invalidated.                              |
| INV-SEC-004 | Session isolation       | Sessions are per-device; revoking one device does not affect others.                |

### 6.2 Authorization Invariants

| ID          | Invariant                       | Description                                                                         |
| ----------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| INV-SEC-005 | Row-level access control        | Users access own data + household data based on membership.                         |
| INV-SEC-006 | Role-based household access     | Household roles: ADMIN (full), MEMBER (read/write), VIEWER (read-only).             |
| INV-SEC-007 | Sync rules are not security     | Sync rules are convenience; server validates all writes against actual permissions. |
| INV-SEC-008 | Authorization checked at server | Invariants enforced at server write boundary, not client.                           |

### 6.3 Data Protection Invariants

| ID          | Invariant                | Description                                                                         |
| ----------- | ------------------------ | ----------------------------------------------------------------------------------- |
| INV-SEC-009 | TLS required             | All data in transit encrypted via TLS 1.2+.                                         |
| INV-SEC-010 | Token storage secure     | Mobile clients store tokens in platform keychain (Keystore/Keychain).               |
| INV-SEC-011 | No PII in logs           | Logs must never contain passwords, tokens, emails, or full request bodies with PII. |
| INV-SEC-012 | SQL injection prevention | All database queries use parameterized statements.                                  |
| INV-SEC-013 | XSS prevention           | All user-generated content sanitized before rendering.                              |

---

## 7. Privacy & Data Ownership Invariants

These invariants ensure user control over their data.

### 7.1 Data Ownership

| ID          | Invariant                         | Description                                                     |
| ----------- | --------------------------------- | --------------------------------------------------------------- |
| INV-PRI-001 | Self-hostable                     | System fully self-hostable; users have complete data ownership. |
| INV-PRI-002 | No external dependencies for core | Core functionality works without external cloud services.       |
| INV-PRI-003 | Data exportable                   | All user data exportable in standard formats (JSON, CSV).       |
| INV-PRI-004 | Full deletion supported           | Users can delete account and all associated data permanently.   |

### 7.2 AI & External Service Privacy

| ID          | Invariant                | Description                                                             |
| ----------- | ------------------------ | ----------------------------------------------------------------------- |
| INV-PRI-005 | Local AI by default      | AI features support local model execution for privacy.                  |
| INV-PRI-006 | Cloud AI requires opt-in | Cloud AI providers require explicit user consent.                       |
| INV-PRI-007 | No credentials to AI     | Never send credentials, tokens, or emails to AI providers.              |
| INV-PRI-008 | PII redaction            | Personally identifiable information redacted before external API calls. |
| INV-PRI-009 | AI output untrusted      | AI output treated as untrusted input; validate before persisting.       |

### 7.3 Telemetry & Analytics

| ID          | Invariant                    | Description                                                   |
| ----------- | ---------------------------- | ------------------------------------------------------------- |
| INV-PRI-010 | No telemetry without consent | No usage telemetry without explicit opt-in.                   |
| INV-PRI-011 | Analytics data anonymized    | If analytics enabled, data must be anonymized and aggregated. |

---

## 8. Performance Invariants

These invariants define performance guarantees.

### 8.1 Responsiveness

| ID           | Invariant                    | Target      | Conditions                           |
| ------------ | ---------------------------- | ----------- | ------------------------------------ |
| INV-PERF-001 | Startup time                 | < 3 seconds | Baseline hardware (4 CPU, 4GB RAM)   |
| INV-PERF-002 | Screen transitions           | < 300ms     | Normal conditions                    |
| INV-PERF-003 | Keyword search               | < 500ms     | Local data                           |
| INV-PERF-004 | Semantic search              | < 750ms     | Local index ready, baseline hardware |
| INV-PERF-005 | Background sync non-blocking | —           | App remains responsive during sync   |

### 8.2 Scalability

| ID           | Invariant       | Description                                                           |
| ------------ | --------------- | --------------------------------------------------------------------- |
| INV-PERF-006 | Recipe capacity | Local database handles 10,000+ recipes efficiently.                   |
| INV-PERF-007 | Household scale | Server supports multiple households at hobby scale (2 vCPU, 4GB RAM). |

---

## 9. Cross-Cutting Invariants

These invariants apply across the entire system.

### 9.1 Event System

| ID          | Invariant                  | Description                                                                                    |
| ----------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| INV-EVT-001 | Event envelope required    | All events wrapped in envelope: `{ eventId, eventType, occurredAt, producerContext, payload }` |
| INV-EVT-002 | Events idempotent handlers | Event handlers must be idempotent and tolerate reordering.                                     |
| INV-EVT-003 | Transactional outbox       | Events published via transactional outbox pattern (write event + data atomically).             |

### 9.2 Time Zone Handling

| ID         | Invariant                           | Description                                                                                               |
| ---------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| INV-TZ-001 | Timestamps in UTC                   | All `Timestamp` values stored/transported in UTC.                                                         |
| INV-TZ-002 | Display in user timezone            | Timestamps displayed in user's configured timezone.                                                       |
| INV-TZ-003 | Planning dates in resolved timezone | Planning dates interpreted in: `Household.timeZone` (collaborative) or `UserPreferences.timeZone` (solo). |

### 9.3 Feature Toggles

| ID         | Invariant                   | Description                                                                                      |
| ---------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| INV-FT-001 | Passive features default ON | Passive features (energy filtering, expiration awareness) default ON, individually toggleable.   |
| INV-FT-002 | Active tracking default OFF | Active tracking (energy logging, nutrition tracking, variety tracking) default OFF, opt-in only. |
| INV-FT-003 | Feature-gated data isolated | Data for disabled features not collected or processed.                                           |

### 9.4 Accessibility

| ID           | Invariant                | Description                                                   |
| ------------ | ------------------------ | ------------------------------------------------------------- |
| INV-A11Y-001 | Minimum touch targets    | Interactive elements: 44pt minimum (66-96pt in kitchen mode). |
| INV-A11Y-002 | Color not sole indicator | Color never the only indicator of state or meaning.           |
| INV-A11Y-003 | Screen reader support    | Primary flows accessible via screen readers.                  |

### 9.5 Error Handling

| ID          | Invariant            | Description                                                |
| ----------- | -------------------- | ---------------------------------------------------------- |
| INV-ERR-001 | Graceful degradation | Features degrade gracefully when dependencies unavailable. |
| INV-ERR-002 | User-friendly errors | Error messages use plain language, never stack traces.     |
| INV-ERR-003 | Recoverable states   | System recovers from transient errors without data loss.   |

---

## Appendix A: Invariant Testing Checklist

Every invariant should have at least one corresponding test. Use this checklist during code review:

### Domain Invariants

- [ ] Unit tests for each INV-ID-_, INV-RC-_, INV-INV-_, INV-PL-_, INV-SH-_, INV-EN-_, INV-NT-_, INV-VR-_ invariant
- [ ] Property-based tests for range constraints (ratings, levels, percentages)

### Sync Invariants

- [ ] Integration tests for conflict resolution scenarios
- [ ] End-to-end tests for offline → sync → conflict flows

### API Invariants

- [ ] Route tests for auth requirements
- [ ] Route tests for authorization (household scoping)
- [ ] Validation tests for request schemas

### Security Invariants

- [ ] Penetration test checklist items
- [ ] Password hashing verification
- [ ] Token expiration tests

---

## Appendix B: Invariant Violation Handling

When an invariant is violated:

1. **Server-side violations**: Reject the operation with a structured error response.
2. **Client-side violations (offline)**: Queue the change but flag for conflict resolution on sync.
3. **Projection violations**: Log warning, rebuild projection, do not block core flows.
4. **Data corruption**: Log error with context, alert operators, preserve original data.

---

| Version | Date       | Author    | Description                               |
| ------- | ---------- | --------- | ----------------------------------------- |
| v1.0.0  | 2026-01-10 | Generated | Initial comprehensive invariants document |

---

_End of Project Invariants Document_
