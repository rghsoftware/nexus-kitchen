-- RLS isolation + integrity-constraint tests for the planning schema
-- (SC-005, SC-006, INV-PL-001/002/003/004/012, constitution P7).
-- Run with: `supabase test db` (pgTAP). Requires the 0005_meal_plans migration applied.
--
-- Proves (1) a second user cannot read or modify the first user's plans or
-- planned meals, and (2) invalid requirements cannot be stored at all:
-- zero/negative servings, more than one source reference, a date outside the
-- plan's range, and duplicate sort order within a (plan, date, slot) group.

begin;
select plan(16);

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

insert into public.meal_plans (id, start_date, end_date)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-06-08', '2026-06-14');

insert into public.planned_meals (id, meal_plan_id, date, meal_slot, source, quick_meal_name, servings, sort_order)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-06-10', 'DINNER', 'QUICK', 'Takeout', 1, 0);

select is(
	(select count(*) from public.meal_plans),
	1::bigint,
	'Alice sees her own plan'
);
select is(
	(select count(*) from public.planned_meals),
	1::bigint,
	'Alice sees her own planned meal'
);

-- INV-PL-001: end date before start date is rejected
select throws_ok(
	$$insert into public.meal_plans (start_date, end_date) values ('2026-06-15', '2026-06-14')$$,
	'23514',
	null,
	'INV-PL-001: plan with end before start is rejected'
);

-- INV-PL-004: zero servings rejected
select throws_ok(
	$$insert into public.planned_meals (meal_plan_id, date, source, quick_meal_name, servings, sort_order)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-06-10', 'QUICK', 'Snack', 0, 9)$$,
	'23514',
	null,
	'INV-PL-004: zero servings is rejected'
);

-- INV-PL-003: two source references rejected
select throws_ok(
	$$insert into public.planned_meals (meal_plan_id, date, source, quick_meal_name, store_bought_name, servings, sort_order)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-06-10', 'QUICK', 'Takeout', 'Lasagna', 1, 9)$$,
	'23514',
	null,
	'INV-PL-003: more than one source reference is rejected'
);

-- INV-PL-003: source without its matching reference rejected
select throws_ok(
	$$insert into public.planned_meals (meal_plan_id, date, source, servings, sort_order)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-06-10', 'STORE_BOUGHT', 1, 9)$$,
	'23514',
	null,
	'INV-PL-003: source without matching reference is rejected'
);

-- INV-PL-002: date outside the plan range rejected (trigger)
select throws_ok(
	$$insert into public.planned_meals (meal_plan_id, date, source, quick_meal_name, servings, sort_order)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-06-20', 'QUICK', 'Takeout', 1, 9)$$,
	'23514',
	null,
	'INV-PL-002: meal date outside plan range is rejected'
);

-- INV-PL-012: duplicate sort order within the same (plan, date, slot) group rejected
select throws_ok(
	$$insert into public.planned_meals (meal_plan_id, date, meal_slot, source, quick_meal_name, servings, sort_order)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-06-10', 'DINNER', 'QUICK', 'Leftovers', 1, 0)$$,
	'23505',
	null,
	'INV-PL-012: duplicate sort order in a slot group is rejected'
);

-- INV-PL-012: the unslotted (Anytime) group is a real group — NULLS NOT DISTINCT
insert into public.planned_meals (meal_plan_id, date, meal_slot, source, quick_meal_name, servings, sort_order)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-06-10', null, 'QUICK', 'Shake', 1, 0);
select throws_ok(
	$$insert into public.planned_meals (meal_plan_id, date, meal_slot, source, quick_meal_name, servings, sort_order)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-06-10', null, 'QUICK', 'Second shake', 1, 0)$$,
	'23505',
	null,
	'INV-PL-012: duplicate sort order in the Anytime (null-slot) group is rejected'
);

-- One implicit plan per (owner, week)
select throws_ok(
	$$insert into public.meal_plans (start_date, end_date) values ('2026-06-08', '2026-06-14')$$,
	'23505',
	null,
	'FR-PL-011: a second plan for the same week and owner is rejected'
);

-- ── Act as Bob ─────────────────────────────────────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
	true
);

select is(
	(select count(*) from public.meal_plans),
	0::bigint,
	'Bob cannot SELECT Alice''s plan (RLS isolation, SC-006)'
);
select is(
	(select count(*) from public.planned_meals),
	0::bigint,
	'Bob cannot SELECT Alice''s planned meals (RLS isolation, SC-006)'
);

-- Bob's UPDATE/DELETE silently affect zero rows (default-deny)
update public.planned_meals set servings = 99 where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select is(
	(select count(*) from public.planned_meals where servings = 99),
	0::bigint,
	'Bob cannot UPDATE Alice''s planned meal'
);

delete from public.meal_plans where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Bob cannot insert a meal into Alice's plan (WITH CHECK through parent plan)
select throws_ok(
	$$insert into public.planned_meals (meal_plan_id, date, source, quick_meal_name, servings, sort_order)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-06-10', 'QUICK', 'Intruder meal', 1, 50)$$,
	'42501',
	null,
	'Bob cannot INSERT into Alice''s plan (RLS WITH CHECK)'
);

-- ── Back to Alice: her data is intact ──────────────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
	true
);
select is(
	(select count(*) from public.meal_plans),
	1::bigint,
	'Alice''s plan survived Bob''s delete attempt'
);
select is(
	(select servings from public.planned_meals where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
	1::numeric,
	'Alice''s planned meal is unchanged after Bob''s update attempt'
);

select * from finish();
rollback;
