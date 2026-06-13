/**
 * Dev seeding driver — populates demo data for viewing the UI "in use".
 *
 * The app signs in anonymously, so each browser gets a random auth.uid(). This script
 * targets the LOCAL Supabase stack with the service-role key and calls the
 * `seed_demo_data(p_owner)` function defined in supabase/seed.sql for a real user.
 *
 * Usage:
 *   bun run seed                 # seed the most recently created user (your browser session)
 *   bun run seed -- --all        # seed every existing user
 *   bun run seed -- --user <id>  # seed a specific user id
 *
 * Flow: `supabase start` → `bun run dev` → open the app once (creates the anonymous
 * user) → `bun run seed` → refresh.
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

// The anonymous user is created by the app itself on first load (ensureSession →
// signInAnonymously), so if none exists yet, wait for the dev to open the app.
if (users.length === 0) {
	console.log('No users exist yet — the app creates one on first load.');
	console.log('Open the app in your browser (bun run dev, usually http://localhost:5173).');
	console.log('Waiting for a session (Ctrl-C to abort)...');
	const deadline = Date.now() + 5 * 60_000;
	while (users.length === 0 && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 2000));
		users = await listUsers();
	}
	if (users.length === 0) {
		console.error('Timed out after 5 minutes with no session. Re-run once the app has loaded.');
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
