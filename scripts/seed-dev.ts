/**
 * Dev seeding driver — populates demo data for viewing the UI "in use".
 *
 * Data is owner-scoped by auth.uid(), so seeding always targets a specific account. This
 * script talks to the LOCAL Supabase stack with the service-role key and calls the
 * `seed_demo_data(p_owner)` function defined in supabase/seed.sql.
 *
 * Usage:
 *   bun run seed                    # seed the most recently created account
 *   bun run seed -- --create-user   # ensure the local dev account exists, then seed it
 *   bun run seed -- --all           # seed every existing account
 *   bun run seed -- --user <id>     # seed a specific user id
 *
 * Flow: `supabase start` → `bun run seed -- --create-user` → `bun run dev` → sign in as
 * dev@nexus.kitchen / password1.
 *
 * (Before feature 008 the app signed in anonymously and an account appeared on first
 * load. It's gated now, so an account has to exist before there's anything to seed.)
 */
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

function localStackEnv(): Record<string, string> {
	// `supabase` if it's on PATH, otherwise the bunx shim.
	let result = spawnSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
	if (result.error) {
		result = spawnSync('bunx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' });
	}
	if (result.error || result.status !== 0) {
		console.error(result.stderr || result.stdout || String(result.error ?? ''));
		console.error('Could not read local stack status. Is the local stack up? Try: supabase start');
		process.exit(1);
	}
	const env: Record<string, string> = {};
	for (const line of result.stdout.split('\n')) {
		const match = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
		if (match) env[match[1]] = match[2];
	}
	return env;
}

const stack = localStackEnv();
const url = process.env.SUPABASE_URL ?? stack.API_URL ?? 'http://127.0.0.1:56321';
const serviceKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY ??
	process.env.SUPABASE_SECRET_KEY ??
	stack.SERVICE_ROLE_KEY ??
	stack.SECRET_KEY;

// --create-user provisions an account with a known password, so this must never point at
// a remote project: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in the environment would
// otherwise quietly override the local stack and create dev@nexus.kitchen in production.
const host = URL.canParse(url) ? new URL(url).hostname : '';
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
	console.error(`Refusing to seed ${url} — this script is local-only.`);
	process.exit(1);
}

if (!serviceKey) {
	console.error(
		'No service-role key found (checked SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, and `supabase status`).'
	);
	process.exit(1);
}

const admin = createClient(url, serviceKey, {
	auth: { persistSession: false, autoRefreshToken: false }
});

const args = process.argv.slice(2);
const seedAll = args.includes('--all');
const userFlag = args.indexOf('--user');
const explicitUser = userFlag !== -1 ? args[userFlag + 1] : undefined;
const createUser = args.includes('--create-user');

// Convenience account for a fresh local stack, so seeding doesn't require signing up
// in the browser first. Local-only: this runs against the local service-role key.
const DEV_EMAIL = 'dev@nexus.kitchen';
const DEV_PASSWORD = 'password1';

async function listUsers() {
	const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
	if (error) {
		console.error('Failed to list users:', error.message);
		process.exit(1);
	}
	return data.users.sort(
		(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
	);
}

let users = await listUsers();

// Since feature 008 the app is gated, so accounts come from a real sign-up rather than
// appearing on first load. Either make one here (--create-user) or wait for the dev to
// sign up in the browser.
//
// Create-or-reuse by email, deliberately not gated on "no accounts exist": if the dev had
// already signed up in the browser, the flag used to become a silent no-op that seeded
// some other account, and the sign-in this script prints would then fail.
if (createUser) {
	const existing = users.find((u) => u.email === DEV_EMAIL);
	if (existing) {
		console.log(`${DEV_EMAIL} already exists — seeding it.`);
		users = [existing, ...users.filter((u) => u.id !== existing.id)];
	} else {
		const { data, error } = await admin.auth.admin.createUser({
			email: DEV_EMAIL,
			password: DEV_PASSWORD,
			email_confirm: true // skip the confirmation round-trip on a local stack
		});
		if (error) {
			console.error(`Failed to create the dev account: ${error.message}`);
			process.exit(1);
		}
		console.log(`Created ${DEV_EMAIL} (password: ${DEV_PASSWORD}) — sign in with these.`);
		users = data.user ? [data.user, ...users] : await listUsers();
	}
}

if (users.length === 0) {
	console.log('No accounts exist yet — the app no longer creates one on first load.');
	console.log('Either re-run with `bun run seed -- --create-user`, or sign up in the browser');
	console.log('(bun run dev, usually http://localhost:5173, then "Create an account").');
	console.log('Waiting for an account (Ctrl-C to abort)...');
	const deadline = Date.now() + 5 * 60_000;
	while (users.length === 0 && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 2000));
		users = await listUsers();
	}
	if (users.length === 0) {
		console.error('Timed out after 5 minutes with no account. Re-run once one exists.');
		process.exit(1);
	}
}

let targets = users;
if (explicitUser) {
	targets = users.filter((u) => u.id === explicitUser);
	if (targets.length === 0) {
		console.error(`User ${explicitUser} not found.`);
		process.exit(1);
	}
} else if (!seedAll) {
	targets = [users[0]];
}

for (const user of targets) {
	const label = `${user.id} (created ${user.created_at}${user.is_anonymous ? ', anonymous' : ''})`;
	const { data: summary, error: rpcError } = await admin.rpc('seed_demo_data', {
		p_owner: user.id
	});
	if (rpcError) {
		console.error(`✗ ${label}: ${rpcError.message}`);
		console.error(
			'If the function is missing, load it with: supabase db reset (or psql -f supabase/seed.sql)'
		);
		process.exit(1);
	}
	console.log(`✓ Seeded ${label}`);
	console.log(`  ${JSON.stringify(summary)}`);
}

console.log('\nDone. Refresh the app to see the demo data.');
