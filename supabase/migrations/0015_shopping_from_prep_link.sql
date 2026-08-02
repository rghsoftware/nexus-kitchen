-- Migration: shopping_lists.meal_prep_session_id + FROM_PREP integrity
-- Feature: 006-meal-prep
-- Adds the session link for FROM_PREP shopping lists and enforces INV-XD-004
-- (a FROM_PREP list references a valid meal_prep_session; non-FROM_PREP lists do not).
-- The 'FROM_PREP' enum value is added separately in migration 0010 (committed first).

ALTER TABLE shopping_lists
	ADD COLUMN meal_prep_session_id uuid REFERENCES meal_prep_sessions(id) ON DELETE SET NULL;

CREATE INDEX shopping_lists_meal_prep_session_id_idx
	ON shopping_lists (meal_prep_session_id);

-- INV-XD-004: FROM_PREP ⇔ session reference present (explicit OR form so NULL passes
-- through and a non-FROM_PREP list can never carry a stray session id).
ALTER TABLE shopping_lists
	ADD CONSTRAINT shopping_lists_from_prep_has_session CHECK (
		(source_type =  'FROM_PREP' AND meal_prep_session_id IS NOT NULL) OR
		(source_type <> 'FROM_PREP' AND meal_prep_session_id IS NULL)
	);

-- ---------------------------------------------------------------------------
-- Detach-on-session-delete.
-- The FK above is ON DELETE SET NULL, but nulling meal_prep_session_id on a row that is
-- still source_type='FROM_PREP' would violate the CHECK above — so deleting a session that
-- generated a shopping list would otherwise abort (and break the auth.users delete cascade).
-- A FROM_PREP list is the user's work product and should outlive its planning session, so on
-- session delete we detach the list to a plain MANUAL list (BEFORE the FK action fires).
-- ---------------------------------------------------------------------------
-- search_path is pinned per lint 0011 (see 0011_security_advisor_fixes): CREATE OR
-- REPLACE silently discards any attribute the new definition omits, so it must be
-- restated here rather than inherited.
CREATE OR REPLACE FUNCTION public.detach_prep_shopping_lists()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
	UPDATE shopping_lists
	SET source_type = 'MANUAL', meal_prep_session_id = NULL
	WHERE meal_prep_session_id = OLD.id;
	RETURN OLD;
END;
$$;

CREATE TRIGGER trg_detach_prep_shopping_lists
	BEFORE DELETE ON meal_prep_sessions
	FOR EACH ROW EXECUTE FUNCTION detach_prep_shopping_lists();
