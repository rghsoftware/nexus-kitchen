-- Dev seed (local only — loaded by `supabase db reset`, never pushed to prod).
--
-- The app signs in ANONYMOUSLY (src/lib/session/session.svelte.ts), so every browser
-- gets a fresh random auth.uid(). Static seed rows would belong to nobody and the UI
-- (RLS owner-scoped) would never show them. Instead this file defines a function that
-- seeds a realistic demo dataset FOR A GIVEN USER, to be called after a session exists:
--
--   bun run seed                       # seeds the most recent anonymous user (scripts/seed-dev.ts)
--   select seed_demo_data('<uuid>');   # psql, as postgres/service_role
--   supabase.rpc('seed_demo_data')     # browser console, seeds the signed-in user
--
-- Re-running is safe: it wipes that user's data and reseeds. Dates are relative to
-- current_date so the UI always looks "live" (this week's plan, items expiring soon,
-- meals before today already logged).

create or replace function public.seed_demo_data(p_owner uuid default auth.uid())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	wk_start date := date_trunc('week', current_date)::date; -- ISO Monday
	prev_wk date := date_trunc('week', current_date)::date - 7;

	r_stirfry uuid;
	r_oats uuid;
	r_soup uuid;
	r_salmon uuid;
	r_quesadilla uuid;

	pm_soup uuid;
	pm_leftovers uuid;
	pm_lasagna uuid;
	pm_burritos uuid;

	plan_this uuid;
	plan_last uuid;
	meal_storebought uuid;

	list_week uuid;
	list_restock uuid;
	list_done uuid;
begin
	if p_owner is null then
		raise exception 'seed_demo_data: no target user — sign in first or pass p_owner';
	end if;
	if auth.uid() is not null and auth.uid() <> p_owner then
		raise exception 'seed_demo_data: you may only seed your own account';
	end if;
	if not exists (select 1 from auth.users where id = p_owner) then
		raise exception 'seed_demo_data: user % does not exist', p_owner;
	end if;

	-- Make auth.uid() = p_owner for this transaction so column defaults and the
	-- shopping-item ownership trigger (check_source_planned_meal_ownership) agree
	-- with the rows we insert, including when called via service_role (uid null).
	perform set_config(
		'request.jwt.claims',
		json_build_object('sub', p_owner::text, 'role', 'authenticated')::text,
		true
	);

	-- ------------------------------------------------------------------
	-- Wipe this user's data (children cascade). Shopping first: its items
	-- reference planned_meals (ON DELETE SET NULL would orphan the demo link).
	-- ------------------------------------------------------------------
	delete from public.shopping_lists where owner_id = p_owner;
	delete from public.meal_plans where owner_id = p_owner;
	delete from public.prepped_meals where owner_id = p_owner; -- cascades portion_events
	delete from public.pantry_items where owner_id = p_owner;
	delete from public.recipes where owner_id = p_owner; -- cascades ingredients/steps/tags/meta

	-- ------------------------------------------------------------------
	-- Recipes
	-- ------------------------------------------------------------------
	insert into public.recipes
		(owner_id, title, description, servings, prep_time_minutes, cook_time_minutes,
		 active_time_minutes, cuisine_type, meal_types, notes)
	values
		(p_owner, 'Weeknight Chicken Stir-Fry',
		 'Fast wok dinner — everything goes in one pan, rice does itself.',
		 2, 15, 10, 20, 'Chinese', '{dinner}',
		 'Double the sauce if serving over noodles.')
	returning id into r_stirfry;

	insert into public.recipes
		(owner_id, title, description, servings, prep_time_minutes, cook_time_minutes,
		 active_time_minutes, cuisine_type, meal_types)
	values
		(p_owner, 'Overnight Oats',
		 'Assemble the night before; breakfast is already done when you wake up.',
		 1, 5, 0, 5, null, '{breakfast}')
	returning id into r_oats;

	insert into public.recipes
		(owner_id, title, description, servings, prep_time_minutes, cook_time_minutes,
		 active_time_minutes, cuisine_type, meal_types, notes)
	values
		(p_owner, 'Hearty Lentil Soup',
		 'Big-batch freezer staple. One pot, mostly hands-off simmering.',
		 6, 15, 45, 20, null, '{lunch,dinner}',
		 'Freezes great in 2-portion containers.')
	returning id into r_soup;

	insert into public.recipes
		(owner_id, title, description, servings, prep_time_minutes, cook_time_minutes,
		 active_time_minutes, cuisine_type, meal_types)
	values
		(p_owner, 'Sheet-Pan Salmon & Veg',
		 'Everything on one tray, 425°F, walk away.',
		 4, 10, 18, 10, null, '{dinner}')
	returning id into r_salmon;

	insert into public.recipes
		(owner_id, title, description, servings, prep_time_minutes, cook_time_minutes,
		 active_time_minutes, cuisine_type, meal_types)
	values
		(p_owner, 'Black Bean Quesadillas',
		 'Low-energy rescue meal: canned beans, tortillas, cheese, done.',
		 2, 5, 10, 15, 'Mexican', '{lunch,dinner}')
	returning id into r_quesadilla;

	insert into public.recipe_ingredients (recipe_id, name, quantity, unit, preparation, is_optional, sort_order)
	values
		(r_stirfry, 'Chicken breast', 1, 'lb', 'sliced thin', false, 0),
		(r_stirfry, 'Broccoli', 1, 'head', 'cut into florets', false, 1),
		(r_stirfry, 'Soy sauce', 3, 'tbsp', null, false, 2),
		(r_stirfry, 'Garlic', 3, 'clove', 'minced', false, 3),
		(r_stirfry, 'Fresh ginger', 1, 'tbsp', 'grated', true, 4),
		(r_stirfry, 'Jasmine rice', 1, 'cup', 'uncooked', false, 5),
		(r_oats, 'Rolled oats', 0.5, 'cup', null, false, 0),
		(r_oats, 'Milk', 0.5, 'cup', null, false, 1),
		(r_oats, 'Maple syrup', 1, 'tbsp', null, true, 2),
		(r_soup, 'Brown lentils', 2, 'cup', 'rinsed', false, 0),
		(r_soup, 'Carrot', 3, 'whole', 'diced', false, 1),
		(r_soup, 'Onion', 1, 'whole', 'diced', false, 2),
		(r_soup, 'Vegetable broth', 8, 'cup', null, false, 3),
		(r_soup, 'Cumin', 2, 'tsp', null, false, 4),
		(r_salmon, 'Salmon fillet', 4, 'piece', null, false, 0),
		(r_salmon, 'Asparagus', 1, 'bunch', 'trimmed', false, 1),
		(r_salmon, 'Lemon', 1, 'whole', 'sliced', false, 2),
		(r_salmon, 'Olive oil', 2, 'tbsp', null, false, 3),
		(r_quesadilla, 'Black beans', 1, 'can', 'drained', false, 0),
		(r_quesadilla, 'Flour tortillas', 4, 'piece', null, false, 1),
		(r_quesadilla, 'Shredded cheese', 1.5, 'cup', null, false, 2),
		(r_quesadilla, 'Salsa', 0.5, 'cup', null, true, 3);

	insert into public.recipe_steps (recipe_id, instruction, duration_minutes, timer_minutes, timer_label, sort_order)
	values
		(r_stirfry, 'Start the rice. Slice chicken and chop vegetables while it cooks.', 15, 15, 'Rice', 0),
		(r_stirfry, 'Sear chicken in a hot wok until golden, about 4 minutes.', 4, null, null, 1),
		(r_stirfry, 'Add broccoli, garlic, and ginger; stir-fry 3 minutes.', 3, null, null, 2),
		(r_stirfry, 'Add soy sauce, toss to coat, serve over rice.', 2, null, null, 3),
		(r_oats, 'Combine everything in a jar, stir, refrigerate overnight.', 5, null, null, 0),
		(r_soup, 'Sauté onion and carrot until soft, about 6 minutes.', 6, null, null, 0),
		(r_soup, 'Add lentils, cumin, and broth. Bring to a boil.', 5, null, null, 1),
		(r_soup, 'Simmer until lentils are tender.', 40, 40, 'Simmer', 2),
		(r_salmon, 'Heat oven to 425°F. Arrange salmon and asparagus on a sheet pan.', 10, null, null, 0),
		(r_salmon, 'Drizzle with oil, top with lemon, roast until flaky.', 18, 18, 'Roast', 1),
		(r_quesadilla, 'Mash beans lightly, spread on tortillas with cheese, fold.', 5, null, null, 0),
		(r_quesadilla, 'Toast in a dry skillet until crisp on both sides.', 10, null, null, 1);

	insert into public.recipe_tags (recipe_id, name, category)
	values
		(r_stirfry, 'quick', 'CUSTOM'),
		(r_stirfry, 'chinese', 'CUISINE'),
		(r_stirfry, 'stir-fry', 'COOKING_METHOD'),
		(r_oats, 'breakfast', 'MEAL_TYPE'),
		(r_oats, 'no-cook', 'COOKING_METHOD'),
		(r_oats, 'vegetarian', 'DIETARY'),
		(r_soup, 'vegan', 'DIETARY'),
		(r_soup, 'batch-cook', 'CUSTOM'),
		(r_soup, 'freezer-friendly', 'CUSTOM'),
		(r_salmon, 'sheet-pan', 'COOKING_METHOD'),
		(r_salmon, 'pescatarian', 'DIETARY'),
		(r_quesadilla, 'low-energy', 'CUSTOM'),
		(r_quesadilla, 'vegetarian', 'DIETARY'),
		(r_quesadilla, 'mexican', 'CUISINE');

	insert into public.user_recipe_meta (user_id, recipe_id, is_favorite, rating, times_cooked, last_cooked_at)
	values
		(p_owner, r_stirfry, true, 5, 7, current_date - 3 + time '19:00'),
		(p_owner, r_oats, true, 4, 12, current_date - 1 + time '07:30'),
		(p_owner, r_soup, false, 5, 3, current_date - 9 + time '18:30'),
		(p_owner, r_quesadilla, false, 3, 5, current_date - 6 + time '12:30');

	-- ------------------------------------------------------------------
	-- Pantry: healthy stock, low stock, expiring soon, expired, zero
	-- ------------------------------------------------------------------
	insert into public.pantry_items
		(owner_id, name, quantity, unit, minimum_quantity, storage_location,
		 purchase_date, expiration_date, opened_date)
	values
		(p_owner, 'Jasmine rice', 2.5, 'kg', 0.5, 'PANTRY', current_date - 30, current_date + 300, null),
		(p_owner, 'Rolled oats', 1.2, 'kg', 0.3, 'PANTRY', current_date - 20, current_date + 200, current_date - 20),
		(p_owner, 'Brown lentils', 0.8, 'kg', 0.25, 'PANTRY', current_date - 45, current_date + 250, null),
		(p_owner, 'Soy sauce', 0.05, 'L', 0.2, 'PANTRY', current_date - 90, current_date + 180, current_date - 90),
		(p_owner, 'Olive oil', 0.4, 'L', 0.25, 'PANTRY', current_date - 60, current_date + 120, current_date - 60),
		(p_owner, 'Black beans (canned)', 3, 'can', 2, 'PANTRY', current_date - 15, current_date + 400, null),
		(p_owner, 'Flour tortillas', 6, 'piece', null, 'PANTRY', current_date - 4, current_date + 3, current_date - 4),
		(p_owner, 'Milk', 0.5, 'L', 1, 'FRIDGE', current_date - 5, current_date + 2, current_date - 5),
		(p_owner, 'Eggs', 8, 'piece', 6, 'FRIDGE', current_date - 7, current_date + 14, null),
		(p_owner, 'Butter', 0.2, 'kg', 0.1, 'FRIDGE', current_date - 10, current_date + 40, current_date - 10),
		(p_owner, 'Greek yogurt', 1, 'tub', null, 'FRIDGE', current_date - 12, current_date - 1, current_date - 10),
		(p_owner, 'Shredded cheese', 0, 'bag', 1, 'FRIDGE', current_date - 20, current_date + 10, null),
		(p_owner, 'Frozen broccoli', 2, 'bag', 1, 'FREEZER', current_date - 25, current_date + 150, null),
		(p_owner, 'Frozen peas', 1, 'bag', null, 'FREEZER', current_date - 40, current_date + 120, null);

	-- ------------------------------------------------------------------
	-- Prepped meals + portion ledger.
	-- Insert with remaining = original; CONSUMED events below decrement via
	-- the sync_portions_remaining trigger so meal rows and ledger agree.
	-- ------------------------------------------------------------------
	insert into public.prepped_meals
		(owner_id, origin, name, recipe_id, recipe_name, portions_remaining, original_portions,
		 storage_location, container_label, prepared_date, expiration_date, defrost_state, defrost_started_at, estimated_ready_at)
	values
		(p_owner, 'PREP_SESSION', 'Lentil Soup (batch)', r_soup, 'Hearty Lentil Soup', 6, 6,
		 'FREEZER', 'Round blue containers', current_date - 9, current_date + 60, 'FROZEN', null, null)
	returning id into pm_soup;

	insert into public.prepped_meals
		(owner_id, origin, name, recipe_id, recipe_name, portions_remaining, original_portions,
		 storage_location, container_label, prepared_date, expiration_date, defrost_state)
	values
		(p_owner, 'DIRECT_ENTRY', 'Stir-fry leftovers', r_stirfry, 'Weeknight Chicken Stir-Fry', 2, 2,
		 'FRIDGE', 'Glass container, top shelf', current_date - 2, current_date + 2, 'NOT_APPLICABLE')
	returning id into pm_leftovers;

	insert into public.prepped_meals
		(owner_id, origin, name, portions_remaining, original_portions,
		 storage_location, prepared_date, expiration_date, defrost_state, defrost_started_at, estimated_ready_at)
	values
		(p_owner, 'STORE_BOUGHT', 'Family-size lasagna', 4, 4,
		 'FREEZER', current_date - 14, current_date + 90, 'DEFROSTING', now() - interval '6 hours', now() + interval '18 hours')
	returning id into pm_lasagna;

	insert into public.prepped_meals
		(owner_id, origin, name, portions_remaining, original_portions,
		 storage_location, container_label, prepared_date, expiration_date, defrost_state)
	values
		(p_owner, 'PREP_SESSION', 'Breakfast burritos', 8, 8,
		 'FREEZER', 'Foil-wrapped, labeled', current_date - 12, current_date + 45, 'FROZEN')
	returning id into pm_burritos;

	insert into public.portion_events (prepped_meal_id, delta_portions, kind, created_at)
	values
		(pm_soup, -1, 'CONSUMED', current_date - 5 + time '18:45'),
		(pm_soup, -1, 'CONSUMED', current_date - 3 + time '12:15'),
		(pm_leftovers, -1, 'CONSUMED', current_date - 1 + time '12:30'),
		(pm_burritos, -1, 'CONSUMED', current_date - 6 + time '07:40'),
		(pm_burritos, -1, 'CONSUMED', current_date - 4 + time '07:35'),
		(pm_burritos, -1, 'CONSUMED', current_date - 2 + time '07:50');

	-- ------------------------------------------------------------------
	-- Meal plans: last week (history) + this week (live).
	-- Meals dated before today are LOGGED so the week reads as "in progress".
	-- ------------------------------------------------------------------
	insert into public.meal_plans (owner_id, start_date, end_date)
	values (p_owner, prev_wk, prev_wk + 6)
	returning id into plan_last;

	insert into public.meal_plans (owner_id, start_date, end_date)
	values (p_owner, wk_start, wk_start + 6)
	returning id into plan_this;

	insert into public.planned_meals
		(meal_plan_id, date, meal_slot, source, recipe_id, recipe_title_snapshot,
		 prepped_meal_id, prepped_name_snapshot, store_bought_name, quick_meal_name, servings, status, logged_at)
	values
		(plan_last, prev_wk + 1, 'DINNER', 'RECIPE', r_soup, 'Hearty Lentil Soup',
		 null, null, null, null, 6, 'LOGGED', prev_wk + 1 + time '18:30'),
		(plan_last, prev_wk + 3, 'DINNER', 'QUICK', null, null,
		 null, null, null, 'Eggs on toast', 2, 'LOGGED', prev_wk + 3 + time '19:10'),
		(plan_last, prev_wk + 5, 'DINNER', 'RECIPE', r_quesadilla, 'Black Bean Quesadillas',
		 null, null, null, null, 2, 'SKIPPED', null);

	insert into public.planned_meals
		(meal_plan_id, date, meal_slot, source, recipe_id, recipe_title_snapshot,
		 prepped_meal_id, prepped_name_snapshot, store_bought_name, quick_meal_name, servings, status, logged_at)
	select
		plan_this, m.d, m.slot, m.source, m.recipe_id, m.recipe_title,
		m.prepped_id, m.prepped_name, m.store_name, m.quick_name, m.servings,
		case when m.d < current_date then 'LOGGED'::planned_meal_status else 'PLANNED' end,
		case when m.d < current_date then m.d + time '19:00' end
	from (
		values
			(wk_start + 0, 'BREAKFAST'::meal_slot, 'RECIPE'::planned_meal_source,
			 r_oats, 'Overnight Oats', null::uuid, null::text, null::text, null::text, 1::numeric),
			(wk_start + 0, 'DINNER', 'RECIPE', r_stirfry, 'Weeknight Chicken Stir-Fry', null, null, null, null, 2),
			(wk_start + 1, 'DINNER', 'PREPPED', null, null, pm_soup, 'Lentil Soup (batch)', null, null, 2),
			(wk_start + 2, 'BREAKFAST', 'RECIPE', r_oats, 'Overnight Oats', null, null, null, null, 1),
			(wk_start + 2, 'DINNER', 'STORE_BOUGHT', null, null, null, null, 'Rotisserie chicken + salad', null, 2),
			(wk_start + 3, 'DINNER', 'RECIPE', r_salmon, 'Sheet-Pan Salmon & Veg', null, null, null, null, 4),
			(wk_start + 4, 'DINNER', 'QUICK', null, null, null, null, null, 'Cereal night (no shame)', 1),
			(wk_start + 5, 'LUNCH', 'RECIPE', r_quesadilla, 'Black Bean Quesadillas', null, null, null, null, 2),
			(wk_start + 6, 'DINNER', 'PREPPED', null, null, pm_lasagna, 'Family-size lasagna', null, null, 2)
	) as m(d, slot, source, recipe_id, recipe_title, prepped_id, prepped_name, store_name, quick_name, servings);

	select id into meal_storebought
	from public.planned_meals
	where meal_plan_id = plan_this and source = 'STORE_BOUGHT'
	limit 1;

	-- ------------------------------------------------------------------
	-- Shopping: an ACTIVE generated list, a mid-trip MANUAL list, and a
	-- COMPLETED list from last week.
	-- ------------------------------------------------------------------
	insert into public.shopping_lists (owner_id, name, source_type, generated_range_start, generated_range_end, status)
	values (p_owner, 'Week of ' || to_char(wk_start, 'Mon DD'), 'FROM_PLAN', wk_start, wk_start + 6, 'ACTIVE')
	returning id into list_week;

	insert into public.shopping_list_items
		(shopping_list_id, name, quantity, unit, category, needed_for, source_planned_meal_id, sort_order)
	values
		(list_week, 'Broccoli', 1, 'head', 'PRODUCE',
		 jsonb_build_array(jsonb_build_object('recipeId', r_stirfry, 'title', 'Weeknight Chicken Stir-Fry')), null, 0),
		(list_week, 'Asparagus', 1, 'bunch', 'PRODUCE',
		 jsonb_build_array(jsonb_build_object('recipeId', r_salmon, 'title', 'Sheet-Pan Salmon & Veg')), null, 1),
		(list_week, 'Lemon', 2, 'x', 'PRODUCE',
		 jsonb_build_array(jsonb_build_object('recipeId', r_salmon, 'title', 'Sheet-Pan Salmon & Veg')), null, 2),
		(list_week, 'Milk', 1, 'L', 'DAIRY',
		 jsonb_build_array(jsonb_build_object('recipeId', r_oats, 'title', 'Overnight Oats')), null, 3),
		(list_week, 'Shredded cheese', 1, 'bag', 'DAIRY',
		 jsonb_build_array(jsonb_build_object('recipeId', r_quesadilla, 'title', 'Black Bean Quesadillas')), null, 4),
		(list_week, 'Chicken breast', 1, 'lb', 'MEAT_SEAFOOD',
		 jsonb_build_array(jsonb_build_object('recipeId', r_stirfry, 'title', 'Weeknight Chicken Stir-Fry')), null, 5),
		(list_week, 'Salmon fillet', 4, 'piece', 'MEAT_SEAFOOD',
		 jsonb_build_array(jsonb_build_object('recipeId', r_salmon, 'title', 'Sheet-Pan Salmon & Veg')), null, 6),
		(list_week, 'Soy sauce', 1, 'bottle', 'PANTRY_STAPLES',
		 jsonb_build_array(jsonb_build_object('recipeId', r_stirfry, 'title', 'Weeknight Chicken Stir-Fry')), null, 7),
		(list_week, 'Rotisserie chicken', 1, 'x', 'OTHER',
		 jsonb_build_array(jsonb_build_object('recipeId', null, 'title', 'Rotisserie chicken + salad')), meal_storebought, 8);

	insert into public.shopping_lists (owner_id, name, source_type, status)
	values (p_owner, 'Pantry restock', 'MANUAL', 'SHOPPING')
	returning id into list_restock;

	insert into public.shopping_list_items
		(shopping_list_id, name, quantity, unit, category, status, checked_at, checked_by_user_id, sort_order)
	values
		(list_restock, 'Bananas', 1, 'bunch', 'PRODUCE', 'PENDING', null, null, 0),
		(list_restock, 'Olive oil', 1, 'bottle', 'PANTRY_STAPLES', 'CHECKED', now() - interval '8 minutes', p_owner, 1),
		(list_restock, 'Coffee beans', 1, 'bag', 'PANTRY_STAPLES', 'PENDING', null, null, 2),
		(list_restock, 'Paper towels', 1, 'pack', 'OTHER', 'CHECKED', now() - interval '12 minutes', p_owner, 3),
		(list_restock, 'Sparkling water', 2, 'pack', 'OTHER', 'UNAVAILABLE', null, null, 4);

	insert into public.shopping_lists
		(owner_id, name, source_type, generated_range_start, generated_range_end, status, completed_at)
	values
		(p_owner, 'Week of ' || to_char(prev_wk, 'Mon DD'), 'FROM_PLAN', prev_wk, prev_wk + 6,
		 'COMPLETED', prev_wk + time '15:20')
	returning id into list_done;

	insert into public.shopping_list_items
		(shopping_list_id, name, quantity, unit, category, needed_for, status, checked_at, checked_by_user_id, sort_order)
	values
		(list_done, 'Carrots', 1, 'kg', 'PRODUCE',
		 jsonb_build_array(jsonb_build_object('recipeId', r_soup, 'title', 'Hearty Lentil Soup')),
		 'CHECKED', prev_wk + time '15:05', p_owner, 0),
		(list_done, 'Onions', 3, 'x', 'PRODUCE',
		 jsonb_build_array(jsonb_build_object('recipeId', r_soup, 'title', 'Hearty Lentil Soup')),
		 'CHECKED', prev_wk + time '15:06', p_owner, 1),
		(list_done, 'Vegetable broth', 2, 'L', 'CANNED',
		 jsonb_build_array(jsonb_build_object('recipeId', r_soup, 'title', 'Hearty Lentil Soup')),
		 'CHECKED', prev_wk + time '15:10', p_owner, 2),
		(list_done, 'Tahini', 1, 'jar', 'PANTRY_STAPLES', '[]', 'UNAVAILABLE', null, null, 3);

	return jsonb_build_object(
		'owner', p_owner,
		'recipes', 5,
		'pantry_items', 14,
		'prepped_meals', 4,
		'portion_events', 6,
		'meal_plans', 2,
		'planned_meals', 12,
		'shopping_lists', 3,
		'shopping_list_items', 18
	);
end;
$$;

-- Dev-only function, but keep the surface tight anyway: callers must be a real
-- session (it can only ever seed its own uid) or the service role.
revoke execute on function public.seed_demo_data(uuid) from public, anon;
grant execute on function public.seed_demo_data(uuid) to authenticated, service_role;
