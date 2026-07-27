-- Migration: clear the 13 `auth_rls_initplan` performance-advisor warnings
-- (lint 0003_auth_rls_initplan).
--
-- A bare `auth.uid()` in a policy expression is a VOLATILE-by-default function
-- call in a per-row filter, so the planner re-invokes it for every candidate
-- row. Wrapping it as `(select auth.uid())` makes it an uncorrelated subquery,
-- which the planner hoists into an InitPlan and evaluates once per statement.
-- On the EXISTS-based child policies (planned_meals, shopping_list_items,
-- portion_events) that saving compounds: the subplan ran once per outer row and
-- called auth.uid() inside each one.
--
-- 0001 already wrote every recipes-family policy this way (see its header
-- comment); 0002..0010 didn't, so all 13 offenders are exactly the policies
-- created there. This migration is the catch-up — nothing else about them
-- changes, so it is semantically a no-op: auth.uid() reads the request JWT and
-- is constant for the whole statement either way.
--
-- DROP + CREATE rather than ALTER POLICY because ALTER cannot be made
-- idempotent for a `supabase db reset` replay, and DROP IF EXISTS keeps this
-- re-runnable. Each policy below is its original definition verbatim apart from
-- the `(select ...)` wrapper.
--
-- A catalog-wide guard against this regressing lives in
-- supabase/tests/security_advisors.test.sql.

-- ── 0002_pantry_items ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pantry_items_owner_all" ON pantry_items;

CREATE POLICY "pantry_items_owner_all"
	ON pantry_items FOR ALL
	USING (owner_id = (select auth.uid()))
	WITH CHECK (owner_id = (select auth.uid()));

-- ── 0003_prepped_meals ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "prepped_meals_owner_all" ON prepped_meals;

CREATE POLICY "prepped_meals_owner_all"
	ON prepped_meals FOR ALL
	USING (owner_id = (select auth.uid()))
	WITH CHECK (owner_id = (select auth.uid()));

-- ── 0004_portion_events (append-only: no UPDATE/DELETE policy, per P14) ────
DROP POLICY IF EXISTS "portion_events_insert" ON portion_events;

CREATE POLICY "portion_events_insert"
	ON portion_events FOR INSERT
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM prepped_meals pm
			WHERE pm.id = prepped_meal_id
			  AND pm.owner_id = (select auth.uid())
		)
	);

DROP POLICY IF EXISTS "portion_events_select" ON portion_events;

CREATE POLICY "portion_events_select"
	ON portion_events FOR SELECT
	USING (
		EXISTS (
			SELECT 1 FROM prepped_meals pm
			WHERE pm.id = prepped_meal_id
			  AND pm.owner_id = (select auth.uid())
		)
	);

-- ── 0005_meal_plans ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "meal_plans_owner_all" ON meal_plans;

CREATE POLICY "meal_plans_owner_all"
	ON meal_plans FOR ALL
	USING (owner_id = (select auth.uid()))
	WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "planned_meals_owner_all" ON planned_meals;

CREATE POLICY "planned_meals_owner_all"
	ON planned_meals FOR ALL
	USING (EXISTS (
		SELECT 1 FROM meal_plans mp
		WHERE mp.id = planned_meals.meal_plan_id AND mp.owner_id = (select auth.uid())
	))
	WITH CHECK (EXISTS (
		SELECT 1 FROM meal_plans mp
		WHERE mp.id = planned_meals.meal_plan_id AND mp.owner_id = (select auth.uid())
	));

-- ── 0007_shopping ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "shopping_lists_owner_all" ON shopping_lists;

CREATE POLICY "shopping_lists_owner_all"
	ON shopping_lists FOR ALL
	USING (owner_id = (select auth.uid()))
	WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "shopping_list_items_owner_all" ON shopping_list_items;

CREATE POLICY "shopping_list_items_owner_all"
	ON shopping_list_items FOR ALL
	USING (EXISTS (
		SELECT 1 FROM shopping_lists sl
		WHERE sl.id = shopping_list_items.shopping_list_id AND sl.owner_id = (select auth.uid())
	))
	WITH CHECK (EXISTS (
		SELECT 1 FROM shopping_lists sl
		WHERE sl.id = shopping_list_items.shopping_list_id AND sl.owner_id = (select auth.uid())
	));

-- ── 0009_meal_logs (no DELETE policy — logs are corrected, not removed) ────
DROP POLICY IF EXISTS "meal_logs_owner_select" ON meal_logs;

CREATE POLICY "meal_logs_owner_select"
	ON meal_logs FOR SELECT
	USING (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "meal_logs_owner_insert" ON meal_logs;

CREATE POLICY "meal_logs_owner_insert"
	ON meal_logs FOR INSERT
	WITH CHECK (owner_id = (select auth.uid()));

DROP POLICY IF EXISTS "meal_logs_owner_update" ON meal_logs;

CREATE POLICY "meal_logs_owner_update"
	ON meal_logs FOR UPDATE
	USING (owner_id = (select auth.uid()))
	WITH CHECK (owner_id = (select auth.uid()));

-- ── 0010_meal_reminders ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "meal_reminders_owner_all" ON meal_reminders;

CREATE POLICY "meal_reminders_owner_all"
	ON meal_reminders FOR ALL
	USING (owner_id = (select auth.uid()))
	WITH CHECK (owner_id = (select auth.uid()));

-- reminder_deliveries is service-role-written; owners only read their own.
DROP POLICY IF EXISTS "reminder_deliveries_owner_select" ON reminder_deliveries;

CREATE POLICY "reminder_deliveries_owner_select"
	ON reminder_deliveries FOR SELECT
	USING (owner_id = (select auth.uid()));
