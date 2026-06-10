-- Migration: prepped_meals
-- Feature: 001-pantry-inventory
-- Note: household_id is a plain nullable uuid (no FK) until the Identity feature lands.
-- Note: original_portions is updated alongside portions_remaining on ADJUSTED events
--       (see portion_events trigger in migration 003). The CHECK
--       portions_remaining <= original_portions is intentionally omitted: an upward
--       correction (FR-PM-004a) raises both fields atomically via the trigger,
--       so the invariant "remaining never exceeds original" is maintained by the
--       trigger, not a static CHECK constraint.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE prepped_meal_origin AS ENUM ('PREP_SESSION', 'DIRECT_ENTRY', 'STORE_BOUGHT');
CREATE TYPE defrost_state AS ENUM ('NOT_APPLICABLE', 'FROZEN', 'DEFROSTING', 'READY');

-- ---------------------------------------------------------------------------
-- Table: prepped_meals
-- ---------------------------------------------------------------------------
CREATE TABLE prepped_meals (
	id                   uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
	owner_id             uuid              NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	household_id         uuid,                                        -- no FK until Household feature

	-- Provenance
	origin               prepped_meal_origin NOT NULL,
	name                 text              NOT NULL CHECK (char_length(name) BETWEEN 1 AND 500),
	recipe_id            uuid,                                        -- nullable; linked when Recipes feature exists
	recipe_name          text,                                        -- denormalized; set iff recipe_id set
	meal_prep_session_id uuid,                                        -- nullable; set iff origin = PREP_SESSION

	-- Portions (INV-INV-004/005)
	portions_remaining   integer           NOT NULL CHECK (portions_remaining >= 0),  -- INV-INV-005
	original_portions    integer           NOT NULL CHECK (original_portions > 0),

	-- Storage
	storage_location     storage_location  NOT NULL,
	container_label      text,

	-- Dates (INV-INV-009: expiration_date > prepared_date)
	prepared_date        date              NOT NULL,
	expiration_date      date              NOT NULL,

	-- Defrost tracking (INV-INV-007/008)
	defrost_state        defrost_state     NOT NULL DEFAULT 'NOT_APPLICABLE',
	defrost_started_at   timestamptz,                                 -- set iff defrost_state = DEFROSTING
	estimated_ready_at   timestamptz,                                 -- defrost_started_at + 24h

	-- Visual
	photo_url            text,

	-- Audit
	created_at           timestamptz       NOT NULL DEFAULT now(),
	updated_at           timestamptz       NOT NULL DEFAULT now(),

	-- Constraints
	CONSTRAINT prepped_meals_expiration_after_prepared
		CHECK (expiration_date > prepared_date),              -- INV-INV-009
	CONSTRAINT prepped_meals_defrosting_requires_started_at
		CHECK (defrost_state != 'DEFROSTING' OR defrost_started_at IS NOT NULL)  -- INV-INV-008
);

-- Indexes
CREATE INDEX prepped_meals_owner_id_idx        ON prepped_meals (owner_id);
CREATE INDEX prepped_meals_household_id_idx    ON prepped_meals (household_id);
CREATE INDEX prepped_meals_expiration_date_idx ON prepped_meals (expiration_date);

-- ---------------------------------------------------------------------------
-- Row-Level Security (P7)
-- ---------------------------------------------------------------------------
ALTER TABLE prepped_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prepped_meals_owner_all"
	ON prepped_meals FOR ALL
	USING (owner_id = auth.uid())
	WITH CHECK (owner_id = auth.uid());

-- TODO (Identity feature): add household-member policy once household_members exists.

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE prepped_meals;

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuse function from migration 001)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_prepped_meals_updated_at
	BEFORE UPDATE ON prepped_meals
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
