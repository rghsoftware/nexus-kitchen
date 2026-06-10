-- Migration: portion_events
-- Feature: 001-pantry-inventory
-- Append-only ledger for prepped meal portion changes (P14, INV-INV-010/011).
-- A Postgres trigger keeps prepped_meals.portions_remaining + original_portions
-- consistent with the ledger on every INSERT.

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
CREATE TYPE portion_event_kind AS ENUM ('INITIALIZED', 'CONSUMED', 'ADJUSTED');

-- ---------------------------------------------------------------------------
-- Table: portion_events (append-only — no UPDATE/DELETE RLS policies)
-- ---------------------------------------------------------------------------
CREATE TABLE portion_events (
	id               uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
	prepped_meal_id  uuid              NOT NULL REFERENCES prepped_meals(id) ON DELETE CASCADE,
	delta_portions   integer           NOT NULL CHECK (delta_portions != 0),   -- INV-INV-010
	kind             portion_event_kind NOT NULL,
	triggered_by     uuid,                                                      -- MealLog.id (future)
	created_at       timestamptz       NOT NULL DEFAULT now(),

	-- INV-INV-011: positive delta only for ADJUSTED kind
	CONSTRAINT portion_events_positive_delta_only_adjusted
		CHECK (delta_portions <= 0 OR kind = 'ADJUSTED')
);

CREATE INDEX portion_events_prepped_meal_id_idx ON portion_events (prepped_meal_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security (P7, P14: append-only)
-- ---------------------------------------------------------------------------
ALTER TABLE portion_events ENABLE ROW LEVEL SECURITY;

-- INSERT: authenticated user who can access the parent prepped_meal
CREATE POLICY "portion_events_insert"
	ON portion_events FOR INSERT
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM prepped_meals pm
			WHERE pm.id = prepped_meal_id
			  AND pm.owner_id = auth.uid()
		)
	);

-- SELECT: same access as parent prepped_meal
CREATE POLICY "portion_events_select"
	ON portion_events FOR SELECT
	USING (
		EXISTS (
			SELECT 1 FROM prepped_meals pm
			WHERE pm.id = prepped_meal_id
			  AND pm.owner_id = auth.uid()
		)
	);

-- No UPDATE or DELETE policies — append-only (P14).

-- ---------------------------------------------------------------------------
-- Trigger: sync prepped_meals after portion_event INSERT
--
-- For CONSUMED / INITIALIZED: only portions_remaining changes.
-- For ADJUSTED: both portions_remaining AND original_portions change by the
--   delta, so that original_portions always tracks the "authoritative total"
--   and the invariant remaining <= original is preserved.
--
-- Raises an exception if the resulting portions_remaining would be negative
-- (INV-INV-004).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_portions_remaining()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
	new_remaining  integer;
	new_original   integer;
BEGIN
	IF NEW.kind = 'ADJUSTED' THEN
		-- Upward correction: raise both columns atomically
		UPDATE prepped_meals
		SET portions_remaining = portions_remaining + NEW.delta_portions,
		    original_portions  = original_portions  + NEW.delta_portions,
		    updated_at         = now()
		WHERE id = NEW.prepped_meal_id
		RETURNING portions_remaining, original_portions
		INTO new_remaining, new_original;
	ELSE
		-- CONSUMED or INITIALIZED: only remaining changes
		UPDATE prepped_meals
		SET portions_remaining = portions_remaining + NEW.delta_portions,
		    updated_at         = now()
		WHERE id = NEW.prepped_meal_id
		RETURNING portions_remaining, original_portions
		INTO new_remaining, new_original;
	END IF;

	-- INV-INV-004: ledger must never produce a negative balance
	IF new_remaining < 0 THEN
		RAISE EXCEPTION 'INV-INV-004: portions_remaining cannot be negative (would be %)', new_remaining
			USING ERRCODE = 'check_violation';
	END IF;

	RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_portions_remaining
	AFTER INSERT ON portion_events
	FOR EACH ROW EXECUTE FUNCTION sync_portions_remaining();
