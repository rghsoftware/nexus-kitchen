# Tasks: Pantry & Inventory (Feature 001)

<!-- Tech Stack Validation: PASSED -->
<!-- Validated against: .specswarm/tech-stack.md -->
<!-- No prohibited technologies found -->
<!-- All technologies are approved: SvelteKit, Svelte 5 runes, TypeScript, Supabase, Tailwind v4, BarcodeDetector API -->

**Feature:** 001-pantry-inventory  
**Spec:** [spec.md](./spec.md) | **Plan:** [plan.md](./plan.md) | **Data Model:** [data-model.md](./data-model.md)  
**Total tasks:** 30  
**Parallelizable:** 18

---

## User Stories

| ID  | Scenario                                  | Priority | Spec ref                                   |
| --- | ----------------------------------------- | -------- | ------------------------------------------ |
| US1 | Browse pantry overview (grid + alerts)    | P1       | FR-PI-006, FR-PI-007, FR-PM-006, FR-PM-007 |
| US2 | Add pantry item manually                  | P1       | FR-PI-001, FR-PI-004, FR-PI-005, FR-PI-009 |
| US3 | Add pantry item via barcode scan          | P2       | FR-PI-002                                  |
| US4 | Add prepped meal directly                 | P1       | FR-PM-001, FR-PM-002, FR-PM-003, FR-PM-009 |
| US5 | Consume / correct portions; start defrost | P1       | FR-PM-004, FR-PM-004a, FR-PM-005           |
| US6 | Shopping list → pantry (stub)             | P2       | FR-PI-008                                  |
| US7 | Household Realtime sync                   | P2       | FR-PI-011, FR-PM-008                       |
| US8 | Expiration / low-stock alerts             | P1       | FR-PI-007, FR-PM-006, FR-PM-007            |

---

## Completion Tracker (canonical checkbox list — required for verify-queue)

### Phase 1 — Setup

- [X] T001 Create pantry_items migration with RLS — `supabase/migrations/20260609_001_pantry_items.sql`
- [X] T002 [P] Create prepped_meals migration with RLS — `supabase/migrations/20260609_002_prepped_meals.sql`
- [X] T003 [P] Create portion_events migration with trigger and RLS — `supabase/migrations/20260609_003_portion_events.sql`
- [X] T004 Generate TypeScript DB types and write domain type aliases — `src/lib/pantry/types.ts`

### Phase 2 — Service Layer (foundational)

- [X] T005 [P] Implement pantryService CRUD and photo upload — `src/lib/pantry/pantryService.ts`
- [X] T006 [P] Implement preppedMealService CRUD and defrost transitions — `src/lib/pantry/preppedMealService.ts`
- [X] T007 Implement portionLedger write helpers — `src/lib/pantry/portionLedger.ts`
- [X] T008 [P] Implement inventorySnapshot stub — `src/lib/pantry/inventorySnapshot.ts`
- [X] T009 [P] Implement shoppingListIntegration stub — `src/lib/pantry/shoppingListIntegration.ts`

### Phase 3 — State Layer (foundational)

- [X] T010 [P] Implement pantryStore with optimistic updates and derived alerts — `src/lib/pantry/pantryStore.svelte.ts`
- [X] T011 [P] Implement preppedMealStore with optimistic updates and derived views — `src/lib/pantry/preppedMealStore.svelte.ts`

### Phase 4 — US1: Browse Pantry Overview

- [X] T012 Add Pantry route and wire bottom navigation tab — `src/routes/(app)/pantry/+page.svelte`
- [X] T013 [P] [US1] Build PantryTab root with storage-location tab bar — `src/lib/components/pantry/PantryTab.svelte`
- [X] T014 [P] [US1] Build PantryOverview grid layout and FAB — `src/lib/components/pantry/PantryOverview.svelte`
- [X] T015 [P] [US1] Build PantryItemCard with photo, quantity, expiry, and low-stock badges — `src/lib/components/pantry/PantryItemCard.svelte`
- [X] T016 [P] [US1] [US8] Build ExpiryAlertShelf for expiring-soon and running-low banners — `src/lib/components/pantry/ExpiryAlertShelf.svelte`
- [X] T017 [P] [US1] [US4] Build PreppedMealOverview with eat-this-first ordering — `src/lib/components/pantry/PreppedMealOverview.svelte`
- [X] T018 [P] [US1] [US4] Build PreppedMealCard with portions, defrost status, and quick actions — `src/lib/components/pantry/PreppedMealCard.svelte`

### Phase 5 — US2: Add Pantry Item Manually

- [X] T019 [US2] Build PantryItemForm with manual fields, location-based expiry suggestion, and photo capture — `src/lib/components/pantry/PantryItemForm.svelte`
- [X] T020 [P] [US2] [US3] Build BarcodeScanner with BarcodeDetector API and Firefox JS fallback — `src/lib/components/pantry/BarcodeScanner.svelte`

### Phase 6 — US4: Add Prepped Meal Directly

- [X] T021 [US4] Build PreppedMealForm with origin toggle, recipe link, portion count, and shelf-life defaults — `src/lib/components/pantry/PreppedMealForm.svelte`

### Phase 7 — US5: Consume / Correct Portions and Defrost

- [X] T022 [US5] Build PortionEditor with consume and correction (ADJUSTED event) flows, visually distinct — `src/lib/components/pantry/PortionEditor.svelte`
- [X] T023 [P] [US5] Wire defrost start and mark-ready actions into PreppedMealCard and preppedMealService — `src/lib/components/pantry/PreppedMealCard.svelte`

### Phase 8 — US7: Household Realtime Sync

- [X] T024 [US7] Add Supabase Realtime subscriptions to pantryStore and preppedMealStore, re-fetch on reconnect — `src/lib/pantry/pantryStore.svelte.ts`, `src/lib/pantry/preppedMealStore.svelte.ts`

### Phase 9 — Tests

- [X] T025 [P] Unit test pantryService CRUD and error/rollback paths — `src/lib/pantry/pantryService.spec.ts`
- [X] T026 [P] Unit test preppedMealService CRUD, defrost transitions, and error paths — `src/lib/pantry/preppedMealService.spec.ts`
- [X] T027 [P] Unit test portionLedger invariants (INV-INV-004/010/011) — `src/lib/pantry/portionLedger.spec.ts`
- [X] T028 [P] Component test PantryItemCard renders states (normal, expiring, expired, low-stock) — `src/lib/components/pantry/PantryItemCard.svelte.spec.ts`
- [X] T029 [P] Component test PreppedMealCard renders states (portions, defrost, expiry) — `src/lib/components/pantry/PreppedMealCard.svelte.spec.ts`
- [X] T030 E2E Playwright tests for all happy paths and edge cases — `tests/pantry.spec.ts`

---

## Detailed Task Descriptions

### Phase 1 — Setup

#### T001 — pantry_items migration

Create `supabase/migrations/20260609_001_pantry_items.sql`. Define `storage_location` enum. Create `pantry_items` table with all fields from data-model.md: UUID PK, `owner_id` (FK auth.users), nullable `household_id`, nullable `ingredient_id`, `name` (CHECK 1–200 chars), `quantity` (CHECK ≥ 0), `unit`, nullable `minimum_quantity` (CHECK ≥ 0), `storage_location` enum, nullable `custom_location`, nullable `purchase_date` / `expiration_date` / `opened_date` (date columns), nullable `photo_url` / `thumbnail_url`, `created_at` / `updated_at` (timestamptz). `ENABLE ROW LEVEL SECURITY`. Two policies: owner (`owner_id = auth.uid()`) and household member (subquery against `household_members`). Indexes on `owner_id`, `household_id`, `expiration_date`.

#### T002 [P] — prepped_meals migration

Create `supabase/migrations/20260609_002_prepped_meals.sql`. Define `prepped_meal_origin` enum (`PREP_SESSION`, `DIRECT_ENTRY`, `STORE_BOUGHT`) and `defrost_state` enum (`NOT_APPLICABLE`, `FROZEN`, `DEFROSTING`, `READY`). Create `prepped_meals` table: UUID PK, `owner_id`, nullable `household_id`, `origin` enum, `name`, nullable `recipe_id` + `recipe_name`, nullable `meal_prep_session_id`, `portions_remaining` (CHECK ≥ 0), `original_portions` (CHECK > 0), `storage_location` enum, nullable `container_label`, `prepared_date` (date), `expiration_date` (date), `defrost_state` default `NOT_APPLICABLE`, nullable `defrost_started_at` (timestamptz), nullable `estimated_ready_at` (timestamptz), nullable `photo_url`, `created_at` / `updated_at` (timestamptz). DB-level CONSTRAINTS: `expiration_date > prepared_date`; `portions_remaining <= original_portions`; `defrost_state != 'DEFROSTING' OR defrost_started_at IS NOT NULL`. `ENABLE ROW LEVEL SECURITY` + same two policies as T001. Indexes on `owner_id`, `household_id`, `expiration_date`.

#### T003 [P] — portion_events migration + trigger

Create `supabase/migrations/20260609_003_portion_events.sql`. Define `portion_event_kind` enum (`INITIALIZED`, `CONSUMED`, `ADJUSTED`). Create `portion_events` table: UUID PK, `prepped_meal_id` (FK prepped_meals ON DELETE CASCADE), `delta_portions` (integer CHECK ≠ 0), `kind` enum, nullable `triggered_by` (uuid MealLog ref), `created_at` timestamptz. CONSTRAINT `positive_delta_only_adjusted`: `delta_portions <= 0 OR kind = 'ADJUSTED'`. `ENABLE ROW LEVEL SECURITY`: INSERT policy (authenticated user can access parent prepped_meal via owner or household); SELECT same. No UPDATE/DELETE policies (append-only per P14). Create `sync_portions_remaining()` trigger function and `trg_sync_portions_remaining` AFTER INSERT trigger that atomically updates `prepped_meals.portions_remaining` and raises exception if result < 0. Index on `prepped_meal_id`.

#### T004 — TypeScript types

Run `bun run db:types` to regenerate `src/lib/database.types.ts` from the applied migrations. Then create `src/lib/pantry/types.ts` with: `StorageLocation`, `DefrostState`, `PreppedMealOrigin`, `PortionEventKind` union types; `PantryItem`, `PreppedMeal`, `PortionEvent`, `InventorySnapshot`, `ShoppingListItem` interfaces (as defined in data-model.md); `DEFAULT_SHELF_LIFE_DAYS` and `PREPPED_SHELF_LIFE_DAYS` const maps. All derived computed fields (`isRunningLow`, `isExpiringSoon`, `isExpired`, `isReadyToEat`) are TypeScript-only fields populated client-side, not DB columns.

---

### Phase 2 — Service Layer

#### T005 [P] — pantryService

Create `src/lib/pantry/pantryService.ts`. Export: `getPantryItems(householdId?: string): Promise<PantryItem[]>` — supabase select ordered by `storage_location, name`; maps DB row to `PantryItem` computing derived fields. `addPantryItem(item: Omit<PantryItem, 'id'|'createdAt'|'updatedAt'|...>): Promise<PantryItem>`. `updatePantryItem(id: string, changes: Partial<PantryItem>): Promise<PantryItem>`. `deletePantryItem(id: string): Promise<void>`. `uploadPantryPhoto(itemId: string, file: File): Promise<string>` — resize client-side to max 800px, upload to Supabase Storage bucket `pantry-photos/${itemId}`, return public URL. All functions throw typed errors on supabase error. No raw hex colors; no `{@html}`; no server-side code.

#### T006 [P] — preppedMealService

Create `src/lib/pantry/preppedMealService.ts`. Export: `getPreppedMeals(householdId?: string): Promise<PreppedMeal[]>` — ordered by `expiration_date asc`; computes derived fields. `addPreppedMeal(meal: NewPreppedMeal): Promise<PreppedMeal>` — INSERT prepped_meal, then INSERT INITIALIZED PortionEvent (deltaPortions = meal.originalPortions). `updatePreppedMeal(id, changes)` — non-portion fields only. `consumePortions(preppedMealId: string, count: number): Promise<void>` — calls portionLedger with CONSUMED event. `correctPortions(preppedMealId: string, newCount: number): Promise<void>` — calculates delta from current `portionsRemaining`, calls portionLedger with ADJUSTED event. `startDefrost(preppedMealId: string): Promise<void>` — UPDATE `defrost_state = DEFROSTING`, `defrost_started_at = now()`, `estimated_ready_at = now() + interval '24 hours'`. `markDefrostReady(preppedMealId: string): Promise<void>` — UPDATE `defrost_state = READY`.

#### T007 — portionLedger

Create `src/lib/pantry/portionLedger.ts`. Export: `insertPortionEvent(event: { preppedMealId: string; deltaPortions: number; kind: PortionEventKind; triggeredBy?: string }): Promise<void>` — validates delta ≠ 0 (INV-INV-010) and that positive delta only when kind = ADJUSTED (INV-INV-011) before calling supabase INSERT. The DB trigger enforces the ledger constraint; this layer provides client-side pre-validation for fast feedback. Throws `PortionLedgerError` with a user-readable message if invariant would be violated.

#### T008 [P] — inventorySnapshot stub

Create `src/lib/pantry/inventorySnapshot.ts`. Export `getInventorySnapshot(): InventorySnapshot` — reads current state from pantryStore and preppedMealStore (imported as modules), returns `{ pantryItems, preppedMeals, snapshotAt: new Date().toISOString() }`. Export the `InventorySnapshot` type re-export from types.ts. Add JSDoc: `@stub — consumed by the Planning feature; no active consumer in this build.`

#### T009 [P] — shoppingListIntegration stub

Create `src/lib/pantry/shoppingListIntegration.ts`. Export `addPantryItemsFromShoppingList(checkedItems: ShoppingListItem[]): Promise<void>` — function body is a no-op (`return Promise.resolve()`). Add JSDoc: `@stub — called by the Shopping feature on trip completion (FR-PI-008); no-op until Shopping feature is built.` Export `ShoppingListItem` type re-export.

---

### Phase 3 — State Layer

#### T010 [P] — pantryStore

Create `src/lib/pantry/pantryStore.svelte.ts`. Use Svelte 5 module-level `$state`. Export reactive `pantryItems: PantryItem[]` state. Export: `loadPantryItems(householdId?: string)` — calls `getPantryItems`, sets state. `optimisticAdd(item)` — push to state, call service, rollback on error. `optimisticUpdate(id, changes)` — update in state, call service, rollback on error. `optimisticDelete(id)` — remove from state, call service, rollback on error. Export `$derived` views: `expiringSoon` (items with `isExpiringSoon = true`), `runningLow` (items with `isRunningLow = true`). Realtime subscription placeholder (implemented in T024). No `{@html}`; no raw hex. Server-only code not used.

#### T011 [P] — preppedMealStore

Create `src/lib/pantry/preppedMealStore.svelte.ts`. Same pattern as T010 for prepped meals. Export reactive `preppedMeals: PreppedMeal[]`. Optimistic ops for add, update, consume, correct, defrost transitions. `$derived` views: `expiringSoon` (within 2 days), `readyToEat` (isReadyToEat = true), ordered by expiration_date ascending. Realtime subscription placeholder.

---

### Phase 4 — US1: Browse Pantry Overview

#### T012 — route + navigation

Create `src/routes/(app)/pantry/+page.svelte` — imports and renders `<PantryTab />`. Update `src/routes/+layout.svelte` bottom navigation to include a Pantry tab (Phosphor PhosphorIcon `ShoppingBag` or `Jar`, label "Pantry"). Route guard: redirect to auth if not logged in. No `ssr=false` override needed (inherited from root layout). Calls `loadPantryItems()` and `loadPreppedMeals()` on mount via `$effect`.

#### T013 [P] [US1] — PantryTab

Create `src/lib/components/pantry/PantryTab.svelte`. Rune `$props`: none. Tab bar at top: "All" / "Fridge" / "Freezer" / "Pantry" / "Prepped" — uses `$state` for active tab. Below tab bar: `<ExpiryAlertShelf />` (conditional), then `<PantryOverview storageFilter={activeTab} />` or `<PreppedMealOverview />` depending on active tab. Design tokens: `var(--primary)` for active tab, `.nk-tab-bar` class. ADHD-friendly: large tap targets (44pt min per REQ-AC-002).

#### T014 [P] [US1] — PantryOverview

Create `src/lib/components/pantry/PantryOverview.svelte`. `$props`: `storageFilter: StorageLocation | 'ALL'`. Reads from `pantryStore` and applies filter. Renders a responsive CSS grid of `<PantryItemCard />` components (2-col mobile, 3-col tablet, 4-col desktop). "No items" empty state with a friendly illustration and "+ Add your first item" CTA when filtered list is empty. FAB "+ Add" button fixed bottom-right. Uses `var(--spacing-*)` tokens; no raw values.

#### T015 [P] [US1] — PantryItemCard

Create `src/lib/components/pantry/PantryItemCard.svelte`. `$props`: `item: PantryItem`. Shows: photo thumbnail (`<img>` with placeholder SVG if `photoUrl` null), item name, quantity + unit, storage location badge (color-coded via design tokens — not raw hex), expiry badge (`var(--color-warning)` if expiring soon, `var(--color-error)` if expired via CSS classes, not inline styles), running-low badge when `isRunningLow`. Tap anywhere → emits `edit` event. Touch target ≥ 44pt (REQ-AC-002). No `{@html}`.

#### T016 [P] [US1] [US8] — ExpiryAlertShelf

Create `src/lib/components/pantry/ExpiryAlertShelf.svelte`. Reads `pantryStore.expiringSoon`, `pantryStore.runningLow`, `preppedMealStore.expiringSoon`. If all empty, renders nothing. Otherwise: "⚠ Expiring Soon" horizontal scroll row of photo cards (pantry items ≤7 days + prepped meals ≤2 days); "Running Low" text list with count and "+ Add to Shopping List" CTA (calls `shoppingListIntegration` stub — fire-and-forget, shows toast if stub). Shame-free language (REQ-UX-006): no "you forgot", "overdue". Design tokens only.

#### T017 [P] [US1] [US4] — PreppedMealOverview

Create `src/lib/components/pantry/PreppedMealOverview.svelte`. Reads `preppedMealStore.preppedMeals` ordered by expiration_date. Top section: "Eat this first" — up to 3 items with the soonest expiration (FR-PM-007). Then full list of `<PreppedMealCard />`. "No prepped meals" empty state with "+ Add a prepped meal" and "+ Start a prep session" CTAs. Design tokens. Touch targets ≥ 44pt.

#### T018 [P] [US1] [US4] — PreppedMealCard

Create `src/lib/components/pantry/PreppedMealCard.svelte`. `$props`: `meal: PreppedMeal`. Shows: photo/placeholder, name, origin badge (Made / Bought / From Prep Session), portions-remaining badge, expiry indicator (color via class, not raw hex), defrost status chip (Frozen / Defrosting / Ready). Quick action buttons: "Eat 1" (calls `consumePortions(meal.id, 1)` optimistically), "Defrost" (shown only if FROZEN, calls `startDefrost`), "Ready" (shown if DEFROSTING, calls `markDefrostReady`). Tap card → opens `<PortionEditor />` sheet. No `{@html}`.

---

### Phase 5 — US2 / US3: Add Pantry Item

#### T019 [US2] — PantryItemForm

Create `src/lib/components/pantry/PantryItemForm.svelte`. `$props`: `item?: PantryItem` (undefined = add mode), `onSave: (item: PantryItem) => void`, `onCancel: () => void`. Fields: name (text, required), quantity (number ≥ 0), unit (select with common units + custom), storage location (segmented: Fridge / Freezer / Pantry / Other), expiration date (date input with auto-suggestion per FR-PI-009: uses `DEFAULT_SHELF_LIFE_DAYS[location]` from `now()` via `$effect` on location change), purchase date (date, optional), opened date (date, optional), minimum quantity (number ≥ 0, optional), photo (file input + camera capture). In edit mode: delete button (with confirm dialog). On save: calls `optimisticAdd` or `optimisticUpdate`. Client-side validation: name required, quantity ≥ 0, min ≥ 0 (INV-INV-001/002). Design tokens; no raw values. "Scan Barcode" button shown below name field → opens `<BarcodeScanner />`.

#### T020 [P] [US2] [US3] — BarcodeScanner

Create `src/lib/components/pantry/BarcodeScanner.svelte`. `$props`: `onDetect: (barcode: string) => void`, `onClose: () => void`. On mount: request `getUserMedia({ video: { facingMode: 'environment' } })`. If `BarcodeDetector` available in `window`: use native API scan loop on video stream. Else: dynamically `import('barcode-detector-polyfill')` (or similar minimal JS fallback — no new npm dep; use a CDN-loaded or bundled-tiny fallback). On barcode detected: call `onDetect(barcode)` and stop stream. Show camera preview `<video>` element full-screen with a targeting reticle using `var(--primary)`. Close button top-right. On close: stop stream, call `onClose`. Error state: "Camera not available — enter barcode manually" fallback text input. No `{@html}`. Design tokens only.

---

### Phase 6 — US4: Add Prepped Meal

#### T021 [US4] — PreppedMealForm

Create `src/lib/components/pantry/PreppedMealForm.svelte`. `$props`: `meal?: PreppedMeal`, `onSave`, `onCancel`. Fields: name (text, required), origin toggle ("I made it" = `DIRECT_ENTRY` / "I bought it" = `STORE_BOUGHT`), recipe link (optional search/text, sets `recipeId` + `recipeName`), portion count (integer > 0, required), date made/bought (date, defaults today), storage location (Fridge / Freezer), shelf-life override (number input, pre-filled from `PREPPED_SHELF_LIFE_DAYS[location]` via `$effect`, editable per FR-PM-009), container label (optional), photo capture. Computed `expirationDate = preparedDate + shelfLifeDays`. Validation: name required, portions > 0, expiration > prepared (INV-INV-009). On save: calls `preppedMealService.addPreppedMeal` (which creates INITIALIZED PortionEvent). Design tokens; ADHD-friendly defaults (today's date, location-aware shelf life). No `{@html}`.

---

### Phase 7 — US5: Consume / Correct / Defrost

#### T022 [US5] — PortionEditor

Create `src/lib/components/pantry/PortionEditor.svelte`. `$props`: `meal: PreppedMeal`, `onClose`. Two visually distinct sections: **Consume** — stepper `[-] N [+]` (min 1, max `portionsRemaining`), large primary "Eat N portions" button → calls `consumePortions`, closes on success. **Correct** — visually de-emphasized (smaller button, secondary style); text "Correct total count" → expands inline: number input for new total, note "Use this to fix a typo, not to eat portions", "Update" button → calls `correctPortions` with new count (which computes delta and creates ADJUSTED event). Disable consume button if `portionsRemaining === 0`. Show current count and expiry prominently. Design tokens. Touch targets ≥ 44pt.

#### T023 [P] [US5] — defrost flow

Wire defrost actions in `PreppedMealCard.svelte` (already created in T018) to `preppedMealService`. Ensure state transitions: FROZEN → tap "Defrost" → optimistic update to DEFROSTING + `defrostStartedAt = now()`. Show countdown "Ready in ~Xh" using `estimatedReadyAt`. DEFROSTING → tap "Ready" → optimistic update to READY. READY → `isReadyToEat = true`. Validate INV-INV-007 client-side: only show "Defrost" for items with `storageLocation = FREEZER`. No `{@html}`.

---

### Phase 8 — US7: Household Realtime

#### T024 [US7] — Realtime subscriptions

In `src/lib/pantry/pantryStore.svelte.ts` (edit T010's file): add `subscribeToHouseholdChanges(householdId: string)` — calls `supabase.channel('pantry-household-' + householdId).on('postgres_changes', { event: '*', schema: 'public', table: 'pantry_items', filter: 'household_id=eq.' + householdId }, handler).subscribe()`. Handler: refetches the changed row and merges into `$state` (replace existing or add new; remove on DELETE). On subscribe error: log, do not throw (best-effort per P15). In `src/lib/pantry/preppedMealStore.svelte.ts` (edit T011's file): same pattern for `prepped_meals` table. Both stores: call `loadPantryItems()`/`loadPreppedMeals()` on channel reconnect event. Unsubscribe on store cleanup (`$effect` return).

---

### Phase 9 — Tests

#### T025 [P] — pantryService unit tests

Create `src/lib/pantry/pantryService.spec.ts`. Mock `supabase` client from `$lib/supabaseClient`. Test: `getPantryItems` returns mapped items with computed fields; `addPantryItem` calls INSERT and returns new item; `updatePantryItem` calls UPDATE; `deletePantryItem` calls DELETE; supabase error → throws typed error; `uploadPantryPhoto` calls Storage upload and returns URL. `expect.requireAssertions` in each test. Server-side project (no `.svelte` test suffix).

#### T026 [P] — preppedMealService unit tests

Create `src/lib/pantry/preppedMealService.spec.ts`. Mock supabase. Test: `addPreppedMeal` inserts prepped_meal then inserts INITIALIZED PortionEvent; `consumePortions` calls portionLedger with CONSUMED kind; `correctPortions` calculates correct delta, calls portionLedger with ADJUSTED kind; `startDefrost` sets DEFROSTING + timestamp; `markDefrostReady` sets READY; error → typed throw. `expect.requireAssertions`.

#### T027 [P] — portionLedger invariant unit tests

Create `src/lib/pantry/portionLedger.spec.ts`. Test: delta = 0 → throws `PortionLedgerError` (INV-INV-010); positive delta + kind ≠ ADJUSTED → throws (INV-INV-011); negative delta + CONSUMED kind → succeeds; positive delta + ADJUSTED kind → succeeds. All assertions present. `expect.requireAssertions`.

#### T028 [P] — PantryItemCard component tests

Create `src/lib/components/pantry/PantryItemCard.svelte.spec.ts` (vitest browser project). Render with: normal item (no badges), expiring-soon item (warning badge visible), expired item (error badge), running-low item (low-stock badge), item with photo (img src set), item without photo (placeholder shown). Assert correct CSS classes applied (via `data-testid` or `.nk-*`). `expect.requireAssertions`. No `{@html}` in assertions.

#### T029 [P] — PreppedMealCard component tests

Create `src/lib/components/pantry/PreppedMealCard.svelte.spec.ts` (vitest browser). Render with: FROZEN meal (shows "Defrost" button), DEFROSTING meal (shows countdown + "Ready" button), READY/NOT_APPLICABLE meal (shows "Eat 1" button), 0 portions (Eat button disabled), DIRECT_ENTRY origin (shows "Made" badge), STORE_BOUGHT origin. `expect.requireAssertions`.

#### T030 — Playwright e2e

Create `tests/pantry.spec.ts`. Tests: (1) Navigate to Pantry tab → empty state visible. (2) Add pantry item manually → appears in grid with correct location tab. (3) Edit pantry item quantity → updated in grid. (4) Delete pantry item → removed from grid. (5) Add prepped meal directly (DIRECT_ENTRY) → appears in prepped list. (6) Eat 1 portion → count decrements. (7) Correct portion count → ADJUSTED event, count updates. (8) Start defrost → DEFROSTING status shown with countdown. (9) Expiring item → appears in ExpiryAlertShelf. (10) Barcode scan: mock `BarcodeDetector` in page context, verify form fields pre-filled. Each test is independent; setup creates fresh user via Supabase test helpers.

---

## Dependency Graph

```
T001 ──┐
T002 ──┤── T004 ──┬── T005 ──┬── T010 ──┐
T003 ──┘          │          │          ├── T012 → T013-T018 (US1)
                  │          └── T007   │     ↓
                  │                     │  T019 (US2) → T020 (US3)
                  ├── T006 ──┬── T011 ──┤  T021 (US4)
                  │          └── T007   │  T022-T023 (US5)
                  │                     │  T024 (US7)
                  ├── T008 ──┘          │
                  └── T009 ──┘          └── T025-T030 (Tests)
```

**Critical path:** T001/T002/T003 → T004 → T005+T006 → T010+T011 → T012 → all UI

---

## Parallel Execution Examples

### Batch 1 (can all start simultaneously)

```
T001 | T002 | T003
```

### Batch 2 (after T001+T002+T003 done — T004 is sequential)

```
T004  ← sequential (depends on all migrations)
```

### Batch 3 (after T004)

```
T005 | T006 | T008 | T009
```

### Batch 4 (after T005+T006)

```
T007 | T010 | T011
```

### Batch 5 (after T010+T011)

```
T012 → then:
T013 | T014 | T015 | T016 | T017 | T018
```

### Batch 6 (after T013-T018)

```
T019 | T020 | T021 | T022 | T023
```

### Batch 7 (after T019-T023)

```
T024
```

### Batch 8 (after T024 — all implementation done)

```
T025 | T026 | T027 | T028 | T029
```

Then T030 (after unit tests pass).

---

## MVP Scope

Minimum viable for this feature (covers US1, US2, US4, US5, US8):

**T001 → T002 → T003 → T004 → T005 → T006 → T007 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T021 → T022**

This gives: DB schema + RLS, pantry CRUD, prepped meal CRUD + portion ledger, visual overview, add/edit pantry items, add prepped meals, consume/correct portions, expiry alerts.

Deferred to later batches: barcode scan (T020), Realtime sync (T024), full test suite (T025-T030).
