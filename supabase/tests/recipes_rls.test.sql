-- RLS isolation test for the recipes schema (SC-004, INV-SEC-004, constitution P7).
-- Run with: `supabase test db` (pgTAP). Requires the 0001_recipes migration applied.
--
-- Proves a second user cannot read or modify the first user's recipes or their child rows.
-- Simulates Supabase auth by setting role = authenticated and request.jwt.claims.sub = <uid>,
-- which is what auth.uid() reads inside the policies.

begin;
select plan(17);

-- Two test users (recipes.owner_id FKs to auth.users).
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

insert into public.recipes (id, title, servings)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Curry', 4);

insert into public.recipe_ingredients (recipe_id, name, quantity, unit, sort_order)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'chicken', 2, 'lb', 0);

insert into public.recipe_steps (recipe_id, instruction, sort_order)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Cook it', 0);

select is(
	(select count(*) from public.recipes),
	1::bigint,
	'Alice sees her own recipe'
);
select is(
	(select count(*) from public.recipe_ingredients),
	1::bigint,
	'Alice sees her own ingredient'
);

-- ── Act as Bob ─────────────────────────────────────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
	true
);

select is(
	(select count(*) from public.recipes),
	0::bigint,
	'Bob cannot SELECT Alice''s recipe (RLS isolation)'
);
select is(
	(select count(*) from public.recipe_ingredients),
	0::bigint,
	'Bob cannot SELECT Alice''s ingredients (child RLS via parent)'
);
select is(
	(select count(*) from public.recipe_steps),
	0::bigint,
	'Bob cannot SELECT Alice''s steps (child RLS via parent)'
);

-- Bob cannot UPDATE Alice's recipe (0 rows affected — RLS hides the row).
with upd as (
	update public.recipes set title = 'hacked'
	where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
	returning 1
)
select is((select count(*) from upd), 0::bigint, 'Bob cannot UPDATE Alice''s recipe');

-- Bob cannot DELETE Alice's recipe.
with del as (
	delete from public.recipes
	where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
	returning 1
)
select is((select count(*) from del), 0::bigint, 'Bob cannot DELETE Alice''s recipe');

-- Bob cannot create meta for a recipe he does not own (WITH CHECK ownership guard).
select throws_ok(
	$$insert into public.user_recipe_meta (recipe_id, is_favorite)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true)$$,
	'42501',
	NULL,
	'Bob cannot favorite a recipe he cannot see'
);

-- Bob cannot SELECT recipe_tags belonging to Alice's recipe.
select is(
	(select count(*) from public.recipe_tags where recipe_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
	0::bigint,
	'Bob cannot SELECT recipe_tags for Alice''s recipe'
);

-- Bob cannot directly INSERT an ingredient referencing Alice's recipe (WITH CHECK).
select throws_ok(
	$$insert into public.recipe_ingredients (recipe_id, name, quantity, unit, sort_order)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'injected', 1, 'cup', 99)$$,
	'42501',
	NULL,
	'Bob cannot INSERT ingredient into a recipe he does not own'
);

-- Bob cannot directly INSERT a step referencing Alice's recipe (WITH CHECK).
select throws_ok(
	$$insert into public.recipe_steps (recipe_id, instruction, sort_order)
	  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'hacked step', 99)$$,
	'42501',
	NULL,
	'Bob cannot INSERT step into a recipe he does not own'
);

-- ── Act as Alice again — create a meta row so we can test Bob's UPDATE/SELECT isolation ──
select set_config(
	'request.jwt.claims',
	'{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
	true
);

insert into public.user_recipe_meta (recipe_id, is_favorite)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

-- ── Back to Bob ────────────────────────────────────────────────────────────────────────
select set_config(
	'request.jwt.claims',
	'{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
	true
);

-- Bob cannot SELECT Alice's user_recipe_meta row.
select is(
	(select count(*) from public.user_recipe_meta where recipe_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
	0::bigint,
	'Bob cannot SELECT Alice''s user_recipe_meta'
);

-- Bob cannot UPDATE Alice's user_recipe_meta (0 rows affected — RLS hides it).
with upd as (
	update public.user_recipe_meta set is_favorite = false
	where recipe_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
	returning 1
)
select is((select count(*) from upd), 0::bigint, 'Bob cannot UPDATE Alice''s user_recipe_meta');

-- ── Unauthenticated (anon role) gets nothing ───────────────────────────────────────────
set local role anon;

select is(
	(select count(*) from public.recipes),
	0::bigint,
	'anon role sees no recipes (policies scoped to authenticated)'
);

select is(
	(select count(*) from public.recipe_ingredients),
	0::bigint,
	'anon role sees no ingredients'
);

select is(
	(select count(*) from public.user_recipe_meta),
	0::bigint,
	'anon role sees no user_recipe_meta'
);

select * from finish();
rollback;
