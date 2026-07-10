// Typed data-access layer for meal reminders, built on supabase-js / PostgREST.
// Every call runs under the caller's RLS context — no owner filters; the database
// enforces isolation. Errors surface as RemindersError with calm messages.

import { supabase } from '$lib/supabaseClient';
import { ensureSession } from '$lib/session/session.svelte';
import {
	deviceTimezone,
	draftColumns,
	toMealReminder,
	type MealReminder,
	type ReminderDraft
} from './types';

/** A normalized application error carrying a friendly message plus the original for logging. */
export class RemindersError extends Error {
	readonly cause?: unknown;
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'RemindersError';
		this.cause = cause;
	}
}

/** Ensure a session exists, throwing a RemindersError if sign-in failed. */
async function requireSession() {
	const user = await ensureSession();
	if (!user) throw new RemindersError("We couldn't start a session. Try refreshing the page.");
	return user;
}

/** All of the caller's reminders (at most one per slot — DB unique). */
export async function fetchReminders(): Promise<MealReminder[]> {
	await requireSession();
	const { data, error } = await supabase.from('meal_reminders').select('*');
	if (error) throw new RemindersError("We couldn't load your nudges. Please try again.", error);
	return (data ?? []).map(toMealReminder);
}

/**
 * Save the whole setup screen in one batch: upsert on (owner, slot), stamping
 * every row with the device's current time zone so server-side delivery math
 * follows the clock the user actually lives on.
 */
export async function saveReminders(drafts: ReminderDraft[]): Promise<MealReminder[]> {
	await requireSession();
	const timezone = deviceTimezone();
	const { data, error } = await supabase
		.from('meal_reminders')
		.upsert(
			drafts.map((d) => draftColumns(d, timezone)),
			{ onConflict: 'owner_id,meal_slot' }
		)
		.select();
	if (error) throw new RemindersError("We couldn't save your nudges. Please try again.", error);
	return (data ?? []).map(toMealReminder);
}
