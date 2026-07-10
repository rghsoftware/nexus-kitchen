import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DRAFTS,
	draftColumns,
	mergeWithDefaults,
	toMealReminder,
	toTimeInputValue,
	type MealReminderRow
} from './types';

function row(overrides: Partial<MealReminderRow> = {}): MealReminderRow {
	return {
		id: 'r-1',
		owner_id: 'u-1',
		household_id: null,
		name: 'Lunch',
		meal_slot: 'LUNCH',
		reminder_time: '12:30:00',
		pre_alert_minutes: null,
		is_enabled: true,
		days_of_week: [1, 2, 3, 4, 5, 6, 7],
		notification_type: 'PUSH',
		timezone: 'America/New_York',
		created_at: '2026-07-01T00:00:00Z',
		updated_at: '2026-07-01T00:00:00Z',
		...overrides
	};
}

describe('DEFAULT_DRAFTS', () => {
	it('covers all four slots with the mockup defaults (dinner pre-alert, snacks off)', () => {
		expect(DEFAULT_DRAFTS.map((d) => d.mealSlot)).toEqual([
			'BREAKFAST',
			'LUNCH',
			'DINNER',
			'SNACK'
		]);
		const dinner = DEFAULT_DRAFTS.find((d) => d.mealSlot === 'DINNER');
		expect(dinner).toMatchObject({ reminderTime: '18:30', preAlertMinutes: 30, isEnabled: true });
		const snack = DEFAULT_DRAFTS.find((d) => d.mealSlot === 'SNACK');
		expect(snack?.isEnabled).toBe(false);
	});
});

describe('toTimeInputValue', () => {
	it('trims DB time to the HH:MM input shape', () => {
		expect(toTimeInputValue('08:00:00')).toBe('08:00');
		expect(toTimeInputValue('18:30')).toBe('18:30');
	});
});

describe('mergeWithDefaults', () => {
	it('returns fresh defaults when nothing is persisted', () => {
		const drafts = mergeWithDefaults([]);
		expect(drafts).toEqual(DEFAULT_DRAFTS);
		expect(drafts[0]).not.toBe(DEFAULT_DRAFTS[0]); // copies, safe to mutate
	});

	it('overlays persisted rows onto their slot, keeping slot order', () => {
		const persisted = toMealReminder(
			row({ reminder_time: '13:15:00', is_enabled: false, pre_alert_minutes: 15 })
		);
		const drafts = mergeWithDefaults([persisted]);
		expect(drafts.map((d) => d.mealSlot)).toEqual(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']);
		expect(drafts[1]).toMatchObject({
			mealSlot: 'LUNCH',
			reminderTime: '13:15',
			preAlertMinutes: 15,
			isEnabled: false
		});
		// untouched slots keep their defaults
		expect(drafts[2]).toMatchObject({ mealSlot: 'DINNER', reminderTime: '18:30' });
	});
});

describe('draftColumns', () => {
	it('maps a draft to upsert columns with the captured timezone', () => {
		const [breakfast] = DEFAULT_DRAFTS;
		expect(draftColumns(breakfast, 'Europe/Berlin')).toEqual({
			name: 'Breakfast',
			meal_slot: 'BREAKFAST',
			reminder_time: '08:00',
			pre_alert_minutes: null,
			is_enabled: true,
			timezone: 'Europe/Berlin'
		});
	});
});

describe('toMealReminder', () => {
	it('maps snake_case row fields to the camelCase app shape', () => {
		expect(toMealReminder(row({ pre_alert_minutes: 30 }))).toEqual({
			id: 'r-1',
			ownerId: 'u-1',
			name: 'Lunch',
			mealSlot: 'LUNCH',
			reminderTime: '12:30:00',
			preAlertMinutes: 30,
			isEnabled: true,
			daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
			notificationType: 'PUSH',
			timezone: 'America/New_York',
			createdAt: '2026-07-01T00:00:00Z',
			updatedAt: '2026-07-01T00:00:00Z'
		});
	});
});
