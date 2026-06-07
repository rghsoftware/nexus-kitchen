-- Migration: 0001_recipes
-- Feature: 001-recipes (Recipe Management)
-- Creates the recipe domain schema: recipes + ordered children (ingredients, steps,
-- tags) + per-user metadata, plus a private Storage bucket for a single recipe image.
--
-- Invariants enforced here (see docs/nexus-kitchen-invariants.md §1.2):
--   INV-RC-003/005/006/007/008/009/012, INV-DB-001/002/008/011.
-- INV-RC-001/002/011 (>=1 ingredient/step, substitute within same recipe) are cross-row
-- and enforced in the app layer + tests.
--
-- Constitution: P7 (RLS default-deny on every table), P8 (UUID PKs), P9 (timestamptz UTC).
-- Sessions come from Supabase anonymous sign-in, so auth.uid() is always a real UID.
-- Policies are scoped `to authenticated` and use `(select auth.uid())` for per-statement eval.
--
-- NOTE: This migration is authored but NOT applied by the build. Apply with `supabase db push`
-- (or via the dashboard), then regenerate types: `supabase gen types typescript --linked`.

-- gen_random_uuid() is provided by pgcrypto (preinstalled on Supabase). Ensure present.
create extension if not exists pgcrypto;

-- ============================================================================
-- updated_at trigger helper (pinned search_path — avoids function_search_path_mutable)
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

-- ============================================================================
-- recipes (owner-scoped parent)
-- ============================================================================
create table public.recipes (
	id uuid primary key default gen_random_uuid(),
	owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	household_id uuid, -- reserved for future household sharing (no FK in v1)
	title text not null check (char_length(title) between 1 and 500),
	description text check (description is null or char_length(description) <= 2000),
	servings integer not null check (servings between 1 and 100),
	prep_time_minutes integer check (prep_time_minutes is null or prep_time_minutes >= 0),
	cook_time_minutes integer check (cook_time_minutes is null or cook_time_minutes >= 0),
	active_time_minutes integer check (active_time_minutes is null or active_time_minutes >= 0),
	total_time_minutes integer generated always as (
		coalesce(prep_time_minutes, 0) + coalesce(cook_time_minutes, 0)
	) stored,
	cuisine_type text check (cuisine_type is null or char_length(cuisine_type) <= 100),
	meal_types text[] not null default '{}',
	notes text check (notes is null or char_length(notes) <= 5000),
	image_url text,
	source_url text,
	nutrition_per_serving jsonb,
	nutrition_source text not null default 'MANUAL'
		check (nutrition_source in ('COMPUTED', 'MANUAL', 'EXTERNAL')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	-- INV-RC-008: active time cannot exceed total time
	constraint recipes_active_le_total check (
		active_time_minutes is null
		or active_time_minutes <= coalesce(prep_time_minutes, 0) + coalesce(cook_time_minutes, 0)
	)
);

create index recipes_owner_idx on public.recipes (owner_id);
create index recipes_owner_created_idx on public.recipes (owner_id, created_at desc);

create trigger recipes_set_updated_at
	before update on public.recipes
	for each row execute function public.set_updated_at();

-- INV-DB-011 / P7: RLS default-deny, owner-scoped policies.
alter table public.recipes enable row level security;

create policy recipes_select on public.recipes
	for select to authenticated using (owner_id = (select auth.uid()));
create policy recipes_insert on public.recipes
	for insert to authenticated with check (owner_id = (select auth.uid()));
create policy recipes_update on public.recipes
	for update to authenticated
	using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy recipes_delete on public.recipes
	for delete to authenticated using (owner_id = (select auth.uid()));

-- ============================================================================
-- recipe_ingredients (ordered child)
-- ============================================================================
create table public.recipe_ingredients (
	id uuid primary key default gen_random_uuid(),
	recipe_id uuid not null references public.recipes (id) on delete cascade,
	ingredient_id uuid, -- reserved for future master-ingredient link ([Q2]); no FK in v1
	name text not null check (char_length(name) between 1 and 200),
	quantity numeric not null check (quantity > 0), -- INV-RC-005
	unit text not null check (char_length(unit) between 1 and 50),
	preparation text check (preparation is null or char_length(preparation) <= 200),
	is_optional boolean not null default false,
	substitute_for uuid references public.recipe_ingredients (id) on delete set null,
	sort_order integer not null check (sort_order >= 0),
	-- INV-RC-007: unique ingredient ordering within a recipe
	constraint recipe_ingredients_unique_order unique (recipe_id, sort_order)
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, sort_order);

-- P7: RLS keyed through the parent recipe's owner.
alter table public.recipe_ingredients enable row level security;

create policy recipe_ingredients_all on public.recipe_ingredients
	for all to authenticated
	using (
		exists (
			select 1 from public.recipes r
			where r.id = recipe_ingredients.recipe_id and r.owner_id = (select auth.uid())
		)
	)
	with check (
		exists (
			select 1 from public.recipes r
			where r.id = recipe_ingredients.recipe_id and r.owner_id = (select auth.uid())
		)
	);

-- ============================================================================
-- recipe_steps (ordered child)
-- ============================================================================
create table public.recipe_steps (
	id uuid primary key default gen_random_uuid(),
	recipe_id uuid not null references public.recipes (id) on delete cascade,
	instruction text not null check (char_length(instruction) between 1 and 2000),
	duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
	timer_minutes integer check (timer_minutes is null or timer_minutes >= 0),
	timer_label text check (timer_label is null or char_length(timer_label) <= 100),
	image_url text,
	sort_order integer not null check (sort_order >= 0),
	-- INV-RC-006: unique step ordering within a recipe
	constraint recipe_steps_unique_order unique (recipe_id, sort_order)
);

create index recipe_steps_recipe_idx on public.recipe_steps (recipe_id, sort_order);

alter table public.recipe_steps enable row level security;

create policy recipe_steps_all on public.recipe_steps
	for all to authenticated
	using (
		exists (
			select 1 from public.recipes r
			where r.id = recipe_steps.recipe_id and r.owner_id = (select auth.uid())
		)
	)
	with check (
		exists (
			select 1 from public.recipes r
			where r.id = recipe_steps.recipe_id and r.owner_id = (select auth.uid())
		)
	);

-- ============================================================================
-- recipe_tags (child)
-- ============================================================================
create table public.recipe_tags (
	id uuid primary key default gen_random_uuid(),
	recipe_id uuid not null references public.recipes (id) on delete cascade,
	name text not null check (name = lower(name) and char_length(name) between 1 and 50),
	category text not null
		check (category in ('DIETARY', 'CUISINE', 'MEAL_TYPE', 'COOKING_METHOD', 'CUSTOM')),
	constraint recipe_tags_unique unique (recipe_id, name, category)
);

create index recipe_tags_recipe_idx on public.recipe_tags (recipe_id);
create index recipe_tags_name_idx on public.recipe_tags (name);

alter table public.recipe_tags enable row level security;

create policy recipe_tags_all on public.recipe_tags
	for all to authenticated
	using (
		exists (
			select 1 from public.recipes r
			where r.id = recipe_tags.recipe_id and r.owner_id = (select auth.uid())
		)
	)
	with check (
		exists (
			select 1 from public.recipes r
			where r.id = recipe_tags.recipe_id and r.owner_id = (select auth.uid())
		)
	);

-- ============================================================================
-- user_recipe_meta (per-user state; meta only for recipes the user owns)
-- ============================================================================
create table public.user_recipe_meta (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
	recipe_id uuid not null references public.recipes (id) on delete cascade,
	is_favorite boolean not null default false,
	rating integer check (rating is null or rating between 1 and 5), -- INV-RC-009
	times_cooked integer not null default 0 check (times_cooked >= 0),
	last_cooked_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	-- INV-RC-012: one meta row per (user, recipe)
	constraint user_recipe_meta_unique unique (user_id, recipe_id)
);

create index user_recipe_meta_user_idx on public.user_recipe_meta (user_id);
create index user_recipe_meta_recipe_idx on public.user_recipe_meta (recipe_id);

create trigger user_recipe_meta_set_updated_at
	before update on public.user_recipe_meta
	for each row execute function public.set_updated_at();

alter table public.user_recipe_meta enable row level security;

-- Read/delete own meta; write meta only for recipes the user owns (visibility match).
create policy user_recipe_meta_select on public.user_recipe_meta
	for select to authenticated using (user_id = (select auth.uid()));
create policy user_recipe_meta_insert on public.user_recipe_meta
	for insert to authenticated
	with check (
		user_id = (select auth.uid())
		and exists (
			select 1 from public.recipes r
			where r.id = user_recipe_meta.recipe_id and r.owner_id = (select auth.uid())
		)
	);
create policy user_recipe_meta_update on public.user_recipe_meta
	for update to authenticated
	using (user_id = (select auth.uid()))
	with check (
		user_id = (select auth.uid())
		and exists (
			select 1 from public.recipes r
			where r.id = user_recipe_meta.recipe_id and r.owner_id = (select auth.uid())
		)
	);
create policy user_recipe_meta_delete on public.user_recipe_meta
	for delete to authenticated using (user_id = (select auth.uid()));

-- ============================================================================
-- Storage: private bucket for a single recipe image, owner-prefixed paths
-- Files live under '{auth.uid()}/...'; access scoped to the owner prefix.
-- UPDATE carries WITH CHECK so a rename/move cannot relocate a file into another
-- user's prefix (privilege-escalation guard).
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', false)
on conflict (id) do nothing;

create policy recipe_images_select on storage.objects
	for select to authenticated using (
		bucket_id = 'recipe-images'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);
create policy recipe_images_insert on storage.objects
	for insert to authenticated with check (
		bucket_id = 'recipe-images'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);
create policy recipe_images_update on storage.objects
	for update to authenticated
	using (
		bucket_id = 'recipe-images'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	)
	with check (
		bucket_id = 'recipe-images'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);
create policy recipe_images_delete on storage.objects
	for delete to authenticated using (
		bucket_id = 'recipe-images'
		and (storage.foldername(name))[1] = (select auth.uid())::text
	);
