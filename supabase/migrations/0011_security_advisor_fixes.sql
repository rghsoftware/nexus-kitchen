-- Migration: clear the Supabase database security advisor warnings
--
-- Three lint families, all raised against objects created in 0002..0010:
--
--   0011_function_search_path_mutable  — 6 trigger functions with an unpinned
--         search_path. A function without SET search_path resolves unqualified
--         names against the *caller's* path, so anyone who can create objects
--         in a schema earlier on that path can shadow the tables/operators the
--         body relies on. Note 0001 already pinned public.set_updated_at, but
--         0002's CREATE OR REPLACE silently dropped the setting (REPLACE keeps
--         no attribute the new definition omits) — this restores it.
--
--   0014_extension_in_public           — pg_net was created without a schema in
--         0010, so it landed in public and its members show up as project API
--         surface.
--
--   0028/0029_*_security_definer_function_executable — the three cross-user
--         reference guards are SECURITY DEFINER and inherit EXECUTE from
--         PUBLIC plus Supabase's default privileges for anon/authenticated,
--         which publishes them at /rest/v1/rpc/*.
--
-- Nothing here changes behaviour: trigger functions keep firing (Postgres
-- checks EXECUTE when the trigger is *created*, not when it fires) and pg_net's
-- callable objects live in the `net` schema either way.

-- ---------------------------------------------------------------------------
-- 1. Pin search_path on the six unpinned trigger functions.
--
-- `''` (empty) rather than `public`: an empty path forces every non-builtin
-- name to be schema-qualified, which is what actually makes shadowing
-- impossible. pg_catalog is always searched implicitly, so now()/unnest()/
-- array_agg() and the enum comparisons below still resolve.
--
-- Four of the six reference no schema-qualified objects at all, so ALTER
-- FUNCTION is enough and their bodies stay single-sourced in their original
-- migrations. The two that read from tables are replaced below with qualified
-- references.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.meal_logs_validate_source() SET search_path = '';
ALTER FUNCTION public.meal_logs_annotation_only() SET search_path = '';
ALTER FUNCTION public.meal_reminders_validate() SET search_path = '';

-- 0004: unqualified `prepped_meals` → public.prepped_meals. Body otherwise
-- verbatim from 0004.
CREATE OR REPLACE FUNCTION public.sync_portions_remaining()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
	new_remaining  integer;
	new_original   integer;
BEGIN
	IF NEW.kind = 'ADJUSTED' THEN
		-- Upward correction: raise both columns atomically
		UPDATE public.prepped_meals
		SET portions_remaining = portions_remaining + NEW.delta_portions,
		    original_portions  = original_portions  + NEW.delta_portions,
		    updated_at         = now()
		WHERE id = NEW.prepped_meal_id
		RETURNING portions_remaining, original_portions
		INTO new_remaining, new_original;
	ELSE
		-- CONSUMED or INITIALIZED: only remaining changes
		UPDATE public.prepped_meals
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

-- 0005: unqualified `meal_plans` → public.meal_plans. Body otherwise verbatim
-- from 0005.
CREATE OR REPLACE FUNCTION public.check_planned_meal_in_plan_range()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
	plan_start date;
	plan_end   date;
BEGIN
	SELECT start_date, end_date INTO plan_start, plan_end
	FROM public.meal_plans WHERE id = NEW.meal_plan_id;

	IF NEW.date < plan_start OR NEW.date > plan_end THEN
		RAISE EXCEPTION 'planned meal date % outside plan range % – % (INV-PL-002)',
			NEW.date, plan_start, plan_end
			USING ERRCODE = 'check_violation';
	END IF;

	RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Take the trigger functions off the Data API.
--
-- None of these are meant to be called by a client — they are trigger bodies,
-- and PostgREST exposing them as RPC endpoints is pure surface area. The three
-- SECURITY DEFINER ownership guards are the ones the advisor flags (0028/0029);
-- the SECURITY INVOKER helpers are revoked in the same pass so the whole
-- category stays off /rest/v1/rpc/*.
--
-- PUBLIC carries an implicit EXECUTE grant and anon/authenticated/service_role
-- carry explicit ones from Supabase's default privileges on public, so both
-- have to be revoked. Triggers are unaffected: EXECUTE is checked at CREATE
-- TRIGGER time, never at fire time.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
	fn text;
BEGIN
	FOREACH fn IN ARRAY ARRAY[
		'public.check_source_planned_meal_ownership()',
		'public.check_meal_log_source_ownership()',
		'public.check_portion_event_trigger_ownership()',
		'public.set_updated_at()',
		'public.sync_portions_remaining()',
		'public.check_planned_meal_in_plan_range()',
		'public.meal_logs_validate_source()',
		'public.meal_logs_annotation_only()',
		'public.meal_reminders_validate()'
	] LOOP
		EXECUTE format(
			'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
			fn
		);
	END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Move pg_net out of public.
--
-- `ALTER EXTENSION pg_net SET SCHEMA extensions` is rejected ("does not support
-- SET SCHEMA" — pg_net is non-relocatable), so the only route is drop/recreate.
-- That is safe here: pg_net puts every callable object in its own `net` schema
-- regardless of the extension's declared schema, so net.http_post() — the one
-- thing 0010's invoke_send_meal_reminders() depends on — is identical
-- afterwards. Only the extension's own namespace registration, which is all the
-- linter reads, changes.
--
-- The drop discards net.http_request_queue / net._http_response: any in-flight
-- reminder POST and the recent response log are lost. Harmless — the Cron job
-- re-runs every minute and reminder_deliveries' UNIQUE key is what prevents
-- duplicate sends, not the request log.
--
-- Guarded so a `supabase db reset` (0010 creates pg_net in public, then this
-- runs) and an already-corrected database both converge without churn.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM pg_extension e
		JOIN pg_namespace n ON n.oid = e.extnamespace
		WHERE e.extname = 'pg_net' AND n.nspname = 'public'
	) THEN
		DROP EXTENSION pg_net;
		CREATE EXTENSION pg_net WITH SCHEMA extensions;
		-- The pg_net background worker caches the queue relation it polls, and
		-- the recreate above gives net.http_request_queue a new OID. Without
		-- this the worker keeps polling the dropped table and every reminder
		-- POST queues forever.
		PERFORM net.worker_restart();
	END IF;
END;
$$;
