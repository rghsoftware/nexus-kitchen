// Runes-based store for the reminder setup screen (feature 007). Holds the
// per-slot drafts the screen edits (persisted rows overlaid onto the design's
// defaults) and saves them as one batch. Preference data is tiny and
// non-destructive, so writes are a plain save with a saving flag — no
// optimistic bookkeeping needed.

import { fetchReminders, saveReminders } from './remindersService';
import { mergeWithDefaults, DEFAULT_DRAFTS, type ReminderDraft } from './types';

// ---------------------------------------------------------------------------
// Module-level reactive state (Svelte 5 runes)
// ---------------------------------------------------------------------------

let _drafts = $state<ReminderDraft[]>(DEFAULT_DRAFTS.map((d) => ({ ...d })));
let _loading = $state(false);
let _saving = $state(false);
let _saved = $state(false);
let _error = $state<string | null>(null);

// ---------------------------------------------------------------------------
// Public accessors (getter functions so consumers can read reactive state)
// ---------------------------------------------------------------------------

export function reminderDrafts(): ReminderDraft[] {
	return _drafts;
}
export function remindersLoading(): boolean {
	return _loading;
}
export function remindersSaving(): boolean {
	return _saving;
}
/** True after a successful save, until the next edit. */
export function remindersSaved(): boolean {
	return _saved;
}
export function remindersError(): string | null {
	return _error;
}
export function clearRemindersError(): void {
	_error = null;
}

// ---------------------------------------------------------------------------
// Loads & writes
// ---------------------------------------------------------------------------

export async function loadReminders(): Promise<void> {
	_loading = true;
	_error = null;
	try {
		_drafts = mergeWithDefaults(await fetchReminders());
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't load your nudges.";
	} finally {
		_loading = false;
	}
}

/** Patch one slot's draft in place (marks the screen dirty). */
export function updateDraft(slot: ReminderDraft['mealSlot'], patch: Partial<ReminderDraft>): void {
	_drafts = _drafts.map((d) => (d.mealSlot === slot ? { ...d, ...patch } : d));
	_saved = false;
}

/** Persist all drafts. Returns true on success. */
export async function saveAll(): Promise<boolean> {
	_saving = true;
	_error = null;
	try {
		_drafts = mergeWithDefaults(await saveReminders(_drafts));
		_saved = true;
		return true;
	} catch (err) {
		_error = err instanceof Error ? err.message : "We couldn't save your nudges.";
		return false;
	} finally {
		_saving = false;
	}
}
