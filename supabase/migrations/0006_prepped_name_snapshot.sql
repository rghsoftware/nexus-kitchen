-- Migration: prepped_name_snapshot on planned_meals
-- Feature: 004-fulfillment-state
--
-- Enables PREPPED placement (FR-FS-010/011): the required reference for a PREPPED
-- planned meal becomes a denormalized name snapshot — mirroring the RECIPE
-- title-snapshot pattern (FR-PL-019) — so the prepped_meal_id FK (ON DELETE SET NULL)
-- can null out without violating the exactly-one-source CHECK (INV-PL-003). Without
-- this, Postgres would reject deleting any prepped meal referenced by a planned meal:
-- the SET NULL referential action re-validates the CHECK, which previously required
-- prepped_meal_id IS NOT NULL for PREPPED rows.
--
-- NO fulfillment-state column is added: fulfillment is derived, never stored (INV-PL-017).

ALTER TABLE planned_meals
	ADD COLUMN prepped_name_snapshot text
		CHECK (prepped_name_snapshot IS NULL OR char_length(prepped_name_snapshot) BETWEEN 1 AND 500);

-- INV-PL-003: exactly one source reference, matching source. The required reference
-- for RECIPE and PREPPED is the snapshot column; the id FKs may null out on deletion.
ALTER TABLE planned_meals DROP CONSTRAINT planned_meals_exactly_one_source;

ALTER TABLE planned_meals ADD CONSTRAINT planned_meals_exactly_one_source CHECK (
	(source = 'RECIPE'       AND recipe_title_snapshot IS NOT NULL AND prepped_meal_id IS NULL AND prepped_name_snapshot IS NULL AND store_bought_name IS NULL AND quick_meal_name IS NULL) OR
	(source = 'PREPPED'      AND prepped_name_snapshot IS NOT NULL AND recipe_id IS NULL AND recipe_title_snapshot IS NULL AND store_bought_name IS NULL AND quick_meal_name IS NULL) OR
	(source = 'STORE_BOUGHT' AND store_bought_name IS NOT NULL AND recipe_id IS NULL AND recipe_title_snapshot IS NULL AND prepped_meal_id IS NULL AND prepped_name_snapshot IS NULL AND quick_meal_name IS NULL) OR
	(source = 'QUICK'        AND quick_meal_name IS NOT NULL AND recipe_id IS NULL AND recipe_title_snapshot IS NULL AND prepped_meal_id IS NULL AND prepped_name_snapshot IS NULL AND store_bought_name IS NULL)
);
