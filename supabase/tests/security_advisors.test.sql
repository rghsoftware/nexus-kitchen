-- Standing guard for the Supabase database advisors (security lints 0011, 0014,
-- 0028, 0029 and performance lint 0003). Run with: `supabase test db`.
-- Requires 0011_security_advisor_fixes and 0012_rls_initplan.
--
-- These are written as *catalog-wide* assertions rather than a fixed list of
-- object names, so a future migration that adds an unpinned function or leaks a
-- SECURITY DEFINER function onto the Data API fails here instead of surfacing
-- weeks later in the dashboard. That regression has already happened once:
-- 0001 pinned public.set_updated_at and 0002's CREATE OR REPLACE dropped the
-- setting, because REPLACE silently discards any attribute the new definition
-- omits.
--
-- Each assertion reports the offending object names in its diff, not just a
-- count, so a failure says what to fix.

begin;
select plan(5);

-- ── lint 0011_function_search_path_mutable ─────────────────────────────────
-- A function with no SET search_path resolves unqualified names against the
-- caller's path, so anything earlier on that path can shadow the tables and
-- operators the body depends on.
select is(
	(
		select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
		from pg_proc p
		join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public'
		  and p.prokind = 'f'
		  and not exists (
			select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
			where cfg like 'search_path=%'
		  )
	),
	'',
	'lint 0011: every public function pins search_path'
);

-- ── lints 0028/0029_*_security_definer_function_executable ─────────────────
-- A SECURITY DEFINER function reachable by anon or authenticated is published
-- at /rest/v1/rpc/<name> and runs as its owner. has_function_privilege also
-- resolves the implicit PUBLIC grant, so this covers both grant paths.
select is(
	(
		select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
		from pg_proc p
		join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public'
		  and p.prosecdef
		  and has_function_privilege('anon', p.oid, 'EXECUTE')
	),
	'',
	'lint 0028: no SECURITY DEFINER function in public is executable by anon'
);

-- `seed_demo_data` is the one intentional exception. It is SECURITY DEFINER and
-- granted to authenticated on purpose (supabase/seed.sql) so the browser console
-- can call supabase.rpc('seed_demo_data') for the signed-in user, and it guards
-- itself: it raises unless auth.uid() is null or equals p_owner, so a caller can
-- only ever seed their own account. It also never reaches production — seed.sql
-- is loaded by `supabase db reset` / `supabase start` (db.seed.enabled in
-- config.toml) and is not a migration, so the real advisor never sees it.
--
-- Excluded from *this* assertion only, deliberately: seed.sql revokes it from
-- anon, so lint 0028 above still fails if that ever changes.
select is(
	(
		select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
		from pg_proc p
		join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public'
		  and p.prosecdef
		  and p.proname <> 'seed_demo_data'
		  and has_function_privilege('authenticated', p.oid, 'EXECUTE')
	),
	'',
	'lint 0029: no SECURITY DEFINER function in public is executable by authenticated'
);

-- ── lint 0014_extension_in_public ──────────────────────────────────────────
-- An extension registered in public puts its members on the project API.
select is(
	(
		select coalesce(string_agg(e.extname, ', ' order by e.extname), '')
		from pg_extension e
		join pg_namespace n on n.oid = e.extnamespace
		where n.nspname = 'public'
	),
	'',
	'lint 0014: no extension is installed in the public schema'
);

-- ── lint 0003_auth_rls_initplan (PERFORMANCE) ──────────────────────────────
-- A bare auth.<fn>() / current_setting() in a policy expression is re-invoked
-- per candidate row; `(select auth.uid())` becomes an InitPlan evaluated once
-- per statement. pg_policies renders the wrapped form as `( SELECT auth.uid()
-- AS uid)`, so counting `select <fn>(` occurrences against total `<fn>(`
-- occurrences catches any call that is not wrapped, without hard-coding a
-- policy list.
select is(
	(
		select coalesce(string_agg(tablename || '.' || policyname, ', ' order by tablename, policyname), '')
		from (
			select tablename, policyname,
			       coalesce(qual, '') || ' ' || coalesce(with_check, '') as expr
			from pg_policies
			where schemaname = 'public'
		) p
		where regexp_count(expr, '(auth\.(uid|jwt|role|email)|current_setting)\s*\(', 1, 'i')
		    > regexp_count(expr, 'select\s+(auth\.(uid|jwt|role|email)|current_setting)\s*\(', 1, 'i')
	),
	'',
	'lint 0003: every policy wraps auth.<fn>()/current_setting() in a select'
);

select * from finish();
rollback;
