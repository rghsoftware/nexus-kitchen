# Data Model: Pantry & Inventory

**Feature:** 001-pantry-inventory  
**Source:** domain spec §2.3 + invariants §1.3 + clarifications 2026-06-09

---

## Enums

```sql
-- Storage location with default shelf lives
CREATE TYPE storage_location AS ENUM ('PANTRY', 'FRIDGE', 'FREEZER', 'OTHER');
-- Default shelf lives: PANTRY=365d, FRIDGE=7d, FREEZER=90d, OTHER=30d

CREATE TYPE defrost_state AS ENUM ('NOT_APPLICABLE', 'FROZEN', 'DEFROSTING', 'READY');

CREATE TYPE prepped_meal_origin AS ENUM ('PREP_SESSION', 'DIRECT_ENTRY', 'STORE_BOUGHT');

CREATE TYPE portion_event_kind AS ENUM ('INITIALIZED', 'CONSUMED', 'ADJUSTED');
```

---

## Table: `pantry_items`

Tracks raw ingredient stocks (INV-INV-001 through INV-INV-003).

```sql
CREATE TABLE pantry_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id      uuid REFERENCES households(id) ON DELETE SET NULL,

  -- Item identification
  ingredient_id     uuid,                          -- nullable; linked when master table exists
  name              text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  barcode           text,

  -- Quantity (INV-INV-001: quantity >= 0)
  quantity          numeric(10,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit              text NOT NULL,
  minimum_quantity  numeric(10,3) CHECK (minimum_quantity >= 0),  -- INV-INV-002

  -- Storage
  storage_location  storage_location NOT NULL DEFAULT 'PANTRY',
  custom_location   text,

  -- Freshness (INV-INV-003: expiration not > 30d before created_at)
  purchase_date     date,
  expiration_date   date,
  opened_date       date,

  -- Visual
  photo_url         text,
  thumbnail_url     text,

  -- Audit
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Computed columns (as expressions in queries; or generated columns if PG version supports it)
-- is_running_low  = quantity <= minimum_quantity (when minimum_quantity IS NOT NULL)
-- is_expiring_soon = expiration_date <= CURRENT_DATE + 7
-- is_expired       = expiration_date < CURRENT_DATE

-- Indexes
CREATE INDEX pantry_items_owner_id_idx ON pantry_items(owner_id);
CREATE INDEX pantry_items_household_id_idx ON pantry_items(household_id);
CREATE INDEX pantry_items_expiration_date_idx ON pantry_items(expiration_date);
```

### RLS Policies

```sql
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;

-- Owner policy
CREATE POLICY "pantry_items_owner" ON pantry_items
  FOR ALL USING (owner_id = auth.uid());

-- Household member policy (read + write for household-scoped items)
CREATE POLICY "pantry_items_household_member" ON pantry_items
  FOR ALL USING (
    household_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_members.household_id = pantry_items.household_id
        AND household_members.user_id = auth.uid()
    )
  );
```

---

## Table: `prepped_meals`

Tracks ready-to-eat portions (INV-INV-004 through INV-INV-009).

```sql
CREATE TABLE prepped_meals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id          uuid REFERENCES households(id) ON DELETE SET NULL,

  -- Provenance
  origin                prepped_meal_origin NOT NULL,
  name                  text NOT NULL CHECK (length(name) BETWEEN 1 AND 500),
  recipe_id             uuid,                           -- nullable; valid only for PREP_SESSION/DIRECT_ENTRY with recipe
  recipe_name           text,                           -- denormalized; set iff recipe_id set
  meal_prep_session_id  uuid,                           -- nullable; set iff origin = PREP_SESSION

  -- Portions (INV-INV-004/005)
  portions_remaining    integer NOT NULL CHECK (portions_remaining >= 0),
  original_portions     integer NOT NULL CHECK (original_portions > 0),

  -- Storage
  storage_location      storage_location NOT NULL,
  container_label       text,

  -- Dates (INV-INV-009: expiration_date > prepared_date)
  prepared_date         date NOT NULL,
  expiration_date       date NOT NULL,

  -- Defrost tracking (INV-INV-007/008)
  defrost_state         defrost_state NOT NULL DEFAULT 'NOT_APPLICABLE',
  defrost_started_at    timestamptz,                    -- set iff defrost_state = DEFROSTING
  estimated_ready_at    timestamptz,                    -- computed from defrost_started_at + 24h

  -- Visual
  photo_url             text,

  -- Audit
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT expiration_after_prepared
    CHECK (expiration_date > prepared_date),            -- INV-INV-009
  CONSTRAINT portions_not_exceed_original
    CHECK (portions_remaining <= original_portions),    -- INV-INV-004
  CONSTRAINT defrosting_requires_started_at
    CHECK (defrost_state != 'DEFROSTING' OR defrost_started_at IS NOT NULL)  -- INV-INV-008
);

-- Computed (in queries):
-- is_expiring_soon = expiration_date <= CURRENT_DATE + 2
-- is_expired       = expiration_date < CURRENT_DATE
-- is_ready_to_eat  = defrost_state IN ('NOT_APPLICABLE', 'READY')

-- Indexes
CREATE INDEX prepped_meals_owner_id_idx ON prepped_meals(owner_id);
CREATE INDEX prepped_meals_household_id_idx ON prepped_meals(household_id);
CREATE INDEX prepped_meals_expiration_date_idx ON prepped_meals(expiration_date);
```

### RLS Policies

```sql
ALTER TABLE prepped_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prepped_meals_owner" ON prepped_meals
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "prepped_meals_household_member" ON prepped_meals
  FOR ALL USING (
    household_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_members.household_id = prepped_meals.household_id
        AND household_members.user_id = auth.uid()
    )
  );
```

---

## Table: `portion_events`

Append-only ledger for prepped meal portion changes (INV-INV-010/011; P14).

```sql
CREATE TABLE portion_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prepped_meal_id  uuid NOT NULL REFERENCES prepped_meals(id) ON DELETE CASCADE,
  delta_portions   integer NOT NULL CHECK (delta_portions != 0),  -- INV-INV-010
  kind             portion_event_kind NOT NULL,
  triggered_by     uuid,    -- MealLog.id if kind = CONSUMED from a meal log
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- INV-INV-011: positive delta only for ADJUSTED kind
  CONSTRAINT positive_delta_only_adjusted
    CHECK (delta_portions <= 0 OR kind = 'ADJUSTED')
);

-- Index for ledger queries
CREATE INDEX portion_events_prepped_meal_id_idx ON portion_events(prepped_meal_id);
```

### Trigger: Sync `portions_remaining`

```sql
-- After INSERT on portion_events, update prepped_meals.portions_remaining atomically
-- and reject if result would be negative.
CREATE OR REPLACE FUNCTION sync_portions_remaining()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE prepped_meals
  SET portions_remaining = portions_remaining + NEW.delta_portions,
      updated_at = now()
  WHERE id = NEW.prepped_meal_id
  RETURNING portions_remaining INTO new_count;

  IF new_count < 0 THEN
    RAISE EXCEPTION 'INV-INV-004: portions_remaining cannot be negative (would be %)', new_count;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_portions_remaining
  AFTER INSERT ON portion_events
  FOR EACH ROW EXECUTE FUNCTION sync_portions_remaining();
```

### RLS Policies

```sql
ALTER TABLE portion_events ENABLE ROW LEVEL SECURITY;

-- Insert: any authenticated user who can access the parent prepped_meal
CREATE POLICY "portion_events_insert" ON portion_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM prepped_meals pm
      WHERE pm.id = prepped_meal_id
        AND (pm.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM household_members hm
          WHERE hm.household_id = pm.household_id
            AND hm.user_id = auth.uid()
        ))
    )
  );

-- Select: same access as parent prepped_meal
CREATE POLICY "portion_events_select" ON portion_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM prepped_meals pm
      WHERE pm.id = prepped_meal_id
        AND (pm.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM household_members hm
          WHERE hm.household_id = pm.household_id
            AND hm.user_id = auth.uid()
        ))
    )
  );
-- No UPDATE or DELETE policies — append-only (P14)
```

---

## TypeScript Types (`src/lib/pantry/types.ts`)

```typescript
export type StorageLocation = 'PANTRY' | 'FRIDGE' | 'FREEZER' | 'OTHER';
export type DefrostState = 'NOT_APPLICABLE' | 'FROZEN' | 'DEFROSTING' | 'READY';
export type PreppedMealOrigin = 'PREP_SESSION' | 'DIRECT_ENTRY' | 'STORE_BOUGHT';
export type PortionEventKind = 'INITIALIZED' | 'CONSUMED' | 'ADJUSTED';

export interface PantryItem {
	id: string;
	ownerId: string;
	householdId: string | null;
	ingredientId: string | null;
	name: string;
	barcode: string | null;
	quantity: number;
	unit: string;
	minimumQuantity: number | null;
	storageLocation: StorageLocation;
	customLocation: string | null;
	purchaseDate: string | null; // ISO date string
	expirationDate: string | null; // ISO date string
	openedDate: string | null; // ISO date string
	photoUrl: string | null;
	thumbnailUrl: string | null;
	createdAt: string; // ISO timestamptz
	updatedAt: string; // ISO timestamptz
	// Derived (computed client-side)
	isRunningLow: boolean;
	isExpiringSoon: boolean;
	isExpired: boolean;
}

export interface PreppedMeal {
	id: string;
	ownerId: string;
	householdId: string | null;
	origin: PreppedMealOrigin;
	name: string;
	recipeId: string | null;
	recipeName: string | null;
	mealPrepSessionId: string | null;
	portionsRemaining: number;
	originalPortions: number;
	storageLocation: StorageLocation;
	containerLabel: string | null;
	preparedDate: string; // ISO date string
	expirationDate: string; // ISO date string
	defrostState: DefrostState;
	defrostStartedAt: string | null; // ISO timestamptz
	estimatedReadyAt: string | null; // ISO timestamptz
	photoUrl: string | null;
	createdAt: string;
	updatedAt: string;
	// Derived (computed client-side)
	isExpiringSoon: boolean;
	isExpired: boolean;
	isReadyToEat: boolean;
}

export interface PortionEvent {
	id: string;
	preppedMealId: string;
	deltaPortions: number;
	kind: PortionEventKind;
	triggeredBy: string | null;
	createdAt: string;
}

/** Snapshot returned by the fulfillment stub for downstream Planning feature */
export interface InventorySnapshot {
	pantryItems: PantryItem[];
	preppedMeals: PreppedMeal[];
	snapshotAt: string; // ISO timestamptz
}

/** Passed to the shopping list integration stub */
export interface ShoppingListItem {
	id: string;
	name: string;
	quantity: number;
	unit: string;
	storageLocation?: StorageLocation;
}

/** Default shelf life in days by storage location */
export const DEFAULT_SHELF_LIFE_DAYS: Record<StorageLocation, number> = {
	PANTRY: 365,
	FRIDGE: 7,
	FREEZER: 90,
	OTHER: 30
};

/** Default prepped meal shelf life in days by storage location */
export const PREPPED_SHELF_LIFE_DAYS: Record<'FRIDGE' | 'FREEZER', number> = {
	FRIDGE: 4,
	FREEZER: 90
};
```

---

## Invariant Enforcement Summary

| Invariant                                    | Enforcement location                                   |
| -------------------------------------------- | ------------------------------------------------------ |
| INV-INV-001: quantity ≥ 0                    | DB CHECK constraint                                    |
| INV-INV-002: min_quantity ≥ 0                | DB CHECK constraint                                    |
| INV-INV-003: expiry ≥ created_at − 30d       | Application-layer validation in form                   |
| INV-INV-004: ledger non-negative             | Postgres trigger `trg_sync_portions_remaining`         |
| INV-INV-005: portions_remaining ≥ 0          | DB CHECK constraint + trigger                          |
| INV-INV-006: recipe_id valid if set          | FK constraint (nullable)                               |
| INV-INV-007: FREEZER ↔ FROZEN                | Application-layer; enforced in `preppedMealService.ts` |
| INV-INV-008: DEFROSTING → FRIDGE + timestamp | DB CHECK `defrosting_requires_started_at`              |
| INV-INV-009: expiration > prepared           | DB CHECK `expiration_after_prepared`                   |
| INV-INV-010: delta ≠ 0                       | DB CHECK constraint                                    |
| INV-INV-011: positive delta = ADJUSTED only  | DB CHECK `positive_delta_only_adjusted`                |
