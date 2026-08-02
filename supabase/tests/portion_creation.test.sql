-- Non-mocked regression for prepped-portion CREATION (feature 006, Design A).
--
-- The app's addPreppedMeal() used to INSERT the prepped_meals row and THEN emit a positive
-- INITIALIZED portion_event. That event is rejected by INV-INV-011's CHECK
-- (portion_events_positive_delta_only_adjusted: positive delta only for ADJUSTED), so the
-- creation path threw against any real backend. The unit test mocked the ledger and never
-- caught it. This suite locks the real DB behavior:
--   1. A direct INSERT into prepped_meals is the authoritative starting count (works).
--   2. A positive INITIALIZED portion_event is rejected by the constraint.
--   3. A CONSUMED delta still flows through the trigger (the ledger records *changes* only).
-- Requires migrations 0003–0004 applied.

begin;
select plan(4);

insert into auth.users (id, email)
values ('33333333-3333-3333-3333-333333333333', 'carol@test.local')
on conflict (id) do nothing;

set local role authenticated;
select set_config(
	'request.jwt.claims',
	'{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}',
	true
);

-- 1. Creating a prepped portion via direct INSERT succeeds with portions_remaining > 0.
insert into public.prepped_meals (
	id, owner_id, origin, name,
	portions_remaining, original_portions,
	storage_location, prepared_date, expiration_date, defrost_state
) values (
	'dddddddd-dddd-dddd-dddd-dddddddddddd',
	'33333333-3333-3333-3333-333333333333',
	'DIRECT_ENTRY', 'Carol Lentil Soup',
	5, 5,
	'FRIDGE', current_date, current_date + 4, 'NOT_APPLICABLE'
);

select is(
	(select portions_remaining from public.prepped_meals
	 where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
	5,
	'direct INSERT sets the authoritative starting portion count (no INITIALIZED event needed)'
);

-- 2. A positive INITIALIZED portion_event is rejected (INV-INV-011) — this is exactly the
--    write the old addPreppedMeal attempted. It MUST fail, by the CHECK constraint (23514).
select throws_ok(
	$$insert into public.portion_events (prepped_meal_id, delta_portions, kind)
	  values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 5, 'INITIALIZED')$$,
	'23514',
	NULL,
	'a positive INITIALIZED portion_event is rejected by the constraint (INV-INV-011)'
);

-- 3. A CONSUMED delta flows through the trigger and decrements remaining.
insert into public.portion_events (prepped_meal_id, delta_portions, kind)
values ('dddddddd-dddd-dddd-dddd-dddddddddddd', -2, 'CONSUMED');

select is(
	(select portions_remaining from public.prepped_meals
	 where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
	3,
	'CONSUMED event decrements portions_remaining via the trigger'
);

select is(
	(select original_portions from public.prepped_meals
	 where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
	5,
	'original_portions is unchanged by a CONSUMED event'
);

select * from finish();
rollback;
