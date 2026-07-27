import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import type { Database } from '$lib/database.types';

const supabaseUrl = PUBLIC_SUPABASE_URL;
const supabaseKey = PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Set while a sign-out is already in flight, so a burst of parallel 401s triggers one
// tear-down rather than one per request.
let clearingDeadSession = false;

function requestUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

/**
 * Turns an expired session into a sign-in prompt instead of a dead end.
 *
 * supabase-js refreshes access tokens in the background, but a refresh that fails without
 * being terminal — offline, or the refresh token revoked from another device — leaves the
 * client holding a stale session and emits no SIGNED_OUT. The UI still looks signed in
 * while PostgREST rejects every request with 401/PGRST301, which falls through to each
 * service's generic "please try again" copy. Retrying is the one thing that cannot work.
 *
 * Clearing the session locally fires SIGNED_OUT, so the layout guard routes to
 * /signin?next=<current path> and the user signs back in where they left off. Scope is
 * local because the token is already dead — a global sign-out would need the network.
 * Auth endpoints are excluded: a 401 there is a normal failed credential check.
 */
async function fetchWithAuthExpiry(input: RequestInfo | URL, init?: RequestInit) {
	const response = await fetch(input, init);

	if (response.status === 401 && !requestUrl(input).includes('/auth/v1/') && !clearingDeadSession) {
		clearingDeadSession = true;
		console.error('[supabase] request rejected as unauthenticated; clearing the local session');
		void supabase.auth.signOut({ scope: 'local' }).finally(() => {
			clearingDeadSession = false;
		});
	}

	return response;
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
	global: { fetch: fetchWithAuthExpiry }
});
