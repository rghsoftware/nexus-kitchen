# Nexus Kitchen — Project Invariants

**Document Version:** 1.0  
**Date:** June 4, 2026  
**Purpose:** Developer reference for system invariants across the domain, data, security, and operational layers.

> **Document relationship:**  
> This document consolidates and extends the invariants in the [Domain Specification](./domain-specification.md) §3.  
> Domain invariants (INV-*) are authoritative in the Domain Specification; this document adds data, security, and operational invariants.

---

## Table of Contents

1. [Domain/Business Invariants](#1-domainbusiness-invariants)
2. [Consistency & Module Boundaries](#2-consistency--module-boundaries)
3. [Concurrency Model (Online / Realtime)](#3-concurrency-model-online--realtime)
4. [Data Integrity Invariants](#4-data-integrity-invariants)
5. [Data Access & API Invariants](#5-data-access--api-invariants)
6. [Security Invariants](#6-security-invariants)
7. [Privacy & Data Ownership Invariants](#7-privacy--data-ownership-invariants)
8. [Performance Invariants](#8-performance-invariants)
9. [Cross-Cutting Invariants](#9-cross-cutting-invariants)

---

## 1. Domain/Business Invariants

These invariants define the rules that must always hold true within the business domain. They are enforced at the authoritative write boundary (owning context on the server). Clients should enforce them locally where practical but may temporarily hold pending or conflicted states while offline.

> **Source:** Domain Specification §3

### 1.1 Identity Invariants

| ID | Invariant | Formal Expression |
|----|-----------|-------------------|
| INV-ID-001 | User email must be unique across all users | ∀ u1, u2 ∈ Users: u1.id ≠ u2.id → u1.email ≠ u2.email |
| INV-ID-002 | A user can be a member of at most one household | ∀ u ∈ Users: \|{m ∈ HouseholdMembers : m.userId = u.id}\| ≤ 1 |
| INV-ID-003 | Every household must have at least one ADMIN member | ∀ h ∈ Households: \|{m ∈ h.members : m.role = ADMIN}\| ≥ 1 |
| INV-ID-004 | The household creator must be an ADMIN member | ∀ h ∈ Households: ∃ m ∈ h.members : m.userId = h.createdBy ∧ m.role = ADMIN |
| INV-ID-005 | User's currentHouseholdId must reference a household they belong to | ∀ u ∈ Users where u.currentHouseholdId ≠ null: ∃ m ∈ HouseholdMembers : m.userId = u.id ∧ m.householdId = u.currentHouseholdId |

### 1.2 Recipe Invariants

| ID | Invariant | Formal Expression |
|----|-----------|-------------------|
| INV-RC-001 | Recipe must have at least one ingredient | ∀ r ∈ Recipes: \|r.ingredients\| ≥ 1 |
| INV-RC-002 | Recipe must have at least one step | ∀ r ∈ Recipes: \|r.steps\| ≥ 1 |
| INV-RC-003 | Recipe servings must be positive | ∀ r ∈ Recipes: r.servings > 0.0 |
| INV-RC-004 | Recipe effort level must be 1-5 | ∀ r ∈ Recipes: 1 ≤ r.effortLevel ≤ 5 |
| INV-RC-005 | Ingredient quantities must be positive | ∀ r ∈ Recipes, i ∈ r.ingredients: i.quantity > 0 |
| INV-RC-006 | Step sort orders must be unique within recipe | ∀ r ∈ Recipes: ∀ s1, s2 ∈ r.steps: s1.id ≠ s2.id → s1.sortOrder ≠ s2.sortOrder |
| INV-RC-007 | Ingredient sort orders must be unique within recipe | ∀ r ∈ Recipes: ∀ i1, i2 ∈ r.ingredients: i1.id ≠ i2.id → i1.sortOrder ≠ i2.sortOrder |
| INV-RC-008 | Active time cannot exceed total time | ∀ r ∈ Recipes where r.activeTimeMinutes ≠ null ∧ r.totalTimeMinutes ≠ null: r.activeTimeMinutes ≤ r.totalTimeMinutes |
| INV-RC-009 | User recipe rating must be 1-5 if set | ∀ m ∈ UserRecipeMetas where m.rating ≠ null: 1 ≤ m.rating ≤ 5 |
| INV-RC-010 | Shared recipe must have householdId set | ∀ r ∈ Recipes where r.householdId ≠ null: ∃ h ∈ Households : h.id = r.householdId |
| INV-RC-011 | Substitute ingredient must exist in same recipe | ∀ r ∈ Recipes, i ∈ r.ingredients where i.substituteFor ≠ null: ∃ i2 ∈ r.ingredients : i2.id = i.substituteFor |
| INV-RC-012 | Only one user meta record per user+recipe | ∀ m1, m2 ∈ UserRecipeMetas: (m1.userId = m2.userId ∧ m1.recipeId = m2.recipeId) → m1.id = m2.id |

### 1.3 Inventory Invariants

| ID | Invariant | Formal Expression |
|----|-----------|-------------------|
| INV-INV-001 | Pantry item quantity must be non-negative | ∀ p ∈ PantryItems: p.quantity ≥ 0 |
| INV-INV-002 | Minimum quantity must be non-negative if set | ∀ p ∈ PantryItems where p.minimumQuantity ≠ null: p.minimumQuantity ≥ 0 |
| INV-INV-003 | Expiration date must not be in distant past when created | ∀ p ∈ PantryItems where p.expirationDate ≠ null: p.expirationDate ≥ p.createdAt - 30 days |
| INV-INV-004 | Portion ledger must not produce negative remaining portions | ∀ pm ∈ PreppedMeals: pm.originalPortions + Σ e.deltaPortions (for e where e.preppedMealId = pm.id) ≥ 0 |
| INV-INV-005 | Prepped meal portions must be non-negative | ∀ pm ∈ PreppedMeals: pm.portionsRemaining ≥ 0.0 |
| INV-INV-006 | Prepped meal must reference valid recipe | ∀ pm ∈ PreppedMeals: ∃ r ∈ Recipes : r.id = pm.recipeId |
| INV-INV-007 | Freezer items must be marked FROZEN | ∀ pm ∈ PreppedMeals: (pm.storageLocation = FREEZER ↔ pm.defrostState = FROZEN) |
| INV-INV-008 | DEFROSTING items must be in FRIDGE with defrost start | ∀ pm ∈ PreppedMeals where pm.defrostState = DEFROSTING: pm.storageLocation = FRIDGE ∧ pm.defrostStartedAt ≠ null |
| INV-INV-009 | Prepped meal expiration must be after preparation date | ∀ pm ∈ PreppedMeals: pm.expirationDate > pm.preparedDate |
| INV-INV-010 | Portion event delta must be non-zero | ∀ e ∈ PortionEvents: e.deltaPortions ∈ ℤ ∧ e.deltaPortions ≠ 0 |
| INV-INV-011 | Only ADJUSTED portion events may add portions | ∀ e ∈ PortionEvents: (e.deltaPortions > 0) → (e.kind = ADJUSTED) |

### 1.4 Planning Invariants

| ID | Invariant | Formal Expression |
|----|-----------|-------------------|
| INV-PL-001 | Meal plan end date must be on or after start date | ∀ mp ∈ MealPlans: mp.endDate ≥ mp.startDate |
| INV-PL-002 | Planned meal date must be within meal plan range | ∀ mp ∈ MealPlans, pm ∈ mp.plannedMeals: mp.startDate ≤ pm.date ≤ mp.endDate |
| INV-PL-003 | Planned meal must have exactly one source | (source = RECIPE ∧ recipeId ≠ null) ∨ (source = PREPPED ∧ preppedMealId ≠ null) ∨ (source = QUICK ∧ quickMealName ≠ null) |
| INV-PL-004 | Planned meal servings must be positive | ∀ pm ∈ PlannedMeals: pm.servings > 0.0 |
| INV-PL-005 | Logged meals must have logged timestamp | ∀ pm ∈ PlannedMeals where pm.status = LOGGED: pm.loggedAt ≠ null |
| INV-PL-006 | Meal prep session must have at least one recipe | ∀ mps ∈ MealPrepSessions: \|mps.recipes\| ≥ 1 |
| INV-PL-007 | Meal prep recipe servings must be positive | ∀ mps ∈ MealPrepSessions, r ∈ mps.recipes: r.servingsToPrep > 0.0 |
| INV-PL-008 | Completed meal prep session must have completion timestamp | ∀ mps ∈ MealPrepSessions where mps.status = COMPLETED: mps.completedAt ≠ null |
| INV-PL-009 | Planning horizon must be positive | ∀ mps ∈ MealPrepSessions: mps.planningHorizonDays > 0 |
| INV-PL-010 | Meal reminder time must be valid | ∀ mr ∈ MealReminders: 00:00 ≤ mr.reminderTime ≤ 23:59 |
| INV-PL-011 | Enabled reminder must have at least one day selected | ∀ mr ∈ MealReminders where mr.isEnabled = true: \|mr.daysOfWeek\| ≥ 1 |

| INV-PL-012 | Planned meal sort order unique within a (date, slot) group | ∀ pm1, pm2 in the same (date, mealSlot) where pm1.id ≠ pm2.id: pm1.sortOrder ≠ pm2.sortOrder. Unslotted (mealSlot = null) meals form their own per-date group; a group may hold any number of meals. |
| INV-PL-013 | Meal schedule rule must have exactly one source | (source = RECIPE ∧ recipeId ≠ null ∧ quickMealName = null) ∨ (source = QUICK ∧ quickMealName ≠ null ∧ recipeId = null) |
| INV-PL-014 | Enabled meal schedule rule must have at least one day selected | ∀ msr ∈ MealScheduleRules where msr.isEnabled = true: \|msr.daysOfWeek\| ≥ 1 |
| INV-PL-015 | Meal schedule rule effective range valid | effectiveTo ≥ effectiveFrom when both set |
| INV-PL-016 | Meal suggestion feedback must reference exactly one target | exactly one of recipeId / preppedMealId / quickMealName set, matching target |

> **Note:** Planning invariants are defined authoritatively in Domain Specification §3.4.

### 1.5 Shopping Invariants

| ID | Invariant | Formal Expression |
|----|-----------|-------------------|
| INV-SH-001 | Active shopping list must have at least one item | ∀ sl ∈ ShoppingLists where sl.status = ACTIVE: \|sl.items\| ≥ 1 |
| INV-SH-002 | Item quantity must be positive | ∀ sl ∈ ShoppingLists, i ∈ sl.items: i.quantity > 0 |
| INV-SH-003 | Checked items must have checked timestamp | ∀ i ∈ ShoppingListItems where i.status = CHECKED: i.checkedAt ≠ null |
| INV-SH-004 | Completed list must have completion timestamp | ∀ sl ∈ ShoppingLists where sl.status = COMPLETED: sl.completedAt ≠ null |
| INV-SH-005 | Store section sort orders must be unique within layout | ∀ sl ∈ StoreLayouts: ∀ s1, s2 ∈ sl.sections: s1.id ≠ s2.id → s1.sortOrder ≠ s2.sortOrder |
| INV-SH-006 | Only one default store layout per user | ∀ u ∈ Users: \|{sl ∈ StoreLayouts : sl.userId = u.id ∧ sl.isDefault = true}\| ≤ 1 |
| INV-SH-007 | Assigned user must be household member if list is shared | ∀ sl ∈ ShoppingLists, i ∈ sl.items where sl.householdId ≠ null ∧ i.assignedToUserId ≠ null: ∃ m ∈ HouseholdMembers : m.householdId = sl.householdId ∧ m.userId = i.assignedToUserId |

### 1.6 Energy Invariants

| ID | Invariant | Formal Expression |
|----|-----------|-------------------|
| INV-EN-001 | Energy level must be 1-5 | ∀ el ∈ EnergyLogs: 1 ≤ el.energyLevel ≤ 5 |
| INV-EN-002 | Energy pattern average must be within range | ∀ ep ∈ EnergyPatterns: 1.0 ≤ ep.averageEnergy ≤ 5.0 |
| INV-EN-003 | Energy pattern confidence must be 0-1 | ∀ ep ∈ EnergyPatterns: 0.0 ≤ ep.confidence ≤ 1.0 |
| INV-EN-004 | Energy pattern sample count must be positive | ∀ ep ∈ EnergyPatterns: ep.sampleCount > 0 |
| INV-EN-005 | One pattern per user per time slot per day | ∀ ep1, ep2 ∈ EnergyPatterns where ep1.userId = ep2.userId: ep1.id ≠ ep2.id → (ep1.timeOfDay ≠ ep2.timeOfDay ∨ ep1.dayOfWeek ≠ ep2.dayOfWeek) |

### 1.7 Nutrition Invariants

| ID | Invariant | Formal Expression |
|----|-----------|-------------------|
| INV-NT-001 | Nutrition values must be non-negative | ∀ n ∈ NutritionInfo: n.calories ≥ 0 ∧ n.proteinGrams ≥ 0 ∧ n.carbsGrams ≥ 0 ∧ n.fatGrams ≥ 0 |
| INV-NT-002 | Nutrition goals must be positive if set | ∀ ng ∈ NutritionGoals: (ng.dailyCalories = null ∨ ng.dailyCalories > 0) ∧ ... |
| INV-NT-003 | Goal effective period must be valid | ∀ ng ∈ NutritionGoals where ng.effectiveTo ≠ null: ng.effectiveTo ≥ ng.effectiveFrom |
| INV-NT-004 | Only one active goal per user at a time | ∀ u ∈ Users, d ∈ Dates: \|{ng ∈ NutritionGoals : ng.userId = u.id ∧ ng.effectiveFrom ≤ d ∧ (ng.effectiveTo = null ∨ ng.effectiveTo ≥ d)}\| ≤ 1 |

### 1.8 Variety Invariants

| ID | Invariant | Formal Expression |
|----|-----------|-------------------|
| INV-VR-001 | Food hyperfixation end date must be after start date if set | ∀ fh ∈ FoodHyperfixations where fh.endedAt ≠ null: fh.endedAt > fh.startedAt |
| INV-VR-002 | Active hyperfixation must not have end date | ∀ fh ∈ FoodHyperfixations where fh.isActive = true: fh.endedAt = null |
| INV-VR-003 | Ended hyperfixation must not be active | ∀ fh ∈ FoodHyperfixations where fh.endedAt ≠ null: fh.isActive = false |
| INV-VR-004 | Hyperfixation occurrence count must be positive | ∀ fh ∈ FoodHyperfixations: fh.occurrenceCount > 0 |
| INV-VR-005 | Chain suggestion must not suggest same food | ∀ cs ∈ ChainSuggestions: cs.currentFoodName ≠ cs.suggestedFoodName |
| INV-VR-006 | Tried suggestions must have liked feedback | ∀ cs ∈ ChainSuggestions where cs.status = TRIED: cs.wasLiked ≠ null |

### 1.9 Cross-Domain Invariants

| ID | Invariant | Formal Expression |
|----|-----------|-------------------|
| INV-XD-001 | Meal log from plan must reference valid planned meal | ∀ ml ∈ MealLogs where ml.logType = FROM_PLAN: ml.plannedMealId ≠ null ∧ ∃ pm ∈ PlannedMeals : pm.id = ml.plannedMealId |
| INV-XD-002 | Meal log from prepped must reference valid prepped meal | ∀ ml ∈ MealLogs where ml.logType = FROM_PREPPED: ml.preppedMealId ≠ null ∧ ∃ pm ∈ PreppedMeals : pm.id = ml.preppedMealId |
| INV-XD-003 | Consuming prepped meal decrements portions | When meal logged: preppedMeal.portionsRemaining -= mealLog.servings (enforced via domain event) |
| INV-XD-004 | Shopping list from prep references valid session | ∀ sl ∈ ShoppingLists where sl.sourceType = FROM_PREP: sl.mealPrepSessionId ≠ null ∧ ∃ mps ∈ MealPrepSessions : mps.id = sl.mealPrepSessionId |
| INV-XD-005 | Planned meal from prepped must reference meal with portions | ∀ pm ∈ PlannedMeals where pm.source = PREPPED: ∃ prm ∈ PreppedMeals : prm.id = pm.preppedMealId ∧ prm.portionsRemaining > 0.0 |
| INV-XD-006 | Household resources accessible only to members | Enforced via authorization, not structural invariant |

---

## 2. Consistency & Module Boundaries

These invariants define consistency boundaries within a single PostgreSQL database. Bounded contexts are **logical modules** (schema / table groups + client modules), not separately-deployed services.

### 2.1 Module Ownership

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-MOD-001 | Single owning module per aggregate | Each aggregate has exactly one owning module responsible for its writes and invariants. Other modules read via references/views. |
| INV-MOD-002 | Writes through the owning module | A module mutates only the tables it owns; cross-module writes are avoided. |
| INV-MOD-003 | Foreign references immutable | Foreign IDs stored in other modules (e.g., `recipeId` in `PreppedMeal`) are immutable after creation. |

### 2.2 Module Ownership Matrix

| Module | Owns (authoritative write models) |
|--------|-----------------------------------|
| Identity | `User`, `Household`, `HouseholdMember`, `UserPreferences`, `DietaryProfile` |
| Recipes | `Recipe`, `RecipeStep`, `RecipeIngredient`, `Ingredient`, `RecipeTag`, `UserRecipeMeta` |
| Inventory | `PantryItem`, `PreppedMeal`, `PortionEvent`, `StorageLocation` |
| Planning | `MealPlan`, `PlannedMeal`, `MealPrepSession`, `MealReminder`, `MealLog`, `MealScheduleRule`, `MealSuggestionFeedback` |
| Shopping | `ShoppingList`, `ShoppingListItem`, `StoreLayout`, `StoreSection` |
| Nutrition | `NutritionGoal` (write), `DailyNutritionSummary` (projection) |
| Energy | `EnergyLog` (write), `EnergyPattern` (projection) |
| Variety | `FoodProfile`, `FoodHyperfixation`, `ChainSuggestion`, `VariationIdea` |

### 2.3 Transactions & Reactions

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-CON-001 | Single-DB strong consistency | All writes occur in one PostgreSQL database; multi-row changes within an aggregate use a single transaction. |
| INV-CON-002 | Aggregate-root transactions | Modifications to entities within an aggregate go through the aggregate root in one transaction. |
| INV-CON-003 | Cross-aggregate reactions | Reactions spanning aggregates (e.g., `MealLogged` → decrement `PreppedMeal` portions) run as a Postgres trigger, a Supabase Edge Function, or transactional client logic — chosen per case. |
| INV-CON-004 | No async event bus | There is no message broker or transactional outbox. "Domain events" (Appendix A) are a conceptual reaction catalog, not infrastructure. |

---

## 3. Concurrency Model (Online / Realtime)

The app is **online-first**: clients keep a read cache and apply optimistic updates, but the server is always authoritative and there is no offline write queue or conflict-resolution engine.

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-CC-001 | Server authoritative | The Supabase Postgres database is the single source of truth; client caches are a disposable working set. |
| INV-CC-002 | Optimistic updates reconcile | Optimistic client updates must reconcile against the server response and roll back on rejection. |
| INV-CC-003 | Last-write-wins default | Concurrent edits to the same row resolve last-write-wins at row/field granularity. |
| INV-CC-004 | Append-only records never overwritten | `MealLog`, `EnergyLog`, and `PortionEvent` are append-only and are never overwritten by LWW. |
| INV-CC-005 | Realtime is best-effort | Supabase Realtime delivery to household members is best-effort; correctness never depends on receiving a realtime event (clients can re-fetch). |
| INV-CC-006 | Portions via ledger | `PreppedMeal` portion changes are recorded as append-only `PortionEvent` rows; remaining portions are derived, never blind-overwritten (see INV-INV-004). |

---

## 4. Data Integrity Invariants

### 4.1 Schema Conventions

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-DB-001 | UUID primary keys | Primary keys are UUIDs (client-generatable, non-enumerable); no auto-increment. |
| INV-DB-002 | Timestamps are `timestamptz` (UTC) | Timestamps use Postgres `timestamptz`, stored and compared in UTC. |
| INV-DB-003 | Soft delete only where needed | Use `deleted_at` only where the domain needs recoverable deletes; otherwise hard delete. |
| INV-DB-004 | No secrets in client-readable tables | Credentials/secrets are managed by Supabase Auth or stored server-side only; never exposed through RLS-readable tables. |
| INV-DB-005 | IDs opaque | IDs encode no meaning; treat as opaque strings. |

### 4.2 Referential Integrity

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-DB-006 | Foreign keys enforced | All references use Postgres foreign-key constraints. |
| INV-DB-007 | Controlled cascades | Delete behavior (cascade / restrict / set null) is declared per relationship to match domain rules. |
| INV-DB-008 | No orphaned children | Child rows (e.g., `RecipeIngredient`) cannot exist without their parent. |

### 4.3 Migrations

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-DB-009 | Migrations via Supabase CLI | Schema changes are versioned SQL migrations applied via the Supabase CLI; the migration history is the canonical schema source. |
| INV-DB-010 | Expand–migrate–contract | Backward-compatible evolution: add (nullable/default) → backfill + ship code → remove old. |
| INV-DB-011 | RLS enabled before exposure | Every table holding user data has RLS enabled with explicit policies before it is exposed to clients. |

---

## 5. Data Access & API Invariants

Data access is Supabase: **PostgREST** for CRUD, **Realtime** for subscriptions, **Edge Functions** for server-side logic — all governed by RLS.

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-API-001 | RLS is the authorization boundary | All PostgREST and Realtime access is constrained by RLS; the client is never trusted for authorization. |
| INV-API-002 | Anon key is public; service-role is not | The Supabase anon key is publishable (security derives from RLS + Auth). The service-role key is never shipped to clients. |
| INV-API-003 | Server-only logic in Edge Functions | Operations needing secrets or privilege (cloud AI calls, third-party API keys, privileged writes) run in Edge Functions, not the client. |
| INV-API-004 | Validation before persistence | Inputs are validated client-side and backstopped by database constraints and RLS before writes. |
| INV-API-005 | Consistent, friendly errors | The client surfaces structured, plain-language errors; raw Postgres/PostgREST errors are never shown in the UI. |
| INV-API-006 | Generated types are the contract | Client/server types are generated from the schema (`supabase gen types`); additive changes preferred, breaking changes versioned. |

---

## 6. Security Invariants

Authentication and credential handling are **delegated to Supabase Auth**; authorization is enforced by **Postgres RLS**. The app does not implement its own password hashing or token issuance.

### 6.1 Authentication (Supabase Auth)

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-SEC-001 | Auth delegated | User authentication, password hashing, and token issuance are handled by Supabase Auth, not reimplemented. |
| INV-SEC-002 | JWT sessions | Access uses Supabase-issued JWTs with refresh-token rotation (Supabase defaults/config). |
| INV-SEC-003 | Secure token storage | Auth tokens are kept in the Supabase client's browser session storage; never exposed to untrusted scripts. |

### 6.2 Authorization (RLS)

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-SEC-004 | Row-level access control | Users may access only their own rows plus household rows they belong to, enforced by RLS. |
| INV-SEC-005 | Role-based household access | Household roles ADMIN (full), MEMBER (read/write), VIEWER (read-only) are enforced in RLS policies. |
| INV-SEC-006 | Default deny | Tables grant no access by default; policies grant access explicitly. |

### 6.3 Data Protection

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-SEC-007 | TLS everywhere | All traffic uses TLS — the Supabase API, and Caddy's automatic HTTPS for the web app. |
| INV-SEC-008 | No PII in logs | Logs never contain passwords, tokens, emails, or PII-laden request bodies. |
| INV-SEC-009 | Injection-safe | Data access uses PostgREST/parameterized queries; no string-built SQL in Edge Functions. |
| INV-SEC-010 | XSS-safe | Rely on Svelte output escaping; never render unsanitized HTML (no unchecked `{@html}`). |
| INV-SEC-011 | Service-role key server-only | The service-role key exists only in server / Edge-Function environments. |

---

## 7. Privacy & Data Ownership Invariants

User data resides in a managed cloud (Supabase). User-control guarantees are retained.

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-PRI-001 | Data exportable | All user data is exportable in standard formats (JSON, CSV). |
| INV-PRI-002 | Full deletion | Users can delete their account and all associated data. |
| INV-PRI-003 | AI data minimization | Only data needed for a feature is sent to cloud AI providers; never tokens/credentials; PII minimized. |
| INV-PRI-004 | AI use disclosed | Sending user content to a cloud AI provider is disclosed; sensitive AI operations are opt-in. |
| INV-PRI-005 | No telemetry without consent | No usage telemetry without explicit opt-in; analytics, if enabled, are anonymized and aggregated. |
| INV-PRI-006 | AI output untrusted | AI output is treated as untrusted input and validated before persistence. |

---

## 8. Performance Invariants

| ID | Invariant | Target / Description |
|----|-----------|----------------------|
| INV-PERF-001 | Startup | < 3 s to interactive on baseline mobile hardware. |
| INV-PERF-002 | Screen transitions | < 300 ms under normal conditions. |
| INV-PERF-003 | Cached search | Keyword search over cached data < 500 ms. |
| INV-PERF-004 | Background refresh non-blocking | Data fetch/refresh never blocks the UI. |
| INV-PERF-005 | Recipe capacity | Client cache handles 10,000+ recipes efficiently. |
| INV-PERF-006 | Backend scale | Hobby-scale load is served within Supabase free/Pro tier limits. |

---

## 9. Cross-Cutting Invariants

### 9.1 Domain Events (Conceptual)

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-EVT-001 | Events are a model, not a bus | Domain events (Appendix A) describe reactions; they are implemented via triggers / Edge Functions / transactional logic, not a broker. |
| INV-EVT-002 | Reactions idempotent | Any reaction that may be retried must be idempotent. |

### 9.2 Time Zone Handling

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-TZ-001 | Timestamps in UTC | All timestamps stored/transported in UTC (`timestamptz`). |
| INV-TZ-002 | Display in user timezone | Timestamps displayed in the user's configured timezone. |
| INV-TZ-003 | Planning dates in resolved timezone | Planning dates interpreted in `Household.timeZone` (collaborative) or `UserPreferences.timeZone` (solo). |

### 9.3 Feature Toggles

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-FT-001 | Passive features default ON | Passive features (energy filtering, expiration awareness) default ON, individually toggleable. |
| INV-FT-002 | Active tracking default OFF | Active tracking (energy logging, nutrition tracking, variety tracking) default OFF, opt-in only. |
| INV-FT-003 | Feature-gated data isolated | Data for disabled features is not collected or processed. |

### 9.4 Accessibility

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-A11Y-001 | Minimum touch targets | Interactive elements: 44pt minimum (66–96pt in kitchen mode). |
| INV-A11Y-002 | Color not sole indicator | Color is never the only indicator of state or meaning. |
| INV-A11Y-003 | Screen reader support | Primary flows are accessible via screen readers. |

### 9.5 Error Handling

| ID | Invariant | Description |
|----|-----------|-------------|
| INV-ERR-001 | Graceful degradation | Features degrade gracefully when dependencies (network, AI, third-party APIs) are unavailable. |
| INV-ERR-002 | User-friendly errors | Error messages use plain language, never stack traces. |
| INV-ERR-003 | Recoverable states | The system recovers from transient errors without data loss. |

---

## Appendix A: Invariant Testing Checklist

### Domain Invariants
- [ ] Unit tests for each INV-ID-*, INV-RC-*, INV-INV-*, INV-PL-*, INV-SH-*, INV-EN-*, INV-NT-*, INV-VR-* invariant
- [ ] Property-based tests for range constraints (ratings, levels, percentages)

### RLS & Security
- [ ] A user cannot read or write another household's rows
- [ ] Default-deny verified on every user-data table
- [ ] Role enforcement (ADMIN / MEMBER / VIEWER) tested per policy

### Data Integrity
- [ ] Foreign-key, check, and unique-constraint tests
- [ ] Portion-ledger non-negativity (INV-INV-004) test

### Reactions
- [ ] Trigger / Edge-Function reaction tests (idempotency; `MealLogged` → portion decrement)

---

## Appendix B: Invariant Violation Handling

1. **DB constraint / RLS violation** — the operation is rejected; the client shows a friendly message and preserves input.
2. **Optimistic update rejected by server** — roll back the optimistic change and re-fetch authoritative state.
3. **Reaction failure (trigger / Edge Function)** — log with context; the owning write should fail atomically, or the reaction must be safely retryable (idempotent).
4. **Data anomaly** — log with context, alert, preserve original data.

---

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-06-04 | Robert | Initial invariants reference. |

---

_End of Project Invariants Document_
