-- Standing guard for the Supabase database security advisor (lints 0011, 0014,
-- 0028, 0029). Run with: `supabase test db`. Requires 0011_security_advisor_fixes.
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
select plan(4);

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

select is(
	(
		select coalesce(string_agg(p.proname, ', ' order by p.proname), '')
		from pg_proc p
		join pg_namespace n on n.oid = p.pronamespace
		where n.nspname = 'public'
		  and p.prosecdef
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

select * from finish();
rollback;
