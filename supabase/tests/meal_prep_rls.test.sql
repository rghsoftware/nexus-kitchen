-- RLS isolation tests for the meal-prep batch-session tables
-- (meal_prep_sessions, meal_prep_session_recipes).
-- Covers P7 (default-deny RLS, owner-scoped) and the child table's parent-ownership gating.
-- Requires migrations 0009 applied.

begin;
select plan(16);

-- Two test users + a recipe each owns (FK target for session recipes).
insert into auth.users (id, email)
values
	('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
	('22222222-2222-2222-2222-222222222222', 'bob@test.local')
on conflict (id) do nothing;

insert into public.recipes (id, owner_id, title, servings)
values
	('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Alice Chili', 4),
	('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Bob Stew', 4)
on conflict (id) do nothing;

-- ── Act as Alice ──────────────────────────────────────────────────────────────
set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
	true
);

insert into public.meal_prep_sessions (id, prep_day)
values ('cccc1111-1111-1111-1111-111111111111', current_date + 2);

insert into public.meal_prep_session_recipes
	(id, meal_prep_session_id, recipe_id, recipe_name, servings_to_prep)
values
	('dddd1111-1111-1111-1111-111111111111',
	 'cccc1111-1111-1111-1111-111111111111',
	 'aaaa1111-1111-1111-1111-111111111111', 'Alice Chili', 6);

select is(
	(select count(*) from public.meal_prep_sessions),
	1::bigint,
	'Alice sees her own session'
);
select is(
	(select count(*) from public.meal_prep_session_recipes),
	1::bigint,
	'Alice sees her own session recipe'
);
select is(
	(select owner_id from public.meal_prep_sessions where id = 'cccc1111-1111-1111-1111-111111111111'),
	'11111111-1111-1111-1111-111111111111'::uuid,
	'owner_id defaulted to auth.uid()'
);

-- ── Act as Bob ────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
	true
);

select is(
	(select count(*) from public.meal_prep_sessions),
	0::bigint,
	'Bob cannot see Alice''s session'
);
select is(
	(select count(*) from public.meal_prep_session_recipes),
	0::bigint,
	'Bob cannot see Alice''s session recipe (parent-gated)'
);

-- Bob cannot UPDATE or DELETE Alice's session (0 rows affected — invisible under RLS).
with upd as (
	update public.meal_prep_sessions set status = 'CANCELLED'
	where id = 'cccc1111-1111-1111-1111-111111111111'
	returning 1
)
select is((select count(*) from upd), 0::bigint, 'Bob cannot UPDATE Alice''s session');

with del as (
	delete from public.meal_prep_sessions
	where id = 'cccc1111-1111-1111-1111-111111111111'
	returning 1
)
select is((select count(*) from del), 0::bigint, 'Bob cannot DELETE Alice''s session');

-- Bob cannot INSERT a session recipe into Alice's session (parent not owned → WITH CHECK fails).
select throws_ok(
	$$insert into public.meal_prep_session_recipes
		(meal_prep_session_id, recipe_id, recipe_name, servings_to_prep)
	  values ('cccc1111-1111-1111-1111-111111111111',
	          'bbbb2222-2222-2222-2222-222222222222', 'Sneaky', 1)$$,
	'42501',
	NULL,
	'Bob cannot INSERT a recipe into Alice''s session'
);

-- Bob's own session works and is isolated.
insert into public.meal_prep_sessions (id, prep_day)
values ('cccc2222-2222-2222-2222-222222222222', current_date + 3);
select is(
	(select count(*) from public.meal_prep_sessions),
	1::bigint,
	'Bob sees only his own session'
);

-- ── Constraint checks (independent of RLS) ────────────────────────────────────
-- servings_to_prep must be positive (INV-PL-007).
select throws_ok(
	$$insert into public.meal_prep_session_recipes
		(meal_prep_session_id, recipe_id, recipe_name, servings_to_prep)
	  values ('cccc2222-2222-2222-2222-222222222222',
	          'bbbb2222-2222-2222-2222-222222222222', 'Bob Stew', 0)$$,
	'23514',
	NULL,
	'servings_to_prep must be > 0 (INV-PL-007)'
);

-- A recipe appears at most once per session (UNIQUE).
insert into public.meal_prep_session_recipes
	(meal_prep_session_id, recipe_id, recipe_name, servings_to_prep)
values ('cccc2222-2222-2222-2222-222222222222',
        'bbbb2222-2222-2222-2222-222222222222', 'Bob Stew', 4);
select throws_ok(
	$$insert into public.meal_prep_session_recipes
		(meal_prep_session_id, recipe_id, recipe_name, servings_to_prep)
	  values ('cccc2222-2222-2222-2222-222222222222',
	          'bbbb2222-2222-2222-2222-222222222222', 'Bob Stew', 2)$$,
	'23505',
	NULL,
	'a recipe appears at most once per session (UNIQUE)'
);

-- Bob cannot reference Alice's recipe in his own session (ownership guard, not just FK).
select throws_ok(
	$$insert into public.meal_prep_session_recipes
		(meal_prep_session_id, recipe_id, recipe_name, servings_to_prep)
	  values ('cccc2222-2222-2222-2222-222222222222',
	          'aaaa1111-1111-1111-1111-111111111111', 'Alice Chili', 2)$$,
	'42501',
	NULL,
	'Bob cannot reference Alice''s recipe in his session (recipe ownership guard)'
);

-- ── Detach-on-delete: a FROM_PREP list survives session deletion as MANUAL (INV-XD-004) ──
insert into public.shopping_lists (name, source_type, meal_prep_session_id)
values ('Bob prep list', 'FROM_PREP', 'cccc2222-2222-2222-2222-222222222222');

-- Deleting the session must NOT abort on the FROM_PREP CHECK; the list is detached.
delete from public.meal_prep_sessions where id = 'cccc2222-2222-2222-2222-222222222222';

select is(
	(select source_type::text from public.shopping_lists where name = 'Bob prep list'),
	'MANUAL',
	'deleting a session detaches its FROM_PREP list to MANUAL (no CHECK violation)'
);
select is(
	(select meal_prep_session_id from public.shopping_lists where name = 'Bob prep list'),
	NULL::uuid,
	'the detached list no longer references the deleted session'
);

-- ── Anon role — no access at all ──────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select is(
	(select count(*) from public.meal_prep_sessions),
	0::bigint,
	'anon sees no meal_prep_sessions'
);
select is(
	(select count(*) from public.meal_prep_session_recipes),
	0::bigint,
	'anon sees no meal_prep_session_recipes'
);

select * from finish();
rollback;
