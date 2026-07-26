-- RLS isolation + integrity tests for meal_reminders / reminder_deliveries /
-- due_meal_reminders (feature 007, REQ-MR-001..003, INV-PL-010/011, P7/P14).
-- Run with: `supabase test db`. Requires 0010_meal_reminders applied.
--
-- Proves (1) owner-only visibility and mutation of reminders, (2) the schema
-- invariants (days subset + INV-PL-011, pre-alert bounds, timezone validity,
-- one-per-slot, day normalization), (3) the deliveries ledger is read-only for
-- clients and deduped by occurrence, (4) due_meal_reminders is server-only and
-- its timezone/window/day/dedup logic is correct, (5) the cron job exists and
-- the invoker no-ops safely without Vault secrets.

begin;
select plan(31);

insert into auth.users (id, email)
values
	('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
	('22222222-2222-2222-2222-222222222222', 'bob@test.local')
on conflict (id) do nothing;

-- ── Act as Alice ───────────────────────────────────────────────────────────
set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
	true
);

-- Friday 2026-07-10, 18:30 in New York = 22:30 UTC. Days deliberately messy
-- ({5,5,1}) to prove normalization; Friday (isodow 5) is selected.
insert into public.meal_reminders (id, name, meal_slot, reminder_time, pre_alert_minutes, timezone, days_of_week)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dinner time', 'DINNER', '18:30', 30, 'America/New_York', '{5,5,1}');

insert into public.meal_reminders (id, name, meal_slot, reminder_time, timezone)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lunch time', 'LUNCH', '12:30', 'Asia/Tokyo');

select is(
	(select count(*) from public.meal_reminders),
	2::bigint,
	'Alice sees her two reminders'
);

select is(
	(select days_of_week from public.meal_reminders where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
	'{1,5}'::smallint[],
	'days_of_week is deduped and sorted on write'
);

-- Schema invariants
select throws_ok(
	$$insert into public.meal_reminders (name, meal_slot, reminder_time, is_enabled, days_of_week)
	  values ('No days', 'BREAKFAST', '08:00', true, '{}')$$,
	'23514', null,
	'INV-PL-011: enabled reminder with zero days is rejected'
);
select throws_ok(
	$$insert into public.meal_reminders (name, meal_slot, reminder_time, days_of_week)
	  values ('Bad day', 'BREAKFAST', '08:00', '{8}')$$,
	'23514', null,
	'days_of_week outside ISO 1..7 is rejected'
);
select throws_ok(
	$$insert into public.meal_reminders (name, meal_slot, reminder_time, timezone)
	  values ('Bad zone', 'BREAKFAST', '08:00', 'Mars/Olympus_Mons')$$,
	'23514', null,
	'unknown IANA time zone is rejected'
);
select throws_ok(
	$$insert into public.meal_reminders (name, meal_slot, reminder_time, pre_alert_minutes)
	  values ('Bad prealert', 'BREAKFAST', '08:00', 0)$$,
	'23514', null,
	'pre_alert_minutes = 0 is rejected (NULL means no pre-alert)'
);
select throws_ok(
	$$insert into public.meal_reminders (name, meal_slot, reminder_time)
	  values ('Second dinner', 'DINNER', '20:00')$$,
	'23505', null,
	'one reminder per (owner, slot): duplicate DINNER is rejected'
);

-- Disabled reminder may have empty days (INV-PL-011 only binds when enabled)
insert into public.meal_reminders (name, meal_slot, reminder_time, is_enabled, days_of_week)
values ('Snack maybe', 'SNACK', '15:00', false, '{}');
select is(
	(select count(*) from public.meal_reminders where is_enabled = false),
	1::bigint,
	'disabled reminder with no days is allowed'
);

-- Clients cannot write the delivery ledger at all (no grant, no policy)
select throws_ok(
	$$insert into public.reminder_deliveries (reminder_id, owner_id, kind, local_date)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'MAIN', '2026-07-10')$$,
	'42501', null,
	'authenticated cannot INSERT reminder_deliveries'
);

-- due_meal_reminders is server-only
select throws_ok(
	$$select * from public.due_meal_reminders()$$,
	'42501', null,
	'authenticated cannot execute due_meal_reminders'
);

-- ── Act as Bob ─────────────────────────────────────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
	true
);

select is(
	(select count(*) from public.meal_reminders),
	0::bigint,
	'Bob sees none of Alice''s reminders'
);

select lives_ok(
	$$update public.meal_reminders set is_enabled = false
	  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
	'Bob''s update of Alice''s reminder is silently scoped away by RLS'
);
select lives_ok(
	$$delete from public.meal_reminders
	  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
	'Bob''s delete of Alice''s reminder is silently scoped away by RLS'
);

-- ── Server context (postgres, as the Edge Function's service_role would) ───
reset role;

select is(
	(select count(*) from public.meal_reminders
	 where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and is_enabled),
	1::bigint,
	'Alice''s reminder survives Bob''s update/delete attempts untouched'
);

-- Alice has a still-PLANNED quick meal for Friday dinner → personalizes copy
insert into public.meal_plans (id, owner_id, start_date, end_date)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '2026-07-06', '2026-07-12');
insert into public.planned_meals (id, meal_plan_id, date, meal_slot, source, quick_meal_name, servings, sort_order)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-07-10', 'DINNER', 'QUICK', 'Marinara pasta', 1, 0);

-- MAIN occurrence: 18:30 America/New_York on Friday = 22:30 UTC
select is(
	(select count(*) from public.due_meal_reminders('2026-07-10T22:31:00Z')),
	1::bigint,
	'MAIN dinner reminder is due one minute after its local time'
);
select is(
	(select kind from public.due_meal_reminders('2026-07-10T22:31:00Z')),
	'MAIN'::reminder_delivery_kind,
	'the due occurrence is the MAIN one'
);
select is(
	(select planned_meal_name from public.due_meal_reminders('2026-07-10T22:31:00Z')),
	'Marinara pasta',
	'the due row carries the planned meal name for personalized copy'
);
select is(
	(select local_date from public.due_meal_reminders('2026-07-10T22:31:00Z')),
	'2026-07-10'::date,
	'local_date is the occurrence date in the reminder''s zone'
);

-- PRE_ALERT occurrence: 18:00 local = 22:00 UTC (REQ-MR-002)
select is(
	(select kind from public.due_meal_reminders('2026-07-10T22:05:00Z')),
	'PRE_ALERT'::reminder_delivery_kind,
	'PRE_ALERT is due pre_alert_minutes before the meal'
);

-- Window edges: too early / too late (never delivered stale, REQ-MR-005)
select is(
	(select count(*) from public.due_meal_reminders('2026-07-10T22:29:00Z')),
	0::bigint,
	'nothing due one minute before reminder time (pre-alert window passed)'
);
select is(
	(select count(*) from public.due_meal_reminders('2026-07-10T22:45:00Z')),
	0::bigint,
	'a reminder missed by more than the window is dropped, not sent late'
);

-- Day-of-week: Saturday 2026-07-11 (isodow 6) is not in {1,5}
select is(
	(select count(*) from public.due_meal_reminders('2026-07-11T22:31:00Z')),
	0::bigint,
	'reminder does not fire on an unselected day'
);

-- Timezone math: Alice''s Tokyo lunch reminder — 12:30 Asia/Tokyo on Friday
-- 2026-07-10 = 03:30 UTC the same day
select is(
	(select name from public.due_meal_reminders('2026-07-10T03:35:00Z')),
	'Lunch time',
	'due computation respects each reminder''s own time zone'
);

-- Suppression: disabled and non-PUSH reminders never come due
update public.meal_reminders set is_enabled = false
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
	(select count(*) from public.due_meal_reminders('2026-07-10T22:31:00Z')),
	0::bigint,
	'disabled reminder is never due'
);
update public.meal_reminders set is_enabled = true, notification_type = 'SILENT'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
	(select count(*) from public.due_meal_reminders('2026-07-10T22:31:00Z')),
	0::bigint,
	'SILENT reminder is never pushed'
);
update public.meal_reminders set notification_type = 'PUSH'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Dedup: a delivery row for the occurrence excludes it from due results
insert into public.reminder_deliveries (reminder_id, owner_id, kind, local_date)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'MAIN', '2026-07-10');
select is(
	(select count(*) from public.due_meal_reminders('2026-07-10T22:31:00Z')),
	0::bigint,
	'an occurrence with a delivery row is not due again'
);
select throws_ok(
	$$insert into public.reminder_deliveries (reminder_id, owner_id, kind, local_date)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'MAIN', '2026-07-10')$$,
	'23505', null,
	'the occurrence UNIQUE key rejects a duplicate claim'
);

-- Owner-scoped read of the ledger
set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
	true
);
select is(
	(select count(*) from public.reminder_deliveries),
	1::bigint,
	'Alice sees her own delivery history'
);
select set_config(
	'request.jwt.claims',
	'{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
	true
);
select is(
	(select count(*) from public.reminder_deliveries),
	0::bigint,
	'Bob sees none of Alice''s deliveries'
);
reset role;

-- Cron wiring
select is(
	(select count(*) from cron.job where jobname = 'send-meal-reminders' and schedule = '* * * * *'),
	1::bigint,
	'the send-meal-reminders cron job is scheduled every minute'
);
select lives_ok(
	$$select public.invoke_send_meal_reminders()$$,
	'invoker no-ops safely when Vault secrets are not configured'
);

select * from finish();
rollback;
