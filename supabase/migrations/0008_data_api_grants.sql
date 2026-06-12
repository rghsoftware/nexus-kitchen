-- Migration: explicit Data API grants for pre-existing tables
-- Feature: 005-shopping (infrastructure repair surfaced during this chunk)
--
-- The Supabase CLI's implicit default for auto_expose_new_tables flipped to
-- false on 2026-05-30 (see supabase/config.toml). On any database rebuilt after
-- that date, tables from migrations 0001..0006 are created WITHOUT grants for
-- the Data API roles, so every PostgREST request fails with "permission denied"
-- before RLS is even consulted. This migration restores explicit grants for the
-- tables that predate the flip; 0007+ carry their own grants. Authorization
-- remains RLS (P7) — these grants are the coarse capability layer only.
GRANT SELECT, INSERT, UPDATE, DELETE ON
	recipes, recipe_ingredients, recipe_steps, recipe_tags, user_recipe_meta,
	pantry_items, prepped_meals, portion_events,
	meal_plans, planned_meals
TO authenticated;

GRANT ALL ON
	recipes, recipe_ingredients, recipe_steps, recipe_tags, user_recipe_meta,
	pantry_items, prepped_meals, portion_events,
	meal_plans, planned_meals
TO service_role;

-- anon gets SELECT capability only; RLS still yields zero rows pre-login
-- (the pgTAP suites assert "anon sees no rows", not "permission denied").
GRANT SELECT ON
	recipes, recipe_ingredients, recipe_steps, recipe_tags, user_recipe_meta,
	pantry_items, prepped_meals, portion_events,
	meal_plans, planned_meals
TO anon;
