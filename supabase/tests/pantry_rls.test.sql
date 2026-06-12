-- RLS isolation + trigger-invariant tests for pantry tables
-- (pantry_items, prepped_meals, portion_events).
-- Covers INV-SEC-004, P7 (default-deny RLS), P14 (append-only portion_events),
-- and INV-INV-004/005 (non-negative portions_remaining, trigger enforcement).
-- Requires migrations 0002–0004 applied.

begin;
select plan(22);

-- Two test users.
insert into auth.users (id, email)
values
	('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
	('22222222-2222-2222-2222-222222222222', 'bob@test.local')
on conflict (id) do nothing;

-- ── Act as Alice ──────────────────────────────────────────────────────────────
set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
	true
);

insert into public.pantry_items (id, owner_id, name, quantity, unit, storage_location)
values (
	'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
	'11111111-1111-1111-1111-111111111111',
	'Oats', 500, 'g', 'PANTRY'
);

insert into public.prepped_meals (
	id, owner_id, origin, name,
	portions_remaining, original_portions,
	storage_location, prepared_date, expiration_date, defrost_state
) values (
	'cccccccc-cccc-cccc-cccc-cccccccccccc',
	'11111111-1111-1111-1111-111111111111',
	'PREP_SESSION', 'Alice Chicken Curry',
	4, 4,
	'FRIDGE', current_date, current_date + 7, 'NOT_APPLICABLE'
);

insert into public.portion_events (prepped_meal_id, delta_portions, kind)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', -1, 'CONSUMED');

-- portions_remaining is now 3, original_portions still 4.

select is(
	(select count(*) from public.pantry_items),
	1::bigint,
	'Alice sees her own pantry_item'
);
select is(
	(select count(*) from public.prepped_meals),
	1::bigint,
	'Alice sees her own prepped_meal'
);
select is(
	(select count(*) from public.portion_events),
	1::bigint,
	'Alice sees her own portion_event'
);

-- ── Act as Bob ────────────────────────────────────────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
	true
);

select is(
	(select count(*) from public.pantry_items),
	0::bigint,
	'Bob cannot SELECT Alice''s pantry_items (RLS isolation)'
);
select is(
	(select count(*) from public.prepped_meals),
	0::bigint,
	'Bob cannot SELECT Alice''s prepped_meals (RLS isolation)'
);
select is(
	(select count(*) from public.portion_events),
	0::bigint,
	'Bob cannot SELECT Alice''s portion_events (child RLS via parent)'
);

with upd as (
	update public.pantry_items set name = 'hacked'
	where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
	returning 1
)
select is((select count(*) from upd), 0::bigint, 'Bob cannot UPDATE Alice''s pantry_item');

with del as (
	delete from public.pantry_items
	where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
	returning 1
)
select is((select count(*) from del), 0::bigint, 'Bob cannot DELETE Alice''s pantry_item');

with upd as (
	update public.prepped_meals set name = 'hacked'
	where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
	returning 1
)
select is((select count(*) from upd), 0::bigint, 'Bob cannot UPDATE Alice''s prepped_meal');

with del as (
	delete from public.prepped_meals
	where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
	returning 1
)
select is((select count(*) from del), 0::bigint, 'Bob cannot DELETE Alice''s prepped_meal');

select throws_ok(
	$$insert into public.pantry_items (owner_id, name, quantity, unit, storage_location)
	  values ('11111111-1111-1111-1111-111111111111', 'injected', 1, 'g', 'PANTRY')$$,
	'42501',
	NULL,
	'Bob cannot INSERT pantry_item claiming Alice''s owner_id'
);

select throws_ok(
	$$insert into public.prepped_meals (
		owner_id, origin, name, portions_remaining, original_portions,
		storage_location, prepared_date, expiration_date, defrost_state
	  ) values (
		'11111111-1111-1111-1111-111111111111',
		'DIRECT_ENTRY', 'injected meal', 1, 1,
		'FRIDGE', current_date, current_date + 7, 'NOT_APPLICABLE'
	  )$$,
	'42501',
	NULL,
	'Bob cannot INSERT prepped_meal claiming Alice''s owner_id'
);

select throws_ok(
	$$insert into public.portion_events (prepped_meal_id, delta_portions, kind)
	  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', -1, 'CONSUMED')$$,
	'42501',
	NULL,
	'Bob cannot INSERT portion_event on a prepped_meal he does not own'
);

-- ── Back to Alice — append-only enforcement (P14) ────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
	true
);

with upd as (
	update public.portion_events set delta_portions = -99
	where prepped_meal_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
	returning 1
)
select is(
	(select count(*) from upd), 0::bigint,
	'portion_events: UPDATE blocked (no UPDATE policy — append-only, P14)'
);

with del as (
	delete from public.portion_events
	where prepped_meal_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
	returning 1
)
select is(
	(select count(*) from del), 0::bigint,
	'portion_events: DELETE blocked (no DELETE policy — append-only, P14)'
);

-- ── Trigger: sync_portions_remaining() (INV-INV-004/005) ─────────────────────
-- State: portions_remaining=3, original_portions=4.

insert into public.portion_events (prepped_meal_id, delta_portions, kind)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', -1, 'CONSUMED');
-- portions_remaining=2, original_portions=4 (CONSUMED only touches remaining).

select is(
	(select portions_remaining from public.prepped_meals
	 where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
	2,
	'CONSUMED event decrements portions_remaining'
);

insert into public.portion_events (prepped_meal_id, delta_portions, kind)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', -2, 'ADJUSTED');
-- portions_remaining=0, original_portions=2 (ADJUSTED decrements both columns).

select is(
	(select portions_remaining from public.prepped_meals
	 where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
	0,
	'ADJUSTED event decrements portions_remaining'
);
select is(
	(select original_portions from public.prepped_meals
	 where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
	2,
	'ADJUSTED event decrements original_portions'
);

-- portions_remaining is now 0; a CONSUMED -1 would push it to -1.
select throws_ok(
	$$insert into public.portion_events (prepped_meal_id, delta_portions, kind)
	  values ('cccccccc-cccc-cccc-cccc-cccccccccccc', -1, 'CONSUMED')$$,
	'23514',
	NULL,
	'INV-INV-004: trigger rejects a CONSUMED event that would make portions_remaining negative'
);

-- ── Anon role — no access at all ──────────────────────────────────────────────
-- Clear JWT claims so auth.uid() returns NULL (pantry policies don't use TO authenticated,
-- so the USING expression is evaluated for anon — NULL uid → no rows visible).
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is(
	(select count(*) from public.pantry_items),
	0::bigint,
	'anon role sees no pantry_items'
);
select is(
	(select count(*) from public.prepped_meals),
	0::bigint,
	'anon role sees no prepped_meals'
);
select is(
	(select count(*) from public.portion_events),
	0::bigint,
	'anon role sees no portion_events'
);

select * from finish();
rollback;
