-- RLS isolation + integrity tests for meal_logs (feature 006, FR-TL-020,
-- INV-XD-001/002, INV-CC-004, constitution P7/P14).
-- Run with: `supabase test db`. Requires 0009_meal_logs applied.
--
-- Proves (1) owner-only visibility and mutation, (2) the append-only annotation
-- window (only verdict/notes updatable, no DELETE at all), (3) insert-time
-- type↔reference validation, (4) the cross-user source-ownership guard, and
-- (5) the ledger link: a CONSUMED portion event can carry the log's id.

begin;
select plan(26);

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

-- Sources: a plan with one planned meal, a recipe, and a prepped meal (2 portions)
insert into public.meal_plans (id, start_date, end_date)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-06', '2026-07-12');

insert into public.planned_meals (id, meal_plan_id, date, meal_slot, source, quick_meal_name, servings, sort_order)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-07-09', 'LUNCH', 'QUICK', 'Marinara pasta', 1, 0);

insert into public.recipes (id, title, servings)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Lentil curry', 4);

insert into public.prepped_meals (id, owner_id, origin, name, portions_remaining, original_portions, storage_location, prepared_date, expiration_date)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'DIRECT_ENTRY', 'Chili', 2, 2, 'FRIDGE', '2026-07-08', '2026-07-12');

-- FROM_PLAN log (one-tap on the lunch card)
insert into public.meal_logs (id, log_type, planned_meal_id, name_snapshot, meal_slot, servings, logged_at)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'FROM_PLAN', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Marinara pasta', 'LUNCH', 1, '2026-07-09T12:04:00Z');

-- QUICK_LOG: "I ate something" — no name, no refs, no verdict
insert into public.meal_logs (log_type, meal_slot)
values ('QUICK_LOG', 'SNACK');

select is(
	(select count(*) from public.meal_logs),
	2::bigint,
	'Alice sees her two logs (incl. nameless QUICK_LOG, REQ-MR-009)'
);

-- Insert-time shape validation (trigger, research R3)
select throws_ok(
	$$insert into public.meal_logs (log_type, name_snapshot) values ('FROM_PLAN', 'Ghost meal')$$,
	'23514', null,
	'INV-XD-001: FROM_PLAN without planned_meal_id is rejected'
);
select throws_ok(
	$$insert into public.meal_logs (log_type, name_snapshot) values ('FROM_PREPPED', 'Ghost chili')$$,
	'23514', null,
	'INV-XD-002: FROM_PREPPED without prepped_meal_id is rejected'
);
select throws_ok(
	$$insert into public.meal_logs (log_type, name_snapshot) values ('FROM_RECIPE', 'Ghost curry')$$,
	'23514', null,
	'FROM_RECIPE without recipe_id is rejected'
);
select throws_ok(
	$$insert into public.meal_logs (log_type) values ('CUSTOM')$$,
	'23514', null,
	'CUSTOM without name_snapshot is rejected'
);
select throws_ok(
	$$insert into public.meal_logs (log_type, name_snapshot, servings) values ('CUSTOM', 'Crumbs', 0)$$,
	'23514', null,
	'zero servings is rejected (PositiveDecimal)'
);

-- Annotation window (INV-CC-004): verdict + notes may change…
update public.meal_logs set verdict = 'KEEP', notes = 'so good'
where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select is(
	(select verdict from public.meal_logs where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
	'KEEP'::meal_verdict,
	'verdict can be set after insert (annotation window)'
);

update public.meal_logs set verdict = null
where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select is(
	(select verdict from public.meal_logs where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
	null,
	'verdict is deselectable back to unrated (FR-TL-015)'
);

-- …but occurrence facts may not
select throws_ok(
	$$update public.meal_logs set servings = 2 where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
	'23514', null,
	'INV-CC-004: servings is immutable after insert'
);
select throws_ok(
	$$update public.meal_logs set logged_at = now() where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
	'23514', null,
	'INV-CC-004: logged_at is immutable after insert'
);
select throws_ok(
	$$update public.meal_logs set name_snapshot = 'Rewritten history' where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
	'23514', null,
	'INV-CC-004: name_snapshot is immutable after insert'
);

-- …and a reference can never be rewritten to a different row
select throws_ok(
	$$update public.meal_logs set prepped_meal_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
	  where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
	'23514', null,
	'INV-CC-004: a source reference cannot be rewritten to another row'
);

-- Deleting a source must NOT be blocked by the annotation trigger: the FK's
-- ON DELETE SET NULL carve-out keeps history durable via the name snapshot.
insert into public.recipes (id, title, servings)
values ('cccccccc-cccc-cccc-cccc-000000000000', 'Weeknight soup', 2);
insert into public.meal_logs (id, log_type, recipe_id, name_snapshot)
values ('eeeeeeee-eeee-eeee-eeee-000000000000', 'FROM_RECIPE', 'cccccccc-cccc-cccc-cccc-000000000000', 'Weeknight soup');
delete from public.recipes where id = 'cccccccc-cccc-cccc-cccc-000000000000';
select is(
	(select recipe_id from public.meal_logs where id = 'eeeeeeee-eeee-eeee-eeee-000000000000'),
	null,
	'deleting a logged recipe nulls the reference (SET NULL survives the trigger)'
);
select is(
	(select name_snapshot from public.meal_logs where id = 'eeeeeeee-eeee-eeee-eeee-000000000000'),
	'Weeknight soup',
	'the log stays displayable via its name snapshot after source deletion'
);

-- No DELETE at all (P14, spec A-004): the grant itself is withheld
select throws_ok(
	$$delete from public.meal_logs where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
	'42501', null,
	'meal logs cannot be deleted (no DELETE grant, append-only)'
);

-- FROM_PREPPED log + the ledger link reserved in 0004: CONSUMED carries the log id
insert into public.meal_logs (id, log_type, prepped_meal_id, name_snapshot, meal_slot, servings)
values ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'FROM_PREPPED', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Chili', 'DINNER', 1);

insert into public.portion_events (prepped_meal_id, delta_portions, kind, triggered_by)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', -1, 'CONSUMED', 'ffffffff-ffff-ffff-ffff-ffffffffffff');

select is(
	(select portions_remaining from public.prepped_meals where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
	1,
	'INV-XD-003: logging a prepped meal consumes a portion via the ledger'
);
select is(
	(select triggered_by from public.portion_events where kind = 'CONSUMED' and prepped_meal_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
	'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
	'the CONSUMED event is attributed to the meal log (triggered_by)'
);

-- ── Act as Bob ─────────────────────────────────────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
	true
);

select is(
	(select count(*) from public.meal_logs),
	0::bigint,
	'Bob cannot SELECT Alice''s logs (RLS isolation)'
);

-- Bob's UPDATE silently affects zero rows (default-deny)
update public.meal_logs set verdict = 'REST' where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
select is(
	(select count(*) from public.meal_logs where verdict = 'REST'),
	0::bigint,
	'Bob cannot UPDATE Alice''s log verdict'
);

-- Cross-user source references are rejected by the SECURITY DEFINER guard,
-- closing the UUID-existence oracle the owner-privileged FK would open.
select throws_ok(
	$$insert into public.meal_logs (log_type, planned_meal_id, name_snapshot)
	  values ('FROM_PLAN', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Intruder log')$$,
	'42501', null,
	'Bob cannot log against Alice''s planned meal'
);
select throws_ok(
	$$insert into public.meal_logs (log_type, recipe_id, name_snapshot)
	  values ('FROM_RECIPE', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Intruder curry')$$,
	'42501', null,
	'Bob cannot log against Alice''s recipe'
);
select throws_ok(
	$$insert into public.meal_logs (log_type, prepped_meal_id, name_snapshot)
	  values ('FROM_PREPPED', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Intruder chili')$$,
	'42501', null,
	'Bob cannot log against Alice''s prepped meal'
);

-- Bob cannot attribute his own portion events to Alice's meal log
insert into public.prepped_meals (id, owner_id, origin, name, portions_remaining, original_portions, storage_location, prepared_date, expiration_date)
values ('dddddddd-dddd-dddd-dddd-000000000000', '22222222-2222-2222-2222-222222222222', 'DIRECT_ENTRY', 'Bob stew', 2, 2, 'FRIDGE', '2026-07-08', '2026-07-12');
select throws_ok(
	$$insert into public.portion_events (prepped_meal_id, delta_portions, kind, triggered_by)
	  values ('dddddddd-dddd-dddd-dddd-000000000000', -1, 'CONSUMED', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')$$,
	'42501', null,
	'Bob cannot attribute a portion event to Alice''s meal log (triggered_by guard)'
);

-- Bob logging his own quick meal still works (policies allow owners)
insert into public.meal_logs (log_type) values ('QUICK_LOG');
select is(
	(select count(*) from public.meal_logs),
	1::bigint,
	'Bob sees exactly his own new log'
);

-- ── Back to Alice: her data is intact ──────────────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
	true
);
select is(
	(select count(*) from public.meal_logs),
	4::bigint,
	'Alice still sees exactly her four logs'
);
select is(
	(select verdict from public.meal_logs where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
	null,
	'Alice''s log verdict unchanged after Bob''s update attempt'
);

select * from finish();
rollback;
