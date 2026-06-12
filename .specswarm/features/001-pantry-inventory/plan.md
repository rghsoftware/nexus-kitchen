# Implementation Plan: Pantry & Inventory

**Feature:** 001-pantry-inventory  
**Branch:** 001-pantry-inventory-what-s-on-hand-...  
**Parent branch:** worktree-feat+pantry-inventory  
**Status:** Planning complete  
**Spec:** [spec.md](./spec.md)

---

## Tech Stack Compliance Report

### ✅ Approved Technologies (already in stack)

- SvelteKit (Svelte 5 runes) — UI components, routing, stores
- TypeScript ^6.0.2 — all source code
- @supabase/supabase-js ^2.107.0 — CRUD, Realtime, Storage
- Tailwind CSS v4 + design tokens — styling
- Vitest — unit tests
- Playwright — e2e tests
- Browser BarcodeDetector API — barcode scanning (FR-PI-002)
- Supabase Cron → Pushover — expiration alerts (FR-PI-007, FR-PM-006)

### ➕ New Technologies (auto-added)

_None required — all functionality is covered by the approved stack._

### ❌ Prohibited Technologies

_None introduced by this plan._

---

## Constitution Check

| Principle                               | Status  | Notes                                                                                        |
| --------------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| P1. SPA only — no SSR                   | ✅ Pass | All data access via supabase-js client; no server load functions                             |
| P2. No +server.ts files                 | ✅ Pass | No server endpoints needed; PostgREST handles CRUD                                           |
| P3. Svelte 5 runes mode                 | ✅ Pass | All components use `$state`, `$derived`, `$effect`, `$props`                                 |
| P4. Design tokens only                  | ✅ Pass | All styles via `var(--token)` / `.nk-*`; no raw hex in components                            |
| P5. No {@html}                          | ✅ Pass | No raw HTML rendering; all output uses Svelte escaping                                       |
| P6. Service-role key server-only        | ✅ Pass | Only anon key in client; barcode/AI lookups go through Edge Functions                        |
| P7. RLS enabled default-deny            | ✅ Pass | All three tables (`pantry_items`, `prepped_meals`, `portion_events`) get RLS before exposure |
| P8. UUID primary keys                   | ✅ Pass | All PKs are `uuid default gen_random_uuid()`                                                 |
| P9. timestamptz in UTC                  | ✅ Pass | All timestamp columns use `timestamptz`                                                      |
| P10. Parameterized queries              | ✅ Pass | supabase-js PostgREST; no string-concatenated SQL                                            |
| P11. AI output untrusted                | ✅ Pass | AI photo recognition goes through Edge Function; output validated before persistence         |
| P12. Every test asserts                 | ✅ Pass | `expect.requireAssertions` enforced in vitest config                                         |
| P13. No clinical labels in UI           | ✅ Pass | Visual pantry grid framed as UX aid, never labeled "ADHD feature"                            |
| P14. Append-only records                | ✅ Pass | `portion_events` is append-only; corrections create ADJUSTED events, never overwrite         |
| P15. Online-first, server authoritative | ✅ Pass | Optimistic UI with server reconciliation; Realtime is best-effort                            |

---

## Technical Context

### Architecture

- **Client:** SvelteKit SPA (`adapter-static`). Client data access exclusively via `src/lib/supabaseClient.ts` (anon key). No `+*.server.*` files.
- **Backend:** Supabase managed project — PostgreSQL + RLS, Realtime, Storage (item photos), Edge Functions (barcode lookup, AI photo recognition).
- **State:** Svelte 5 rune-based stores (`$state` in module context), optimistic updates, server reconciliation. Realtime subscriptions for household pantry changes.
- **Data flow:** `supabase-js` → PostgREST → PostgreSQL (with RLS). Realtime channel for `pantry_items` and `prepped_meals` tables (household-scoped).

### Database Tables

Three new tables (in `supabase/migrations/`):

1. **`pantry_items`** — raw ingredient stocks; `household_id` nullable; RLS: owner or household member.
2. **`prepped_meals`** — ready-to-eat portions; `household_id` nullable; RLS: owner or household member.
3. **`portion_events`** — append-only ledger for portion changes; RLS: owner or household member.

All tables: UUID PK, `timestamptz` timestamps, RLS enabled default-deny.

### File Structure

```
src/
  lib/
    pantry/
      pantryStore.svelte.ts         ← $state store: pantry items + realtime
      preppedMealStore.svelte.ts    ← $state store: prepped meals + realtime
      pantryService.ts              ← supabase CRUD functions
      preppedMealService.ts         ← supabase CRUD functions
      portionLedger.ts              ← portion event write helpers
      inventorySnapshot.ts          ← stub: getInventorySnapshot() for fulfillment
      shoppingListIntegration.ts    ← stub: addPantryItemsFromShoppingList()
      types.ts                      ← TypeScript types (mirrors DB schema)
    components/pantry/
      PantryTab.svelte              ← tab root / router
      PantryOverview.svelte         ← grid + alerts overview
      PantryItemCard.svelte         ← single pantry item card (photo, expiry, qty)
      PantryItemForm.svelte         ← add/edit form (manual + barcode + photo)
      PreppedMealOverview.svelte    ← prepped meal list
      PreppedMealCard.svelte        ← single prepped meal card (portions, defrost)
      PreppedMealForm.svelte        ← add/edit/correct form
      ExpiryAlertShelf.svelte       ← expiring soon + running low banners
      PortionEditor.svelte          ← consume / correct portions UI
      BarcodeScanner.svelte         ← BarcodeDetector API + fallback
supabase/
  migrations/
    20260609_001_pantry_items.sql
    20260609_002_prepped_meals.sql
    20260609_003_portion_events.sql
```

### Key Patterns

- **Optimistic UI:** local `$state` updated immediately on write, rolled back on supabase error.
- **Realtime:** subscribe to `pantry_items` + `prepped_meals` changes on the household channel; re-fetch on reconnect (best-effort per P15).
- **Photo upload:** client-side resize → Supabase Storage bucket `pantry-photos`. `photoUrl` stored in DB after upload completes.
- **Barcode scan:** `BarcodeDetector` (with JS library fallback for Firefox) → Edge Function `barcode-lookup` → pre-fills form fields.
- **Portion ledger:** every portion change is an INSERT to `portion_events`. `portionsRemaining` on `prepped_meals` is updated in the same transaction via a Postgres trigger (or transactional client call).

---

## Phase 0: Research

> Status: Complete (corpus-derived; all decisions are canonical).

### Decision: Prepped-meal portion consistency strategy

- **Decision:** Postgres trigger on `portion_events` INSERT updates `prepped_meals.portions_remaining` atomically. The trigger rejects deltas that would produce a negative result (enforcing INV-INV-004).
- **Rationale:** Keeps the denormalized `portions_remaining` read-ahead consistent without a round-trip from the client. Avoids race conditions from concurrent household member consumption.
- **Alternative considered:** Client-side optimistic update + server reconciliation only. Rejected: concurrent edits from two household members could both read stale `portionsRemaining` and both succeed, creating a negative balance.

### Decision: Realtime scope for household pantry sync

- **Decision:** Subscribe to `postgres_changes` on `pantry_items` and `prepped_meals` filtered by `household_id = current_household_id`. Re-fetch full list on reconnect.
- **Rationale:** Supabase Realtime `postgres_changes` is the simplest path; best-effort per ADR-0002. No conflict-resolution engine needed.

### Decision: BarcodeDetector API + fallback

- **Decision:** Use `BarcodeDetector` (Chrome/Edge/Safari) with a dynamically-imported JS fallback for Firefox. Barcode data is sent to a Supabase Edge Function `barcode-lookup` which calls OpenFoodFacts or a similar free barcode DB (REQ-IN-004/005). On failure, falls back to manual entry.
- **Rationale:** Approved library (`Browser BarcodeDetector API`) per tech-stack.md. No new dependency needed.

### Decision: Ingredient linking strategy (FR-PI-010)

- **Decision:** Defer `ingredientId` linking for this build. Pantry items store a free-text `name`; the ingredient master table does not yet exist. When the Recipes feature adds the master table, a migration can backfill `ingredient_id` via name matching. The `ingredient_id` column is added to the schema as nullable from the start so it's a non-breaking migration later.
- **Rationale:** `CAN_MAKE_IT` fulfillment computation is deferred (clarification 2026-06-09). No value in building the master-ingredient join now.

---

## Phase 1: Design & Contracts

### Data Model

See [data-model.md](./data-model.md) (generated below).

### API Contracts

All CRUD via supabase-js PostgREST. No custom endpoints needed for this feature. Stub interfaces documented in `contracts/`.

See [contracts/](./contracts/).

---

## Implementation Phases

### Phase A: Database (do first — everything depends on schema)

**A1. Migration — `pantry_items`**  
Create `supabase/migrations/20260609_001_pantry_items.sql`:

- Table with all fields from domain spec §2.3 PantryItem
- UUID PK, `timestamptz` timestamps
- RLS enabled, default deny
- Policies: owner (`user_id = auth.uid()`) or household member (subquery against `household_members`)
- Storage location enum type
- Computed columns as generated columns: `is_running_low`, `is_expiring_soon`, `is_expired`

**A2. Migration — `prepped_meals`**  
Create `supabase/migrations/20260609_002_prepped_meals.sql`:

- Table with all fields from domain spec §2.3 PreppedMeal
- UUID PK, `timestamptz` timestamps
- RLS enabled, default deny
- Same household-aware policy pattern
- Defrost state enum type
- Prepped meal origin enum type

**A3. Migration — `portion_events` + trigger**  
Create `supabase/migrations/20260609_003_portion_events.sql`:

- Append-only ledger table (INV-INV-010/011)
- Postgres trigger: `after insert on portion_events → update prepped_meals.portions_remaining`
- Trigger enforces: new `portions_remaining` ≥ 0 (rejects INSERT if it would go negative)
- Trigger enforces: positive delta only for `kind = 'ADJUSTED'`
- RLS: INSERT-only for authenticated users; SELECT for owner/household member

**A4. TypeScript types**  
Run `bun run db:types` (which runs `supabase gen types`) to generate `src/lib/database.types.ts`. Then write `src/lib/pantry/types.ts` with domain-aligned aliases.

### Phase B: Service Layer

**B1. `pantryService.ts`**  
CRUD functions wrapping supabase-js:

- `getPantryItems(householdId?)` — fetch with order by `storage_location, name`
- `addPantryItem(item)` — INSERT with optimistic return
- `updatePantryItem(id, changes)` — UPDATE
- `deletePantryItem(id)` — DELETE
- `uploadPantryPhoto(itemId, file)` — Supabase Storage upload → returns URL

**B2. `preppedMealService.ts`**

- `getPreppedMeals(householdId?)` — fetch ordered by `expiration_date asc`
- `addPreppedMeal(meal)` — INSERT + initial INITIALIZED PortionEvent
- `updatePreppedMeal(id, changes)` — UPDATE (non-portion fields)
- `consumePortions(preppedMealId, count)` — INSERT CONSUMED PortionEvent
- `correctPortions(preppedMealId, newCount)` — INSERT ADJUSTED PortionEvent
- `startDefrost(preppedMealId)` — UPDATE defrost_state, defrost_started_at
- `markDefrostReady(preppedMealId)` — UPDATE defrost_state = READY

**B3. `portionLedger.ts`**  
Low-level PortionEvent INSERT helpers (called by `preppedMealService.ts`).

**B4. Stub interfaces**

- `inventorySnapshot.ts` — exports `getInventorySnapshot(): InventorySnapshot`; returns `{ pantryItems: PantryItem[], preppedMeals: PreppedMeal[] }` from local store state. Stub body calls the store getters.
- `shoppingListIntegration.ts` — exports `addPantryItemsFromShoppingList(items: ShoppingListItem[]): Promise<void>`; no-op stub body, correct TypeScript signature.

### Phase C: State Layer

**C1. `pantryStore.svelte.ts`**  
Svelte 5 module-level `$state` store:

- `pantryItems: PantryItem[]` (reactive list)
- `loadPantryItems()`, `optimisticAdd()`, `optimisticUpdate()`, `optimisticDelete()`
- Realtime subscription setup (`subscribeToHouseholdChanges()`)
- Derived: `expiringSoon`, `runningLow` (filtered views via `$derived`)

**C2. `preppedMealStore.svelte.ts`**  
Same pattern:

- `preppedMeals: PreppedMeal[]`
- `loadPreppedMeals()`, optimistic ops, Realtime subscription
- Derived: `expiringSoon`, `readyToEat` (filtered views)

### Phase D: UI Components

**D1. Route wiring**  
Add `src/routes/(app)/pantry/+page.svelte` that renders `PantryTab`. Update root layout nav to include Pantry tab (bottom navigation, per domain spec §4.2).

**D2. `PantryOverview.svelte`**  
Main pantry screen:

- Tab bar: All / Fridge / Freezer / Pantry (filters store list)
- `ExpiryAlertShelf` at top when items present
- Visual grid of `PantryItemCard` + `PreppedMealCard`
- "+ Add" FAB / button

**D3. `ExpiryAlertShelf.svelte`**

- "Expiring Soon" horizontal scroll (pantry items within 7 days, prepped meals within 2 days)
- "Running Low" text list with "Add to Shopping List" CTA (stub — calls shopping list stub)

**D4. `PantryItemCard.svelte`**

- Photo thumbnail (placeholder if none)
- Name, quantity + unit, location badge
- Expiry badge (color: warning if expiring soon, error if expired — design tokens)
- Running low badge
- Tap → PantryItemForm in edit mode

**D5. `PantryItemForm.svelte`**

- Add/Edit modal or slide panel
- Fields: name, quantity, unit, location, expiry, purchase date, min quantity, photo
- Barcode scan trigger → `BarcodeScanner`
- Photo capture trigger → file input / camera
- Default expiry suggestion on location change (per FR-PI-009)
- Validation against INV-INV-001/002/003

**D6. `BarcodeScanner.svelte`**

- Camera stream via `getUserMedia`
- `BarcodeDetector` scan loop; JS fallback for unsupported browsers
- On detect: emit barcode value; parent calls Edge Function lookup to pre-fill

**D7. `PreppedMealOverview.svelte`**

- "Eat this first" ordered list (by expiry)
- List of `PreppedMealCard`

**D8. `PreppedMealCard.svelte`**

- Photo, name, origin badge (made / bought / session)
- Portions remaining badge
- Expiry indicator
- Defrost status (if frozen/defrosting)
- Quick actions: consume 1 portion, start defrost

**D9. `PreppedMealForm.svelte`**

- Add/Edit modal
- Fields: name, origin (made/bought), recipe link (optional), portions, date, location, shelf-life override
- Default shelf life on location change (Fridge: 4 days, Freezer: 90 days per FR-PM-009)

**D10. `PortionEditor.svelte`**

- Consume N portions (CONSUMED event)
- Correct total (ADJUSTED event) — visually distinct from consume
- Disable consume if 0 portions remaining

### Phase E: Tests

**E1. Unit tests — service layer**  
`src/lib/pantry/pantryService.spec.ts`, `preppedMealService.spec.ts`:

- Mock supabase-js client
- Test CRUD operations, error handling
- Test optimistic rollback path

**E2. Unit tests — portion ledger invariants**  
`src/lib/pantry/portionLedger.spec.ts`:

- INV-INV-004: reject consume if would go negative
- INV-INV-010: delta non-zero
- INV-INV-011: positive delta only for ADJUSTED kind

**E3. Component tests (vitest browser)**  
`PantryItemCard.svelte.spec.ts`, `PreppedMealCard.svelte.spec.ts`:

- Renders with photo and without
- Expiry badge shows correct state
- Portions badge reflects `portionsRemaining`

**E4. E2E tests (Playwright)**  
`tests/pantry.spec.ts`:

- Happy path: add pantry item manually, see it in grid
- Happy path: add prepped meal directly, see it in prepped list
- Happy path: consume 1 portion, count decrements
- Happy path: correct portion count, ADJUSTED event created
- Happy path: start defrost, status updates to DEFROSTING
- Edge: barcode scan pre-fills form (mocked)

---

## Out of Scope

The following are explicitly excluded from this build:

- Fulfillment computation (`CAN_MAKE_IT`/`HAVE_IT`/`MUST_ACQUIRE`) — deferred per clarification 2026-06-09; stub interface only
- Shopping list → pantry bulk-add active implementation — stub interface only (FR-PI-008)
- AI-powered photo recognition for item identification (FR-PI-003) — graceful degradation; manual entry fallback only
- Ingredient master table and `ingredient_id` linking — deferred until Recipes feature
- Meal prep session flow — separate feature; this build only handles direct-entry and store-bought `PreppedMeal`s
- Nutrition data for pantry items — requires Nutrition feature
- Per-ingredient-category shelf life overrides — hardcoded by storage location only
- Barcode lookup Edge Function implementation — defined as approved but implementation deferred; scan UI returns raw barcode value; lookup stub

---

## Definition of Done

- [ ] All three DB migrations applied; `bun run db:types` regenerates `database.types.ts`
- [ ] RLS policies: no row accessible without auth; household members can read/write household pantry
- [ ] All functional requirements FR-PI-001 through FR-PI-011 implemented (FR-PI-008 as stub)
- [ ] All functional requirements FR-PM-001 through FR-PM-009 implemented
- [ ] FR-PM-004a: portion correction creates ADJUSTED PortionEvent, not direct update
- [ ] FR-FC-003: `getInventorySnapshot()` stub exported and typed
- [ ] FR-PI-008: `addPantryItemsFromShoppingList()` stub exported and typed
- [ ] All invariants INV-INV-001 through INV-INV-011 enforced (DB trigger for portion ledger)
- [ ] Success criteria met: 3-tap add, 500ms load, 300ms fulfillment recompute (stub), 2s Realtime
- [ ] `bun run check` passes (no type errors)
- [ ] `bun run lint` passes
- [ ] All vitest unit tests pass with `expect.requireAssertions`
- [ ] Playwright e2e tests pass for happy paths and edge cases listed above
- [ ] No raw hex colors in Svelte components; all styles use design tokens
- [ ] No `{@html}` in any component
- [ ] No `+*.server.*` files added
