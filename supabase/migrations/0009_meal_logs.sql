-- Migration: meal_logs
-- Feature: 006-today-logging
-- One eating occurrence per row (Domain Specification MealLog, §4.8). Append-only
-- with an annotation window: after INSERT only verdict/notes may change (INV-CC-004,
-- REQ-CN-007) and no DELETE capability exists in v1 (spec A-004). Source references
-- are ON DELETE SET NULL so history survives source deletion; the type↔reference
-- rules (INV-XD-001/002) are therefore enforced at INSERT time by trigger, not by
-- CHECK. household_id stays a plain nullable uuid (no FK) until the Household
-- feature; nutrition capture on logs is deferred with the nutrition feature.
-- Verdict is the three-way KEEP/FINE/REST control from the canonical design
-- (supersedes the four-value MealRating — spec Clarifications 2026-07-09).

-- ---------------------------------------------------------------------------
-- Enums (meal_slot is reused from 0005_meal_plans.sql)
-- ---------------------------------------------------------------------------
CREATE TYPE meal_log_type AS ENUM ('FROM_PLAN', 'FROM_RECIPE', 'FROM_PREPPED', 'QUICK_LOG', 'CUSTOM');
CREATE TYPE meal_verdict  AS ENUM ('KEEP', 'FINE', 'REST');

-- ---------------------------------------------------------------------------
-- Table: meal_logs
-- ---------------------------------------------------------------------------
CREATE TABLE meal_logs (
	id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
	owner_id         uuid          NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
	household_id     uuid,                                  -- no FK until Household feature

	log_type         meal_log_type NOT NULL,

	-- Source references: SET NULL keeps the log displayable (via name_snapshot)
	-- after its source is deleted. Presence rules live in the INSERT trigger.
	planned_meal_id  uuid          REFERENCES planned_meals (id) ON DELETE SET NULL,
	recipe_id        uuid          REFERENCES recipes (id) ON DELETE SET NULL,
	prepped_meal_id  uuid          REFERENCES prepped_meals (id) ON DELETE SET NULL,

	-- Display name at log time. NULL only for QUICK_LOG ("I ate something").
	name_snapshot    text          CHECK (name_snapshot IS NULL OR char_length(name_snapshot) BETWEEN 1 AND 200),

	meal_slot        meal_slot,                             -- NULL = unspecified
	servings         numeric(6, 2) NOT NULL DEFAULT 1 CHECK (servings > 0), -- PositiveDecimal
	logged_at        timestamptz   NOT NULL DEFAULT now(),

	-- Annotation window: the only mutable columns (with notes) after insert.
	verdict          meal_verdict,
	notes            text          CHECK (notes IS NULL OR char_length(notes) <= 1000),

	created_at       timestamptz   NOT NULL DEFAULT now(),
	updated_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX meal_logs_owner_logged_idx ON meal_logs (owner_id, logged_at DESC);
CREATE INDEX meal_logs_planned_meal_idx ON meal_logs (planned_meal_id) WHERE planned_meal_id IS NOT NULL;
CREATE INDEX meal_logs_recipe_idx       ON meal_logs (recipe_id) WHERE recipe_id IS NOT NULL;
CREATE INDEX meal_logs_prepped_idx      ON meal_logs (prepped_meal_id) WHERE prepped_meal_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- INSERT-time shape validation (INV-XD-001/002 + research R3). Not a CHECK:
-- the SET NULL FKs must be free to null references later without violating it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION meal_logs_validate_source()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.log_type = 'FROM_PLAN' AND NEW.planned_meal_id IS NULL THEN
		RAISE EXCEPTION 'INV-XD-001: FROM_PLAN log requires planned_meal_id'
			USING ERRCODE = 'check_violation';
	END IF;
	IF NEW.log_type = 'FROM_PREPPED' AND NEW.prepped_meal_id IS NULL THEN
		RAISE EXCEPTION 'INV-XD-002: FROM_PREPPED log requires prepped_meal_id'
			USING ERRCODE = 'check_violation';
	END IF;
	IF NEW.log_type = 'FROM_RECIPE' AND NEW.recipe_id IS NULL THEN
		RAISE EXCEPTION 'FROM_RECIPE log requires recipe_id'
			USING ERRCODE = 'check_violation';
	END IF;
	IF NEW.log_type <> 'QUICK_LOG' AND NEW.name_snapshot IS NULL THEN
		RAISE EXCEPTION 'non-quick log requires name_snapshot'
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meal_logs_validate_source
	BEFORE INSERT ON meal_logs
	FOR EACH ROW EXECUTE FUNCTION meal_logs_validate_source();

-- ---------------------------------------------------------------------------
-- Cross-user reference guard (pattern: 0007). FKs are checked with table-owner
-- privileges, so RLS alone would let a log point at another user's rows (a
-- UUID-existence oracle). Verify ownership under SECURITY DEFINER.
-- planned_meals owns nothing directly — ownership flows through meal_plans.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_meal_log_source_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	IF NEW.planned_meal_id IS NOT NULL THEN
		IF NOT EXISTS (
			SELECT 1
			FROM planned_meals pm
			JOIN meal_plans mp ON mp.id = pm.meal_plan_id
			WHERE pm.id = NEW.planned_meal_id
			  AND mp.owner_id = auth.uid()
		) THEN
			RAISE EXCEPTION 'planned_meal_id must reference one of your own planned meals'
				USING ERRCODE = 'insufficient_privilege';
		END IF;
	END IF;
	IF NEW.recipe_id IS NOT NULL THEN
		IF NOT EXISTS (
			SELECT 1 FROM recipes r
			WHERE r.id = NEW.recipe_id AND r.owner_id = auth.uid()
		) THEN
			RAISE EXCEPTION 'recipe_id must reference one of your own recipes'
				USING ERRCODE = 'insufficient_privilege';
		END IF;
	END IF;
	IF NEW.prepped_meal_id IS NOT NULL THEN
		IF NOT EXISTS (
			SELECT 1 FROM prepped_meals p
			WHERE p.id = NEW.prepped_meal_id AND p.owner_id = auth.uid()
		) THEN
			RAISE EXCEPTION 'prepped_meal_id must reference one of your own prepped meals'
				USING ERRCODE = 'insufficient_privilege';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meal_logs_source_ownership
	BEFORE INSERT ON meal_logs
	FOR EACH ROW EXECUTE FUNCTION check_meal_log_source_ownership();

-- ---------------------------------------------------------------------------
-- Annotation-only updates (INV-CC-004 / REQ-CN-007, research R2): occurrence
-- facts are immutable; only verdict and notes may change. Compares values, not
-- payload columns — PostgREST updates always materialize the full NEW row.
-- Exception: the three source references may transition value → NULL. That is
-- exactly what the FKs' ON DELETE SET NULL cascade does when a recipe /
-- planned meal / prepped meal is deleted — without this carve-out those
-- deletes would be blocked by this trigger. The name snapshot keeps the log
-- displayable; a reference can never be changed to a different row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION meal_logs_annotation_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
		OR NEW.household_id IS DISTINCT FROM OLD.household_id
		OR NEW.log_type IS DISTINCT FROM OLD.log_type
		OR (NEW.planned_meal_id IS DISTINCT FROM OLD.planned_meal_id AND NEW.planned_meal_id IS NOT NULL)
		OR (NEW.recipe_id IS DISTINCT FROM OLD.recipe_id AND NEW.recipe_id IS NOT NULL)
		OR (NEW.prepped_meal_id IS DISTINCT FROM OLD.prepped_meal_id AND NEW.prepped_meal_id IS NOT NULL)
		OR NEW.name_snapshot IS DISTINCT FROM OLD.name_snapshot
		OR NEW.meal_slot IS DISTINCT FROM OLD.meal_slot
		OR NEW.servings IS DISTINCT FROM OLD.servings
		OR NEW.logged_at IS DISTINCT FROM OLD.logged_at
		OR NEW.created_at IS DISTINCT FROM OLD.created_at
	THEN
		RAISE EXCEPTION 'INV-CC-004: meal log occurrence fields are append-only; only verdict/notes may change'
			USING ERRCODE = 'check_violation';
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meal_logs_annotation_only
	BEFORE UPDATE ON meal_logs
	FOR EACH ROW EXECUTE FUNCTION meal_logs_annotation_only();

-- ---------------------------------------------------------------------------
-- portion_events.triggered_by becomes load-bearing with this feature (it was
-- reserved for MealLog.id in 0004). Give it a real FK — SET NULL so deleting a
-- log (service_role only) never strands the ledger — and an ownership guard so
-- a client cannot attribute a portion event to another user's meal log.
-- ---------------------------------------------------------------------------
ALTER TABLE portion_events
	ADD CONSTRAINT portion_events_triggered_by_fkey
	FOREIGN KEY (triggered_by) REFERENCES meal_logs (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.check_portion_event_trigger_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	IF NEW.triggered_by IS NOT NULL THEN
		IF NOT EXISTS (
			SELECT 1 FROM meal_logs ml
			WHERE ml.id = NEW.triggered_by AND ml.owner_id = auth.uid()
		) THEN
			RAISE EXCEPTION 'triggered_by must reference one of your own meal logs'
				USING ERRCODE = 'insufficient_privilege';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER trg_portion_events_trigger_ownership
	BEFORE INSERT ON portion_events
	FOR EACH ROW EXECUTE FUNCTION check_portion_event_trigger_ownership();

-- ---------------------------------------------------------------------------
-- Row-Level Security (P7: enabled, default-deny, owner-scoped).
-- Per-operation policies — deliberately NO DELETE policy (P14, spec A-004).
-- ---------------------------------------------------------------------------
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_logs_owner_select"
	ON meal_logs FOR SELECT
	USING (owner_id = auth.uid());

CREATE POLICY "meal_logs_owner_insert"
	ON meal_logs FOR INSERT
	WITH CHECK (owner_id = auth.uid());

CREATE POLICY "meal_logs_owner_update"
	ON meal_logs FOR UPDATE
	USING (owner_id = auth.uid())
	WITH CHECK (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime publication (best-effort, REQ-CN pattern from 0005)
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE meal_logs;

-- ---------------------------------------------------------------------------
-- updated_at trigger (reuses set_updated_at() from 0002_pantry_items.sql)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_meal_logs_updated_at
	BEFORE UPDATE ON meal_logs
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Data API grants (post auto_expose_new_tables=false; see 0007/0008 notes).
-- No DELETE grant to authenticated — belt and braces with the missing DELETE
-- policy: meal logs cannot be deleted through the Data API at all.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON meal_logs TO authenticated;
GRANT ALL ON meal_logs TO service_role;
-- anon gets SELECT capability only; RLS still yields zero rows pre-login.
GRANT SELECT ON meal_logs TO anon;
-- Default privileges on the public schema may still hand out DELETE — revoke
-- explicitly so the Data API cannot delete logs even before RLS is consulted.
REVOKE DELETE ON meal_logs FROM authenticated, anon;
