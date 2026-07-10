-- Migration: 0010_meal_reminders
-- Feature: 007-meal-reminders (Supabase Cron → Edge Function → Pushover)
-- Creates the MealReminder entity (Domain Specification §MealReminder), the
-- delivery/dedup ledger the Edge Function writes, the due-computation RPC the
-- Edge Function calls, and the pg_cron schedule that invokes it every minute.
--
-- Invariants enforced here (docs/nexus-kitchen-invariants.md):
--   INV-PL-010 (valid reminder time — guaranteed by the `time` type),
--   INV-PL-011 (enabled reminder has >= 1 day selected — CHECK).
-- REQ-MR-001..003 (recurring reminders, pre-alerts, per-slot timing) shape the
-- schema; REQ-MR-004/005 + REQ-UX-010 (guilt-free copy) live in the Edge Function.
--
-- Timezone note: the domain entity stores a LocalTime with no zone, but Cron
-- runs in UTC — each reminder therefore carries the owner's IANA time zone
-- (captured client-side from Intl) and all due-time math happens in SQL via
-- `AT TIME ZONE`, where Postgres handles DST correctly.

-- ---------------------------------------------------------------------------
-- Enums (meal_slot is reused from 0005_meal_plans.sql)
-- ---------------------------------------------------------------------------
CREATE TYPE reminder_notification_type AS ENUM ('PUSH', 'SILENT', 'NONE');
CREATE TYPE reminder_delivery_kind     AS ENUM ('MAIN', 'PRE_ALERT');
CREATE TYPE reminder_delivery_status   AS ENUM ('PENDING', 'SENT', 'FAILED');

-- ---------------------------------------------------------------------------
-- Table: meal_reminders
-- One reminder per (owner, meal slot) — the setup screen manages exactly one
-- row per slot (design/screens/mobile-reminder-setup.html). The domain model
-- would allow several per slot; the UNIQUE can be dropped if that ever ships.
-- ---------------------------------------------------------------------------
CREATE TABLE meal_reminders (
	id                 uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
	owner_id           uuid                       NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
	household_id       uuid,                      -- no FK until Household feature

	name               text                       NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
	meal_slot          meal_slot                  NOT NULL, -- reminders target a specific band (domain §MealSlot note)

	reminder_time      time                       NOT NULL, -- INV-PL-010: `time` cannot hold an invalid clock value
	pre_alert_minutes  integer                    CHECK (pre_alert_minutes IS NULL OR pre_alert_minutes BETWEEN 1 AND 1440), -- REQ-MR-002; NULL = no pre-alert

	is_enabled         boolean                    NOT NULL DEFAULT true,
	-- ISO day numbers, 1 = Monday .. 7 = Sunday (matches extract(isodow ...)).
	days_of_week       smallint[]                 NOT NULL DEFAULT '{1,2,3,4,5,6,7}'
		CHECK (days_of_week <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]),
	CONSTRAINT meal_reminders_enabled_needs_days  -- INV-PL-011
		CHECK (NOT is_enabled OR cardinality(days_of_week) >= 1),

	notification_type  reminder_notification_type NOT NULL DEFAULT 'PUSH',
	timezone           text                       NOT NULL DEFAULT 'UTC' CHECK (char_length(timezone) BETWEEN 1 AND 64),

	created_at         timestamptz                NOT NULL DEFAULT now(),
	updated_at         timestamptz                NOT NULL DEFAULT now(),

	CONSTRAINT meal_reminders_owner_slot_unique UNIQUE (owner_id, meal_slot)
);

CREATE INDEX meal_reminders_owner_idx   ON meal_reminders (owner_id);
CREATE INDEX meal_reminders_enabled_idx ON meal_reminders (is_enabled) WHERE is_enabled;

-- ---------------------------------------------------------------------------
-- Shape validation + normalization (pattern: 0009). Sorts/dedups days_of_week
-- so the INV-PL-011 cardinality check counts distinct days, and rejects time
-- zone names Postgres does not know (a CHECK cannot catch the raised error,
-- and a bad zone would silently break every due-time computation).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION meal_reminders_validate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
	NEW.days_of_week := COALESCE(
		(SELECT array_agg(DISTINCT d ORDER BY d) FROM unnest(NEW.days_of_week) AS d),
		'{}'::smallint[]
	);
	BEGIN
		PERFORM now() AT TIME ZONE NEW.timezone;
	EXCEPTION WHEN OTHERS THEN
		RAISE EXCEPTION 'timezone must be a valid IANA time zone name'
			USING ERRCODE = 'check_violation';
	END;
	RETURN NEW;
END;
$$;

CREATE TRIGGER trg_meal_reminders_validate
	BEFORE INSERT OR UPDATE ON meal_reminders
	FOR EACH ROW EXECUTE FUNCTION meal_reminders_validate();

CREATE TRIGGER trg_meal_reminders_updated_at
	BEFORE UPDATE ON meal_reminders
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security (P7: enabled, default-deny, owner-scoped). Full CRUD for
-- the owner — a reminder is plain preference data with no append-only rules.
-- ---------------------------------------------------------------------------
ALTER TABLE meal_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_reminders_owner_all"
	ON meal_reminders FOR ALL
	USING (owner_id = auth.uid())
	WITH CHECK (owner_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE meal_reminders;

GRANT SELECT, INSERT, UPDATE, DELETE ON meal_reminders TO authenticated;
GRANT ALL ON meal_reminders TO service_role;
-- anon gets SELECT capability only; RLS still yields zero rows pre-login.
GRANT SELECT ON meal_reminders TO anon;

-- ---------------------------------------------------------------------------
-- Table: reminder_deliveries — the dedup ledger. One row per attempted send;
-- the UNIQUE key is what makes Cron retries and overlapping runs safe (the
-- Edge Function claims an occurrence with INSERT .. ON CONFLICT DO NOTHING).
--
-- Written ONLY by the Edge Function (service_role): authenticated gets no
-- INSERT/UPDATE/DELETE grant and no write policy. That is deliberate — it also
-- means the table needs NO SECURITY DEFINER ownership guard on reminder_id
-- (the trigger pattern from 0007/0009 that issue #14 flags as blocking
-- service-role writes, because auth.uid() is NULL there). No client can write
-- a cross-user reference through a table it cannot write to at all.
-- ---------------------------------------------------------------------------
CREATE TABLE reminder_deliveries (
	id           uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
	reminder_id  uuid                     NOT NULL REFERENCES meal_reminders (id) ON DELETE CASCADE,
	-- Denormalized (no auth.uid() default — the writer is service_role, where
	-- auth.uid() is NULL; the Edge Function supplies it from the reminder row).
	owner_id     uuid                     NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

	kind         reminder_delivery_kind   NOT NULL,
	local_date   date                     NOT NULL, -- the occurrence's calendar date in the reminder's own time zone

	status       reminder_delivery_status NOT NULL DEFAULT 'PENDING',
	detail       text                     CHECK (detail IS NULL OR char_length(detail) <= 500),
	sent_at      timestamptz,

	created_at   timestamptz              NOT NULL DEFAULT now(),
	updated_at   timestamptz              NOT NULL DEFAULT now(),

	-- The dedup key: one attempt per reminder occurrence. No retry loop in v1 —
	-- a failed send stays FAILED (visible here + in function logs) and the next
	-- occurrence proceeds normally; a missed nudge is never re-sent late (REQ-MR-005).
	CONSTRAINT reminder_deliveries_occurrence_unique UNIQUE (reminder_id, kind, local_date)
);

CREATE INDEX reminder_deliveries_owner_date_idx ON reminder_deliveries (owner_id, local_date DESC);

CREATE TRIGGER trg_reminder_deliveries_updated_at
	BEFORE UPDATE ON reminder_deliveries
	FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE reminder_deliveries ENABLE ROW LEVEL SECURITY;

-- Owners may see their delivery history (e.g. future "you got a nudge" UI);
-- deliberately NO INSERT/UPDATE/DELETE policy — writes are service_role only.
CREATE POLICY "reminder_deliveries_owner_select"
	ON reminder_deliveries FOR SELECT
	USING (owner_id = auth.uid());

GRANT SELECT ON reminder_deliveries TO authenticated;
GRANT ALL ON reminder_deliveries TO service_role;
GRANT SELECT ON reminder_deliveries TO anon;
REVOKE INSERT, UPDATE, DELETE ON reminder_deliveries FROM authenticated, anon;

-- ---------------------------------------------------------------------------
-- due_meal_reminders(): everything time-zone- and calendar-shaped lives here,
-- in SQL, where pgTAP can prove it — the Edge Function is just a dispatch loop.
--
-- A reminder occurrence (MAIN at reminder_time, PRE_ALERT at reminder_time −
-- pre_alert_minutes) is due when, in the reminder's own time zone, it falls
-- inside (now − window, now] on a selected ISO day, and no delivery row exists
-- for it yet. The window is a catch-up allowance for Cron jitter, sized small
-- on purpose: a reminder the scheduler missed by more than ~10 minutes is
-- dropped, never delivered stale (REQ-MR-005). Occurrences whose window spans
-- local midnight (including pre-alerts of an after-midnight meal) are a known
-- non-goal — meal reminders live in daytime.
--
-- planned_meal_name/source personalize the copy ("Your Marinara pasta is
-- prepped and ready…") from the owner's still-PLANNED meal in that slot today.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.due_meal_reminders(
	p_now timestamptz DEFAULT now(),
	p_window_minutes integer DEFAULT 10
)
RETURNS TABLE (
	reminder_id        uuid,
	owner_id           uuid,
	kind               reminder_delivery_kind,
	name               text,
	meal_slot          meal_slot,
	reminder_time      time,
	pre_alert_minutes  integer,
	local_date         date,
	planned_meal_name  text,
	planned_meal_source planned_meal_source
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
	WITH occurrences AS (
		SELECT
			r.id, r.owner_id, r.name, r.meal_slot, r.reminder_time, r.pre_alert_minutes,
			k.kind,
			(p_now AT TIME ZONE r.timezone) AS local_now,
			((p_now AT TIME ZONE r.timezone)::date + r.reminder_time
				- CASE k.kind
					WHEN 'PRE_ALERT'::reminder_delivery_kind THEN make_interval(mins => r.pre_alert_minutes)
					ELSE interval '0'
				  END) AS occurs_at_local,
			(p_now AT TIME ZONE r.timezone)::date AS local_date,
			r.days_of_week
		FROM meal_reminders r
		CROSS JOIN LATERAL (
			VALUES ('MAIN'::reminder_delivery_kind), ('PRE_ALERT'::reminder_delivery_kind)
		) AS k (kind)
		WHERE r.is_enabled
		  AND r.notification_type = 'PUSH'
		  AND (k.kind = 'MAIN' OR r.pre_alert_minutes IS NOT NULL)
	)
	SELECT
		o.id, o.owner_id, o.kind, o.name, o.meal_slot, o.reminder_time, o.pre_alert_minutes,
		o.local_date,
		pm.display_name, pm.source
	FROM occurrences o
	LEFT JOIN LATERAL (
		SELECT
			COALESCE(p.recipe_title_snapshot, p.prepped_name_snapshot,
			         p.store_bought_name, p.quick_meal_name) AS display_name,
			p.source
		FROM planned_meals p
		JOIN meal_plans mp ON mp.id = p.meal_plan_id
		WHERE mp.owner_id = o.owner_id
		  AND p.date = o.local_date
		  AND p.meal_slot = o.meal_slot
		  AND p.status = 'PLANNED'
		ORDER BY p.sort_order
		LIMIT 1
	) pm ON true
	WHERE o.occurs_at_local <= o.local_now
	  AND o.occurs_at_local > o.local_now - make_interval(mins => p_window_minutes)
	  AND extract(isodow FROM o.local_date)::smallint = ANY (o.days_of_week)
	  AND NOT EXISTS (
		SELECT 1 FROM reminder_deliveries d
		WHERE d.reminder_id = o.id AND d.kind = o.kind AND d.local_date = o.local_date
	  );
$$;

-- Server-only: reads across all users, so it must never be callable through
-- the Data API with a user JWT. (SECURITY INVOKER: as service_role it bypasses
-- RLS; there is no definer privilege lying around for anyone else.)
REVOKE EXECUTE ON FUNCTION public.due_meal_reminders(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.due_meal_reminders(timestamptz, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- Cron wiring: pg_cron ticks every minute → invoke_send_meal_reminders() →
-- pg_net POST to the send-meal-reminders Edge Function. The project URL and
-- the caller credential live in Vault (per-environment, never in a migration):
--
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random secret>', 'send_meal_reminders_secret');
--
-- The credential is a random shared secret (openssl rand -hex 32), sent as
-- x-cron-secret and checked by the function against its CRON_SHARED_SECRET
-- env — NOT the anon key: any valid Supabase JWT (the anon key is one, and it
-- is public) would satisfy the gateway's verify_jwt, gating nothing.
--
-- Until both secrets exist (e.g. fresh local stack) the function no-ops, so
-- the schedule is safe to create unconditionally. Repeat sends are impossible
-- regardless of how often this fires — dedup is the deliveries UNIQUE key.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.invoke_send_meal_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	v_url text;
	v_secret text;
BEGIN
	SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url';
	SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'send_meal_reminders_secret';
	IF v_url IS NULL OR v_secret IS NULL THEN
		RETURN; -- not configured in this environment — nothing to invoke
	END IF;
	PERFORM net.http_post(
		url := v_url || '/functions/v1/send-meal-reminders',
		headers := jsonb_build_object(
			'Content-Type', 'application/json',
			'x-cron-secret', v_secret
		),
		body := '{}'::jsonb,
		timeout_milliseconds := 8000
	);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_send_meal_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_send_meal_reminders() TO service_role;

-- cron.schedule upserts by job name, so db reset / re-push stays idempotent.
SELECT cron.schedule(
	'send-meal-reminders',
	'* * * * *',
	'SELECT public.invoke_send_meal_reminders()'
);
