-- Migration: shopping_lists + shopping_list_items
-- Feature: 005-shopping
-- The buy-gap operation (Domain Specification §2.5, §5.3): lists turn MUST_ACQUIRE
-- gaps into a trip; completion replenishes the pantry. household_id stays a plain
-- nullable uuid (no FK) until the Household feature; store layouts, item photos,
-- assignment, and online-ordering fields are deferred with their features.
-- INV-SH-001 (active list has ≥ 1 item) is cross-row and enforced at the app layer
-- (see research.md R1); the row-local invariants are CHECKs below.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE shopping_list_source AS ENUM ('MANUAL', 'FROM_PLAN'); -- FROM_PREP deferred (INV-XD-004)
CREATE TYPE shopping_list_status AS ENUM ('ACTIVE', 'SHOPPING', 'COMPLETED', 'ARCHIVED');
CREATE TYPE shopping_item_status AS ENUM ('PENDING', 'CHECKED', 'UNAVAILABLE', 'REMOVED');
-- Fixed built-in category set (clarified 2026-06-11); display order = enum order.
CREATE TYPE shopping_category AS ENUM (
	'PRODUCE', 'DAIRY', 'MEAT_SEAFOOD', 'CANNED', 'FROZEN', 'BAKERY', 'PANTRY_STAPLES', 'OTHER'
);

-- ---------------------------------------------------------------------------
-- Table: shopping_lists
-- ---------------------------------------------------------------------------
CREATE TABLE shopping_lists (
	id                    uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
	owner_id              uuid                 NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
	household_id          uuid,                                  -- no FK until Household feature

	name                  text                 NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),

	-- Provenance. Weekly plans are implicit and a generation range can span two of
	-- them, so FROM_PLAN lists record the range itself, not a meal-plan FK.
	source_type           shopping_list_source NOT NULL DEFAULT 'MANUAL',
	generated_range_start date,
	generated_range_end   date,

	status                shopping_list_status NOT NULL DEFAULT 'ACTIVE',
	completed_at          timestamptz,

	created_at            timestamptz          NOT NULL DEFAULT now(),
	updated_at            timestamptz          NOT NULL DEFAULT now(),

	-- INV-SH-004 (strengthened both ways): in-progress lists carry no completion
	-- timestamp; COMPLETED requires one. ARCHIVED may have either — a list can be
	-- archived with or without ever completing.
	CONSTRAINT shopping_lists_completed_at_pairing CHECK (
		(status IN ('ACTIVE', 'SHOPPING') AND completed_at IS NULL) OR
		(status = 'COMPLETED' AND completed_at IS NOT NULL) OR
		status = 'ARCHIVED'
	),
	-- FROM_PLAN ⇔ full range present (explicit OR form: the symmetric `=` spelling
	-- passes NULL through and would admit a partial range on MANUAL lists)
	CONSTRAINT shopping_lists_range_pairing CHECK (
		(source_type = 'FROM_PLAN' AND generated_range_start IS NOT NULL AND generated_range_end IS NOT NULL) OR
		(source_type <> 'FROM_PLAN' AND generated_range_start IS NULL AND generated_range_end IS NULL)
	),
	CONSTRAINT shopping_lists_range_valid CHECK (
		generated_range_end IS NULL OR generated_range_start IS NULL OR generated_range_end >= generated_range_start
	)
);

CREATE INDEX shopping_lists_owner_idx        ON shopping_lists (owner_id);
CREATE INDEX shopping_lists_owner_status_idx ON shopping_lists (owner_id, status);

-- ---------------------------------------------------------------------------
-- Table: shopping_list_items
-- ---------------------------------------------------------------------------
CREATE TABLE shopping_list_items (
	id                     uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
	shopping_list_id       uuid                 NOT NULL REFERENCES shopping_lists (id) ON DELETE CASCADE,
	ingredient_id          uuid,                                 -- nullable; no master ingredient table yet

	name                   text                 NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),

	quantity               numeric(10, 3)       NOT NULL DEFAULT 1 CHECK (quantity > 0), -- INV-SH-002
	unit                   text                 NOT NULL DEFAULT 'x',                    -- free text

	category               shopping_category    NOT NULL DEFAULT 'OTHER',

	-- Attribution (FR-SH-009): [{ "recipeId": uuid|null, "title": text }] — titles are
	-- snapshots so "For: …" survives recipe deletion (same philosophy as FR-PL-019).
	needed_for             jsonb                NOT NULL DEFAULT '[]',

	-- FR-SH-018: set for items generated from a STORE_BOUGHT planned meal; SET NULL
	-- doubles as the "link skipped" path when the meal is deleted before completion.
	source_planned_meal_id uuid                 REFERENCES planned_meals (id) ON DELETE SET NULL,

	status                 shopping_item_status NOT NULL DEFAULT 'PENDING',
	checked_at             timestamptz,
	checked_by_user_id     uuid,                                 -- attribution (REQ-HH-010-ready)

	sort_order             integer              NOT NULL DEFAULT 0 CHECK (sort_order >= 0),

	created_at             timestamptz          NOT NULL DEFAULT now(),
	updated_at             timestamptz          NOT NULL DEFAULT now(),

	-- INV-SH-003 (strengthened both ways): CHECKED ⇔ checked_at present, so an
	-- uncheck that forgets to clear the timestamp is rejected, not just tolerated
	CONSTRAINT shopping_list_items_checked_at_pairing CHECK (
		(status = 'CHECKED') = (checked_at IS NOT NULL)
	)
);

CREATE INDEX shopping_list_items_list_idx        ON shopping_list_items (shopping_list_id);
CREATE INDEX shopping_list_items_list_status_idx ON shopping_list_items (shopping_list_id, status);

-- ---------------------------------------------------------------------------
-- Cross-user reference guard: the FK above is checked with table-owner
-- privileges, so RLS does NOT stop an item from pointing at another user's
-- planned meal (a UUID-existence oracle). This trigger verifies ownership of
-- the referenced meal under SECURITY DEFINER before allowing the write.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_source_planned_meal_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	IF NEW.source_planned_meal_id IS NOT NULL THEN
		IF NOT EXISTS (
			SELECT 1
			FROM planned_meals pm
			JOIN meal_plans mp ON mp.id = pm.meal_plan_id
			WHERE pm.id = NEW.source_planned_meal_id
			  AND mp.owner_id = auth.uid()
		) THEN
			RAISE EXCEPTION 'source_planned_meal_id must reference one of your own planned meals'
				USING ERRCODE = 'insufficient_privilege';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shopping_list_items_source_meal_ownership
	BEFORE INSERT OR UPDATE OF source_planned_meal_id ON shopping_list_items
	FOR EACH ROW EXECUTE FUNCTION check_source_planned_meal_ownership();

-- ---------------------------------------------------------------------------
-- Row-Level Security (P7: enabled, default-deny, owner-scoped)
-- Note on re-parenting: FOR ALL with USING + WITH CHECK already blocks moving
-- items across ownership boundaries in both directions — USING hides foreign
-- rows from UPDATE entirely, and WITH CHECK rejects foreign destinations.
-- ---------------------------------------------------------------------------
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_lists_owner_all"
	ON shopping_lists FOR ALL
	USING (owner_id = auth.uid())
	WITH CHECK (owner_id = auth.uid());

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

-- Owner scoping flows through the parent list (same pattern as planned_meals)
CREATE POLICY "shopping_list_items_owner_all"
	ON shopping_list_items FOR ALL
	USING (EXISTS (
		SELECT 1 FROM shopping_lists sl
		WHERE sl.id = shopping_list_items.shopping_list_id AND sl.owner_id = auth.uid()
	))
	WITH CHECK (EXISTS (
		SELECT 1 FROM shopping_lists sl
		WHERE sl.id = shopping_list_items.shopping_list_id AND sl.owner_id = auth.uid()
	));

-- ---------------------------------------------------------------------------
-- Realtime publication (best-effort, REQ-CN pattern from 0005)
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_list_items;

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuses set_updated_at() from 0002_pantry_items.sql)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_shopping_lists_updated_at
	BEFORE UPDATE ON shopping_lists
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shopping_list_items_updated_at
	BEFORE UPDATE ON shopping_list_items
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Data API grants. Since the CLI's 2026-05-30 default flip
-- (auto_expose_new_tables=false), new public tables get NO implicit grants for
-- the Data API roles — each migration grants explicitly. Row access stays
-- governed by the RLS policies above (P7); service_role bypasses RLS by design.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON shopping_lists, shopping_list_items TO authenticated;
GRANT ALL ON shopping_lists, shopping_list_items TO service_role;
-- anon gets SELECT capability only; RLS still yields zero rows pre-login.
GRANT SELECT ON shopping_lists, shopping_list_items TO anon;
