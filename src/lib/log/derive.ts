// Pure derivations over meal logs (feature 006, research R7/R8): recents, keepers,
// the unrated recap, and the day-coverage rollup. All client-side and I/O-free —
// suggestion features later may push these server-side if aggregation outgrows this.

import type { MealSlot, PlannedMeal } from '$lib/planning/types';
import { MEAL_SLOTS, mealSlotLabel, plannedMealName } from '$lib/planning/types';
import type { FulfillmentState } from '$lib/planning/fulfillment';
import type { MealLog, MealVerdict } from './types';
import { mealLogName } from './types';

/** One distinct "thing you've eaten", grouped across its log occurrences. */
export interface LoggedSource {
	/** recipe:<id> when recipe-backed, else name:<lowercased snapshot>. */
	key: string;
	name: string;
	recipeId: string | null;
	/** Verdict of the most recent occurrence that has one; null = never rated. */
	latestVerdict: MealVerdict | null;
	timesMade: number;
	lastLoggedAt: string;
	lastSlot: MealSlot | null;
}

function sourceKey(log: MealLog): string | null {
	if (log.logType === 'QUICK_LOG') return null; // "something" is not a resurfaceable source
	if (log.recipeId) return `recipe:${log.recipeId}`;
	const name = log.nameSnapshot?.trim().toLowerCase();
	return name ? `name:${name}` : null;
}

/**
 * Group logs (newest first) into distinct sources. Grouping is by recipe identity
 * when present, otherwise by normalized name — so two batches of "Chili" count as
 * one source with timesMade 2 (R7).
 */
export function groupLogSources(logs: readonly MealLog[]): LoggedSource[] {
	const ordered = [...logs].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
	const byKey = new Map<string, LoggedSource>();
	for (const log of ordered) {
		const key = sourceKey(log);
		if (key === null) continue;
		const existing = byKey.get(key);
		if (existing) {
			existing.timesMade += 1;
			if (existing.latestVerdict === null && log.verdict !== null) {
				existing.latestVerdict = log.verdict;
			}
		} else {
			byKey.set(key, {
				key,
				name: mealLogName(log),
				recipeId: log.recipeId,
				latestVerdict: log.verdict,
				timesMade: 1,
				lastLoggedAt: log.loggedAt,
				lastSlot: log.mealSlot
			});
		}
	}
	return [...byKey.values()];
}

/** Latest `limit` distinct sources, newest first (Quick Log "Recent" group). */
export function recents(sources: readonly LoggedSource[], limit: number): LoggedSource[] {
	return [...sources].sort((a, b) => b.lastLoggedAt.localeCompare(a.lastLoggedAt)).slice(0, limit);
}

/** Sources whose most recent verdict is KEEP, most-made first ("Keepers" group). */
export function keepers(sources: readonly LoggedSource[]): LoggedSource[] {
	return sources
		.filter((s) => s.latestVerdict === 'KEEP')
		.sort((a, b) => b.timesMade - a.timesMade || b.lastLoggedAt.localeCompare(a.lastLoggedAt));
}

/**
 * Recap candidates (FR-TL-017): unrated, within the last 48 h, excluding bare
 * QUICK_LOG entries (nothing meaningful to rate), newest first.
 */
export function unratedRecent(logs: readonly MealLog[], now: Date, limit: number): MealLog[] {
	const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
	return logs
		.filter(
			(log) =>
				log.verdict === null &&
				log.logType !== 'QUICK_LOG' &&
				log.loggedAt >= cutoff &&
				log.loggedAt <= now.toISOString()
		)
		.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
		.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Day coverage (FR-TL-005, research R8) — rolls feature 004's per-meal
// fulfillment up to slot chips + one calm sentence. Never persisted.
// ---------------------------------------------------------------------------

export interface MealWithFulfillment {
	meal: PlannedMeal;
	/** null = not tracked (QUICK) or inputs still loading — treated as covered-enough. */
	fulfillment: FulfillmentState | null;
}

export type CoverageState = 'EATEN' | 'HAVE_IT' | 'CAN_MAKE_IT' | 'MUST_ACQUIRE';

export interface SlotCoverage {
	slot: MealSlot | null;
	label: string;
	state: CoverageState;
}

export interface DayCoverage {
	slots: SlotCoverage[];
	headline: string;
	detail: string;
}

const SLOT_ORDER: readonly (MealSlot | null)[] = [...MEAL_SLOTS, null];

function slotState(entries: MealWithFulfillment[]): CoverageState {
	if (entries.every(({ meal }) => meal.status === 'LOGGED')) return 'EATEN';
	const open = entries.filter(({ meal }) => meal.status === 'PLANNED');
	if (open.some(({ fulfillment }) => fulfillment === 'MUST_ACQUIRE')) return 'MUST_ACQUIRE';
	if (open.some(({ fulfillment }) => fulfillment === 'CAN_MAKE_IT')) return 'CAN_MAKE_IT';
	return 'HAVE_IT';
}

/** Calm, factual coverage summary — gaps are stated without judgment (spec voice rules). */
export function deriveDayCoverage(meals: readonly MealWithFulfillment[]): DayCoverage {
	if (meals.length === 0) {
		return {
			slots: [],
			headline: "Nothing planned — that's okay.",
			detail: 'Want to pick something easy for later? The planner is one tap away.'
		};
	}

	const bySlot = new Map<MealSlot | null, MealWithFulfillment[]>();
	for (const entry of meals) {
		const list = bySlot.get(entry.meal.mealSlot) ?? [];
		list.push(entry);
		bySlot.set(entry.meal.mealSlot, list);
	}

	const slots: SlotCoverage[] = SLOT_ORDER.filter((slot) => bySlot.has(slot)).map((slot) => ({
		slot,
		label: mealSlotLabel(slot),
		state: slotState(bySlot.get(slot)!)
	}));

	const gaps = meals.filter(
		({ meal, fulfillment }) => meal.status === 'PLANNED' && fulfillment === 'MUST_ACQUIRE'
	);
	const cooking = meals.some(
		({ meal, fulfillment }) => meal.status === 'PLANNED' && fulfillment === 'CAN_MAKE_IT'
	);

	if (gaps.length === 0) {
		if (slots.every((s) => s.state === 'EATEN')) {
			return { slots, headline: 'All logged for today.', detail: 'Nothing left to think about.' };
		}
		return {
			slots,
			headline: "You're covered today.",
			detail: cooking
				? 'Everything you planned is on hand — some of it just wants cooking.'
				: "Everything's either eaten or ready to go."
		};
	}
	if (gaps.length === 1) {
		return {
			slots,
			headline: 'One small gap today.',
			detail: `${plannedMealName(gaps[0].meal)} needs a quick pickup — one thing, and the day's set.`
		};
	}
	return {
		slots,
		headline: 'A few things to pick up.',
		detail: `${gaps.length} meals want ingredients — the shopping list can gather them.`
	};
}

/**
 * Covered = at least one meal planned and nothing left to acquire. The Today
 * screen renders covered days as a status line in the greeting instead of the
 * coverage card, so the card only appears when there's something to look at
 * (a gap, or an empty day inviting a plan).
 */
export function isDayCovered(coverage: DayCoverage): boolean {
	return coverage.slots.length > 0 && coverage.slots.every((s) => s.state !== 'MUST_ACQUIRE');
}
