-- Migration: pantry_items
-- Feature: 001-pantry-inventory
-- Note: household_id is a plain nullable uuid (no FK) until the Identity/Household
-- feature lands. Household-member RLS policies will be added at that point.

-- ---------------------------------------------------------------------------
-- Enum: storage_location
-- ---------------------------------------------------------------------------
CREATE TYPE storage_location AS ENUM ('PANTRY', 'FRIDGE', 'FREEZER', 'OTHER');

-- ---------------------------------------------------------------------------
-- Table: pantry_items
-- ---------------------------------------------------------------------------
CREATE TABLE pantry_items (
	id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	owner_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	household_id      uuid,                                         -- no FK until Household feature
	ingredient_id     uuid,                                         -- nullable; linked when Recipes feature adds master table

	-- Item identification
	name              text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
	barcode           text,

	-- Quantity
	quantity          numeric(10, 3) NOT NULL DEFAULT 0 CHECK (quantity >= 0), -- INV-INV-001
	unit              text        NOT NULL,
	minimum_quantity  numeric(10, 3)          CHECK (minimum_quantity >= 0),   -- INV-INV-002

	-- Storage
	storage_location  storage_location NOT NULL DEFAULT 'PANTRY',
	custom_location   text,

	-- Freshness
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

-- Indexes
CREATE INDEX pantry_items_owner_id_idx        ON pantry_items (owner_id);
CREATE INDEX pantry_items_household_id_idx    ON pantry_items (household_id);
CREATE INDEX pantry_items_expiration_date_idx ON pantry_items (expiration_date);

-- ---------------------------------------------------------------------------
-- Row-Level Security (P7: enabled, default-deny)
-- ---------------------------------------------------------------------------
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;

-- Owner policy: full access to own items
CREATE POLICY "pantry_items_owner_all"
	ON pantry_items FOR ALL
	USING (owner_id = auth.uid())
	WITH CHECK (owner_id = auth.uid());

-- TODO (Identity feature): add household-member policy once household_members table exists:
-- CREATE POLICY "pantry_items_household_member" ON pantry_items FOR ALL
--   USING (household_id IS NOT NULL AND EXISTS (
--     SELECT 1 FROM household_members
--     WHERE household_id = pantry_items.household_id AND user_id = auth.uid()
--   ));

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE pantry_items;

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pantry_items_updated_at
	BEFORE UPDATE ON pantry_items
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
