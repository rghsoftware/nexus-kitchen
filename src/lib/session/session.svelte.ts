// Session state (feature 008 — real auth).
//
// Sessions are permanent accounts backed by Supabase Auth. This module observes the
// session; it never creates one. Sign-in / sign-up live in $lib/auth/authService.
//
// Previously this bootstrapped `signInAnonymously()` so RLS had a real `auth.uid()`
// before an auth feature existed. That path is gone and anonymous sign-ins are disabled
// in supabase/config.toml — any rows still owned by an old anonymous uid are
// unreachable by design (no credential exists that can produce that uid again).
//
// Token storage, refresh and rotation are handled entirely by supabase-js
// (REQ-SC-003/004); we only mirror the current user into runes for the UI.

import { supabase } from '$lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

interface SessionState {
	user: User | null;
	/**
	 * False until the client has settled on an answer — whichever of the two writers gets
	 * there first: the INITIAL_SESSION event below, or an explicit getSession(). Both wait
	 * on the same supabase-js initialize promise, so neither can report a stale null. The
	 * guard must not redirect before this flips.
	 */
	ready: boolean;
	/** True while a recovery link is being acted on, so /account can prompt for a new password. */
	recovering: boolean;
}

const state = $state<SessionState>({ user: null, ready: false, recovering: false });

let restorePromise: Promise<User | null> | null = null;

function applySession(session: Session | null) {
	state.user = session?.user ?? null;
}

/**
 * Restore any persisted session. Idempotent and safe to call from multiple components —
 * concurrent calls share one in-flight promise.
 *
 * This resolves a stored session only. A first-time visitor legitimately resolves to
 * null; the route guard sends them to /signin.
 */
export async function restoreSession(): Promise<User | null> {
	if (state.ready) return state.user;
	if (restorePromise) return restorePromise;

	restorePromise = (async () => {
		try {
			const { data, error } = await supabase.auth.getSession();
			if (error) {
				// A corrupt or expired stored session is not an error worth showing: the
				// user simply isn't signed in, and the guard routes them accordingly.
				console.error('[restoreSession] getSession failed; treating as signed out', error);
				applySession(null);
				return null;
			}
			applySession(data.session);
			return state.user;
		} catch (err) {
			// getSession() rejecting (rather than returning an error) must not escape: it
			// would surface as an unhandled rejection at the layout's `void restoreSession()`
			// and, via currentUser(), make services throw a raw Error instead of their own
			// domain error — defeating the `instanceof PlanningError` checks downstream.
			console.error('[restoreSession] getSession threw; treating as signed out', err);
			applySession(null);
			return null;
		} finally {
			state.ready = true;
			restorePromise = null;
		}
	})();

	return restorePromise;
}

/**
 * The signed-in user, waiting for session restore to settle first. Returns null when
 * signed out — data services translate that into their own domain error.
 *
 * This replaces the old `ensureSession()`: it observes rather than creates, because
 * there is no longer any session the app can mint on the user's behalf.
 */
export async function currentUser(): Promise<User | null> {
	if (!state.ready) await restoreSession();
	return state.user;
}

/**
 * Reactive snapshot of the current session (read in components / effects).
 *
 * Readonly on purpose: every write goes through this module, so a component can't put the
 * app into a state the session never actually reached.
 */
export const sessionState: Readonly<SessionState> = state;

/** Clears the recovery flag once /account has finished handling the reset. */
export function clearRecovering(): void {
	state.recovering = false;
}

// App-lifetime listener: keeps local state in sync with sign-in, sign-out, token refresh
// and — importantly — the session supabase-js parses out of the URL fragment after an
// email confirmation or recovery redirect (detectSessionInUrl defaults to true, which is
// why no callback route of our own is needed).
supabase.auth.onAuthStateChange((event, session) => {
	applySession(session);
	// Any auth event means the client has settled on an answer, including the
	// INITIAL_SESSION fired during construction.
	state.ready = true;
	if (event === 'PASSWORD_RECOVERY') state.recovering = true;
	if (event === 'SIGNED_OUT') state.recovering = false;
});
