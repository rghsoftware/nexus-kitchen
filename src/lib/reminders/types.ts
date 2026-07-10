// Domain types for meal reminders (feature 007). CamelCase application shapes
// mapped from the snake_case rows in `$lib/database.types`; the service layer
// returns these.
//
// Canonical shape: Domain Specification `MealReminder` — one reminder per meal
// slot (the DB enforces UNIQUE (owner, slot)), a local wall-clock time plus the
// owner's IANA time zone, an optional pre-alert (REQ-MR-002), and ISO days of
// week (1 = Monday .. 7 = Sunday, INV-PL-011). Delivery happens server-side
// (pg_cron → Edge Function → Pushover); the client only manages preferences.

import type { Enums, Tables, TablesInsert } from '$lib/database.types';
import type { MealSlot } from '$lib/planning/types';

export type NotificationType = Enums<'reminder_notification_type'>;

export type MealReminderRow = Tables<'meal_reminders'>;
export type MealReminderInsert = TablesInsert<'meal_reminders'>;

export interface MealReminder {
	id: string;
	ownerId: string;
	name: string;
	mealSlot: MealSlot;
	reminderTime: string; // 'HH:MM:SS' local wall-clock time
	preAlertMinutes: number | null;
	isEnabled: boolean;
	daysOfWeek: number[]; // ISO, 1 = Monday .. 7 = Sunday
	notificationType: NotificationType;
	timezone: string; // IANA zone the wall-clock time is anchored to
	createdAt: string;
	updatedAt: string;
}

/** What the setup screen edits — one draft per slot, saved as a batch. */
export interface ReminderDraft {
	mealSlot: MealSlot;
	name: string;
	reminderTime: string; // 'HH:MM' (input[type=time] value)
	preAlertMinutes: number | null;
	isEnabled: boolean;
}

/**
 * The setup screen's starting point, per design/screens/mobile-reminder-setup.html:
 * breakfast 8:00, lunch 12:30, dinner 6:30 PM with a 30-minute pre-alert, snacks
 * 3:00 PM off by default. Every day of the week until day-picking ships.
 */
export const DEFAULT_DRAFTS: readonly ReminderDraft[] = [
	{
		mealSlot: 'BREAKFAST',
		name: 'Breakfast',
		reminderTime: '08:00',
		preAlertMinutes: null,
		isEnabled: true
	},
	{
		mealSlot: 'LUNCH',
		name: 'Lunch',
		reminderTime: '12:30',
		preAlertMinutes: null,
		isEnabled: true
	},
	{
		mealSlot: 'DINNER',
		name: 'Dinner',
		reminderTime: '18:30',
		preAlertMinutes: 30,
		isEnabled: true
	},
	{
		mealSlot: 'SNACK',
		name: 'Snacks',
		reminderTime: '15:00',
		preAlertMinutes: null,
		isEnabled: false
	}
];

/** The device's IANA time zone — what saved reminders are anchored to. */
export function deviceTimezone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** 'HH:MM[:SS]' → the input[type=time] value ('HH:MM'). */
export function toTimeInputValue(time: string): string {
	return time.slice(0, 5);
}

/** Overlay persisted reminders onto the default drafts (slot order preserved). */
export function mergeWithDefaults(persisted: MealReminder[]): ReminderDraft[] {
	return DEFAULT_DRAFTS.map((draft) => {
		const saved = persisted.find((r) => r.mealSlot === draft.mealSlot);
		if (!saved) return { ...draft };
		return {
			mealSlot: saved.mealSlot,
			name: saved.name,
			reminderTime: toTimeInputValue(saved.reminderTime),
			preAlertMinutes: saved.preAlertMinutes,
			isEnabled: saved.isEnabled
		};
	});
}

/** Map a draft to upsert columns (timezone captured at save time). */
export function draftColumns(draft: ReminderDraft, timezone: string): MealReminderInsert {
	return {
		name: draft.name,
		meal_slot: draft.mealSlot,
		reminder_time: draft.reminderTime,
		pre_alert_minutes: draft.preAlertMinutes,
		is_enabled: draft.isEnabled,
		timezone
	};
}

/** Map a DB row to the app shape. */
export function toMealReminder(row: MealReminderRow): MealReminder {
	return {
		id: row.id,
		ownerId: row.owner_id,
		name: row.name,
		mealSlot: row.meal_slot,
		reminderTime: row.reminder_time,
		preAlertMinutes: row.pre_alert_minutes,
		isEnabled: row.is_enabled,
		daysOfWeek: row.days_of_week,
		notificationType: row.notification_type,
		timezone: row.timezone,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}
