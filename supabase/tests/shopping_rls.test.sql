-- RLS isolation + integrity-constraint tests for the shopping schema
-- (FR-SH-020/021, INV-SH-002/003/004, constitution P7).
-- Run with: `supabase test db` (pgTAP). Requires the 0007_shopping migration applied.
--
-- Proves (1) a second user cannot read or modify the first user's lists or items,
-- and (2) invalid rows cannot be stored at all: non-positive quantity, CHECKED
-- without checked_at, COMPLETED without completed_at, and a FROM_PLAN list
-- without its generation range.

begin;
select plan(19);

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

insert into public.shopping_lists (id, name)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Weekly shopping');

insert into public.shopping_list_items (id, shopping_list_id, name, quantity, unit, category)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Onions', 4, 'x', 'PRODUCE');

select is(
	(select count(*) from public.shopping_lists),
	1::bigint,
	'Alice sees her own list'
);
select is(
	(select count(*) from public.shopping_list_items),
	1::bigint,
	'Alice sees her own items'
);

-- INV-SH-002: non-positive quantity rejected
select throws_ok(
	$$insert into public.shopping_list_items (shopping_list_id, name, quantity)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ghost item', 0)$$,
	'23514',
	null,
	'INV-SH-002: zero quantity is rejected'
);

-- INV-SH-003: CHECKED without checked_at rejected
select throws_ok(
	$$update public.shopping_list_items set status = 'CHECKED'
	  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
	'23514',
	null,
	'INV-SH-003: CHECKED without checked_at is rejected'
);

-- INV-SH-003: CHECKED with checked_at accepted
update public.shopping_list_items
set status = 'CHECKED', checked_at = now()
where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select is(
	(select count(*) from public.shopping_list_items where status = 'CHECKED'),
	1::bigint,
	'INV-SH-003: CHECKED with checked_at is accepted'
);

-- INV-SH-004: COMPLETED without completed_at rejected
select throws_ok(
	$$update public.shopping_lists set status = 'COMPLETED'
	  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
	'23514',
	null,
	'INV-SH-004: COMPLETED without completed_at is rejected'
);

-- FROM_PLAN requires its generation range
select throws_ok(
	$$insert into public.shopping_lists (name, source_type) values ('Planless', 'FROM_PLAN')$$,
	'23514',
	null,
	'FROM_PLAN list without a generation range is rejected'
);

-- A MANUAL list cannot carry a partial generation range (NULL-semantics guard)
select throws_ok(
	$$insert into public.shopping_lists (name, generated_range_start) values ('Half range', '2026-06-11')$$,
	'23514',
	null,
	'MANUAL list with a partial range is rejected'
);

-- INV-SH-004 (strengthened): an in-progress list cannot carry completed_at
select throws_ok(
	$$update public.shopping_lists set completed_at = now()
	  where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
	'23514',
	null,
	'ACTIVE list with completed_at is rejected'
);

-- INV-SH-003 (strengthened): unchecking without clearing checked_at is rejected
select throws_ok(
	$$update public.shopping_list_items set status = 'PENDING'
	  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
	'23514',
	null,
	'INV-SH-003: PENDING with a stale checked_at is rejected'
);

-- Cross-user reference guard: Alice plans a meal; Bob must not be able to point
-- one of his own items at it (UUID-existence oracle / FR-SH-018 link integrity).
insert into public.meal_plans (id, start_date, end_date)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-06-08', '2026-06-14');
insert into public.planned_meals (id, meal_plan_id, date, source, store_bought_name, servings, sort_order)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2026-06-12', 'STORE_BOUGHT', 'Rotisserie chicken', 1, 0);

-- Alice CAN reference her own planned meal
insert into public.shopping_list_items (shopping_list_id, name, source_planned_meal_id)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Rotisserie chicken', 'dddddddd-dddd-dddd-dddd-dddddddddddd');
select is(
	(select count(*) from public.shopping_list_items where source_planned_meal_id is not null),
	1::bigint,
	'Owner can reference their own planned meal from an item'
);

-- ── Act as Bob ─────────────────────────────────────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
	true
);

select is(
	(select count(*) from public.shopping_lists),
	0::bigint,
	'Bob cannot SELECT Alice''s list (RLS isolation, FR-SH-020)'
);
select is(
	(select count(*) from public.shopping_list_items),
	0::bigint,
	'Bob cannot SELECT Alice''s items (RLS isolation, FR-SH-020)'
);

-- Bob's UPDATE/DELETE silently affect zero rows (default-deny)
update public.shopping_list_items set quantity = 99 where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
select is(
	(select count(*) from public.shopping_list_items where quantity = 99),
	0::bigint,
	'Bob cannot UPDATE Alice''s item'
);

delete from public.shopping_lists where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Bob cannot insert an item into Alice's list (WITH CHECK through parent list)
select throws_ok(
	$$insert into public.shopping_list_items (shopping_list_id, name)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Intruder item')$$,
	'42501',
	null,
	'Bob cannot INSERT into Alice''s list (RLS WITH CHECK)'
);

-- Bob cannot point one of HIS items at Alice's planned meal (ownership trigger)
insert into public.shopping_lists (id, name)
values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Bob''s list');
select throws_ok(
	$$insert into public.shopping_list_items (shopping_list_id, name, source_planned_meal_id)
	  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Sneaky probe', 'dddddddd-dddd-dddd-dddd-dddddddddddd')$$,
	'42501',
	null,
	'Bob cannot reference Alice''s planned meal from his item (cross-user FK guard)'
);

-- ── Back to Alice: her data is intact ──────────────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
	true
);
select is(
	(select count(*) from public.shopping_lists),
	1::bigint,
	'Alice''s list survived Bob''s delete attempt'
);
select is(
	(select quantity from public.shopping_list_items where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
	4::numeric,
	'Alice''s item is unchanged after Bob''s update attempt'
);

-- Completing properly works end to end
update public.shopping_lists
set status = 'COMPLETED', completed_at = now()
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
	(select count(*) from public.shopping_lists where status = 'COMPLETED' and completed_at is not null),
	1::bigint,
	'INV-SH-004: completing with completed_at succeeds'
);

select * from finish();
rollback;
