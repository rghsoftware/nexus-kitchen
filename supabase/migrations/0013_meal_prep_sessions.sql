-- Migration: meal_prep_sessions
-- Feature: 006-meal-prep
-- Batch meal-prep sessions: select recipes + servings, schedule a prep day, and on
-- completion yield PREP_SESSION-origin prepped_meals into inventory. Distribution into the
-- meal plan is deferred (yield-to-inventory-only). See features/006-meal-prep/data-model.md.
--
-- Note: household_id is a plain nullable uuid (no FK) until the Identity feature lands,
--       mirroring prepped_meals (migration 0003).
-- Note: INV-PL-006 (a session has >= 1 recipe) is a cross-row rule enforced in the service
--       layer (a session is created with its first recipe; removing the last recipe is
--       rejected) — a single-table CHECK cannot express it, same pattern as recipes (0001).

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
CREATE TYPE meal_prep_session_status AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');

-- ---------------------------------------------------------------------------
-- Table: meal_prep_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE meal_prep_sessions (
	id           uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
	owner_id     uuid                     NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
	household_id uuid,                                              -- no FK until Household feature

	status       meal_prep_session_status NOT NULL DEFAULT 'PLANNED',
	prep_day     date                     NOT NULL,                 -- suggested/overridden (REQ-PP-003/004)
	completed_at timestamptz,                                       -- set iff status = COMPLETED

	created_at   timestamptz              NOT NULL DEFAULT now(),
	updated_at   timestamptz              NOT NULL DEFAULT now(),

	-- INV-PL-008: a completed session has a completion timestamp, and only a completed one does
	CONSTRAINT meal_prep_sessions_completed_has_timestamp
		CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
);

CREATE INDEX meal_prep_sessions_owner_id_idx     ON meal_prep_sessions (owner_id);
CREATE INDEX meal_prep_sessions_household_id_idx ON meal_prep_sessions (household_id);
CREATE INDEX meal_prep_sessions_prep_day_idx     ON meal_prep_sessions (prep_day);

-- ---------------------------------------------------------------------------
-- Table: meal_prep_session_recipes
-- ---------------------------------------------------------------------------
CREATE TABLE meal_prep_session_recipes (
	id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
	meal_prep_session_id uuid    NOT NULL REFERENCES meal_prep_sessions(id) ON DELETE CASCADE,
	recipe_id            uuid    NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
	recipe_name          text    NOT NULL CHECK (char_length(recipe_name) BETWEEN 1 AND 500), -- denormalized snapshot
	servings_to_prep     integer NOT NULL CHECK (servings_to_prep > 0),                       -- INV-PL-007
	created_at           timestamptz NOT NULL DEFAULT now(),

	-- a recipe appears at most once per session
	CONSTRAINT meal_prep_session_recipes_unique UNIQUE (meal_prep_session_id, recipe_id)
);

CREATE INDEX meal_prep_session_recipes_session_id_idx ON meal_prep_session_recipes (meal_prep_session_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses set_updated_at() from 0002_pantry_items.sql)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_meal_prep_sessions_updated_at
	BEFORE UPDATE ON meal_prep_sessions
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- recipe_id ownership guard (same pattern as 0007 check_source_planned_meal_ownership).
-- The recipe_id FK alone would let a session reference another user's recipe (a cross-user
-- existence oracle, and a foreign recipe_id that would propagate into yielded prepped_meals).
-- RLS gates the row via its parent session, but not the foreign recipe reference — so guard it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_session_recipe_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	IF NEW.recipe_id IS NOT NULL THEN
		IF NOT EXISTS (
			SELECT 1 FROM recipes r
			WHERE r.id = NEW.recipe_id AND r.owner_id = auth.uid()
		) THEN
			RAISE EXCEPTION 'recipe_id must reference one of your own recipes'
				USING ERRCODE = 'insufficient_privilege';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;

-- A SECURITY DEFINER function inherits the implicit PUBLIC EXECUTE grant, which
-- publishes it at /rest/v1/rpc/<name> running as its owner (lints 0028/0029).
-- The trigger fires regardless of EXECUTE grants, so revoking costs nothing.
REVOKE ALL ON FUNCTION public.check_session_recipe_ownership()
	FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_session_recipes_recipe_ownership
	BEFORE INSERT OR UPDATE OF recipe_id ON meal_prep_session_recipes
	FOR EACH ROW EXECUTE FUNCTION check_session_recipe_ownership();

-- ---------------------------------------------------------------------------
-- Row-Level Security (P7 — default-deny, owner-scoped)
-- ---------------------------------------------------------------------------
ALTER TABLE meal_prep_sessions ENABLE ROW LEVEL SECURITY;

-- auth.uid() is wrapped as `(select auth.uid())` so the planner hoists it into an
-- InitPlan evaluated once per statement rather than once per row (perf lint 0003,
-- see 0012_rls_initplan).
CREATE POLICY "meal_prep_sessions_owner_all"
	ON meal_prep_sessions FOR ALL
	USING (owner_id = (select auth.uid()))
	WITH CHECK (owner_id = (select auth.uid()));

ALTER TABLE meal_prep_session_recipes ENABLE ROW LEVEL SECURITY;

-- access gated through the parent session's ownership
CREATE POLICY "meal_prep_session_recipes_owner_all"
	ON meal_prep_session_recipes FOR ALL
	USING (
		EXISTS (
			SELECT 1 FROM meal_prep_sessions s
			WHERE s.id = meal_prep_session_id AND s.owner_id = (select auth.uid())
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM meal_prep_sessions s
			WHERE s.id = meal_prep_session_id AND s.owner_id = (select auth.uid())
		)
	);

-- TODO (Identity feature): add household-member policies once household_members exists.

-- ---------------------------------------------------------------------------
-- Data API grants
-- The CLI's implicit auto_expose_new_tables default flipped to false on 2026-05-30
-- (see supabase/config.toml + migration 0008), so new public tables need explicit grants
-- or PostgREST returns "permission denied" before RLS is consulted. Authorization remains
-- RLS (P7) — these grants are the coarse capability layer only.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_prep_sessions, meal_prep_session_recipes TO authenticated;
GRANT ALL    ON meal_prep_sessions, meal_prep_session_recipes TO service_role;
-- anon gets SELECT capability only; RLS still yields zero rows pre-login
GRANT SELECT ON meal_prep_sessions, meal_prep_session_recipes TO anon;
