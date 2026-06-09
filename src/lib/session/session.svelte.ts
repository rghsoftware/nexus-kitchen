// Session bootstrap. No auth/login feature exists yet (feature 001), so we establish a real
// session via Supabase anonymous sign-in. This yields a genuine auth.uid() so RLS works
// end-to-end and recipes are usable/testable now. A future auth feature upgrades the anonymous
// user to a permanent account.

import { supabase } from '$lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

interface SessionState {
	user: User | null;
	loading: boolean;
	/** Set when anonymous sign-in fails (e.g. anonymous sign-ins disabled in the project). */
	error: string | null;
}

const state = $state<SessionState>({ user: null, loading: false, error: null });

let bootstrapPromise: Promise<User | null> | null = null;

function applySession(session: Session | null) {
	state.user = session?.user ?? null;
}

/**
 * Ensure a session exists, signing in anonymously if needed. Idempotent and safe to call from
 * multiple components — concurrent calls share one in-flight promise. Returns the current user
 * (or null if sign-in failed; inspect `sessionState.error`).
 */
export async function ensureSession(): Promise<User | null> {
	if (state.user) return state.user;
	if (bootstrapPromise) return bootstrapPromise;

	bootstrapPromise = (async () => {
		state.loading = true;
		state.error = null;
		try {
			const { data: existing, error: sessionErr } = await supabase.auth.getSession();
			if (sessionErr) {
				console.error(
					'[ensureSession] getSession failed, falling back to anonymous sign-in',
					sessionErr
				);
			}
			if (existing.session) {
				applySession(existing.session);
				return state.user;
			}

			const { data, error } = await supabase.auth.signInAnonymously();
			if (error) {
				console.error('[ensureSession] Anonymous sign-in failed', error);
				state.error =
					'We couldn’t start a session. If this keeps happening, anonymous sign-ins may need to be enabled.';
				return null;
			}
			applySession(data.session);
			return state.user;
		} finally {
			state.loading = false;
			bootstrapPromise = null;
		}
	})();

	return bootstrapPromise;
}

/** Reactive snapshot of the current session (read in components / effects). */
export const sessionState = state;

/** The current user id, or null if no session yet. */
export function currentUserId(): string | null {
	return state.user?.id ?? null;
}

// Keep local state in sync with Supabase auth changes (token refresh, sign-out, upgrade).
// App-lifetime listener. To prevent duplicate listeners under Vite HMR, call
// supabase.auth.stopAutoRefresh() or unsubscribe in import.meta.hot?.dispose.
supabase.auth.onAuthStateChange((_event, session) => {
	applySession(session);
});
