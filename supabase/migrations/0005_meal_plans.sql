-- Migration: meal_plans + planned_meals
-- Feature: 003-planning-place-planned-meals-recipe
-- The requirement-creation spine: place planned meals (recipe / store-bought / quick)
-- on a calendar. Fulfillment state is DERIVED and never stored (INV-PL-017) — and is
-- not computed in this chunk at all. PREPPED source, LOGGED/SKIPPED/SWAPPED statuses,
-- and household_id are reserved for later chunks.

-- ---------------------------------------------------------------------------
-- Enums (full domain enums per Domain Specification §2.4)
-- ---------------------------------------------------------------------------
CREATE TYPE meal_slot AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');
CREATE TYPE planned_meal_source AS ENUM ('RECIPE', 'PREPPED', 'STORE_BOUGHT', 'QUICK');
CREATE TYPE planned_meal_status AS ENUM ('PLANNED', 'LOGGED', 'SKIPPED', 'SWAPPED');

-- ---------------------------------------------------------------------------
-- Table: meal_plans
-- Implicit weekly plans: one per (owner, Monday-start week). name stays null
-- for implicit plans; the column exists per the domain model.
-- ---------------------------------------------------------------------------
CREATE TABLE meal_plans (
	id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	owner_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
	household_id uuid,                                   -- no FK until Household feature
	name         text        CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 200),
	start_date   date        NOT NULL,
	end_date     date        NOT NULL,
	created_at   timestamptz NOT NULL DEFAULT now(),
	updated_at   timestamptz NOT NULL DEFAULT now(),

	-- INV-PL-001: end date on or after start date
	CONSTRAINT meal_plans_range_valid CHECK (end_date >= start_date),
	-- One implicit plan per week per owner (FR-PL-011); upsert target
	CONSTRAINT meal_plans_owner_week_unique UNIQUE (owner_id, start_date)
);

CREATE INDEX meal_plans_owner_idx ON meal_plans (owner_id);

-- ---------------------------------------------------------------------------
-- Table: planned_meals
-- ---------------------------------------------------------------------------
CREATE TABLE planned_meals (
	id                    uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
	meal_plan_id          uuid                NOT NULL REFERENCES meal_plans (id) ON DELETE CASCADE,
	date                  date                NOT NULL,
	meal_slot             meal_slot,                    -- NULL = unslotted ("Anytime")
	source                planned_meal_source NOT NULL,

	-- Source references (exactly one set, matching source — INV-PL-003).
	-- For RECIPE rows the required reference is the title snapshot, so a deleted
	-- recipe (FK SET NULL) never breaks the row or the constraint (FR-PL-019).
	recipe_id             uuid                REFERENCES recipes (id) ON DELETE SET NULL,
	recipe_title_snapshot text                CHECK (recipe_title_snapshot IS NULL OR char_length(recipe_title_snapshot) BETWEEN 1 AND 500),
	prepped_meal_id       uuid                REFERENCES prepped_meals (id) ON DELETE SET NULL, -- reserved (PREPPED chunk)
	store_bought_name     text                CHECK (store_bought_name IS NULL OR char_length(store_bought_name) BETWEEN 1 AND 200),
	quick_meal_name       text                CHECK (quick_meal_name IS NULL OR char_length(quick_meal_name) BETWEEN 1 AND 200),

	servings              numeric(6, 2)       NOT NULL DEFAULT 1 CHECK (servings > 0), -- INV-PL-004
	status                planned_meal_status NOT NULL DEFAULT 'PLANNED',
	logged_at             timestamptz,
	sort_order            integer             NOT NULL DEFAULT 0 CHECK (sort_order >= 0),

	created_at            timestamptz         NOT NULL DEFAULT now(),
	updated_at            timestamptz         NOT NULL DEFAULT now(),

	-- INV-PL-003: exactly one source reference, matching source
	CONSTRAINT planned_meals_exactly_one_source CHECK (
		(source = 'RECIPE'       AND recipe_title_snapshot IS NOT NULL AND prepped_meal_id IS NULL AND store_bought_name IS NULL AND quick_meal_name IS NULL) OR
		(source = 'PREPPED'      AND prepped_meal_id IS NOT NULL AND recipe_id IS NULL AND recipe_title_snapshot IS NULL AND store_bought_name IS NULL AND quick_meal_name IS NULL) OR
		(source = 'STORE_BOUGHT' AND store_bought_name IS NOT NULL AND recipe_id IS NULL AND recipe_title_snapshot IS NULL AND prepped_meal_id IS NULL AND quick_meal_name IS NULL) OR
		(source = 'QUICK'        AND quick_meal_name IS NOT NULL AND recipe_id IS NULL AND recipe_title_snapshot IS NULL AND prepped_meal_id IS NULL AND store_bought_name IS NULL)
	),
	-- INV-PL-005: logged meals must have a logged timestamp
	CONSTRAINT planned_meals_logged_at_pairing CHECK (status <> 'LOGGED' OR logged_at IS NOT NULL),
	-- INV-PL-012: sort order unique within a (plan, date, slot) group.
	-- NULLS NOT DISTINCT so the unslotted ("Anytime") group is a real group.
	CONSTRAINT planned_meals_group_sort_unique UNIQUE NULLS NOT DISTINCT (meal_plan_id, date, meal_slot, sort_order)
);

CREATE INDEX planned_meals_plan_idx   ON planned_meals (meal_plan_id);
CREATE INDEX planned_meals_date_idx   ON planned_meals (date);
CREATE INDEX planned_meals_recipe_idx ON planned_meals (recipe_id);

-- ---------------------------------------------------------------------------
-- INV-PL-002: planned meal date must be within its plan's range.
-- Cross-row rule → trigger (CHECK constraints cannot reference other tables).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_planned_meal_in_plan_range()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
	plan_start date;
	plan_end   date;
BEGIN
	SELECT start_date, end_date INTO plan_start, plan_end
	FROM meal_plans WHERE id = NEW.meal_plan_id;

	IF NEW.date < plan_start OR NEW.date > plan_end THEN
		RAISE EXCEPTION 'planned meal date % outside plan range % – % (INV-PL-002)',
			NEW.date, plan_start, plan_end
			USING ERRCODE = 'check_violation';
	END IF;

	RETURN NEW;
END;
$$;

CREATE TRIGGER trg_planned_meals_in_plan_range
	BEFORE INSERT OR UPDATE OF date, meal_plan_id ON planned_meals
	FOR EACH ROW EXECUTE FUNCTION check_planned_meal_in_plan_range();

-- ---------------------------------------------------------------------------
-- Row-Level Security (P7: enabled, default-deny, owner-scoped)
-- ---------------------------------------------------------------------------
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plans_owner_all"
	ON meal_plans FOR ALL
	USING (owner_id = auth.uid())
	WITH CHECK (owner_id = auth.uid());

ALTER TABLE planned_meals ENABLE ROW LEVEL SECURITY;

-- Owner scoping flows through the parent plan
CREATE POLICY "planned_meals_owner_all"
	ON planned_meals FOR ALL
	USING (EXISTS (
		SELECT 1 FROM meal_plans mp
		WHERE mp.id = planned_meals.meal_plan_id AND mp.owner_id = auth.uid()
	))
	WITH CHECK (EXISTS (
		SELECT 1 FROM meal_plans mp
		WHERE mp.id = planned_meals.meal_plan_id AND mp.owner_id = auth.uid()
	));

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE meal_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE planned_meals;

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuses set_updated_at() from 0002_pantry_items.sql)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_meal_plans_updated_at
	BEFORE UPDATE ON meal_plans
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_planned_meals_updated_at
	BEFORE UPDATE ON planned_meals
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();
