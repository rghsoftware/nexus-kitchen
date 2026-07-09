import { describe, expect, it } from 'vitest';
import type { PlannedMeal } from '$lib/planning/types';
import type { MealLog } from './types';
import {
	deriveDayCoverage,
	groupLogSources,
	keepers,
	recents,
	unratedRecent,
	type MealWithFulfillment
} from './derive';

let seq = 0;
function log(overrides: Partial<MealLog> = {}): MealLog {
	seq += 1;
	return {
		id: `log-${seq}`,
		ownerId: 'user-1',
		logType: 'CUSTOM',
		plannedMealId: null,
		recipeId: null,
		preppedMealId: null,
		nameSnapshot: 'Chili',
		mealSlot: 'DINNER',
		servings: 1,
		loggedAt: '2026-07-09T12:00:00Z',
		verdict: null,
		notes: null,
		createdAt: '2026-07-09T12:00:00Z',
		updatedAt: '2026-07-09T12:00:00Z',
		...overrides
	};
}

function meal(overrides: Partial<PlannedMeal> = {}): PlannedMeal {
	seq += 1;
	return {
		id: `pm-${seq}`,
		mealPlanId: 'plan-1',
		date: '2026-07-09',
		mealSlot: 'LUNCH',
		source: 'QUICK',
		recipeId: null,
		recipeTitleSnapshot: null,
		preppedMealId: null,
		preppedNameSnapshot: null,
		storeBoughtName: null,
		quickMealName: 'Marinara pasta',
		servings: 1,
		status: 'PLANNED',
		sortOrder: 0,
		createdAt: '2026-07-09T00:00:00Z',
		updatedAt: '2026-07-09T00:00:00Z',
		...overrides
	};
}

describe('groupLogSources', () => {
	it('groups by recipe identity when present, else by normalized name', () => {
		const sources = groupLogSources([
			log({ recipeId: 'r-1', nameSnapshot: 'Lentil curry', loggedAt: '2026-07-09T12:00:00Z' }),
			log({ recipeId: 'r-1', nameSnapshot: 'Lentil Curry v2', loggedAt: '2026-07-08T12:00:00Z' }),
			log({ nameSnapshot: 'Chili', loggedAt: '2026-07-07T12:00:00Z' }),
			log({ nameSnapshot: '  chili ', loggedAt: '2026-07-06T12:00:00Z' })
		]);
		expect(sources).toHaveLength(2);
		const curry = sources.find((s) => s.key === 'recipe:r-1')!;
		expect(curry.timesMade).toBe(2);
		expect(curry.name).toBe('Lentil curry'); // newest occurrence names the source
		const chili = sources.find((s) => s.key === 'name:chili')!;
		expect(chili.timesMade).toBe(2);
	});

	it('takes the verdict of the most recent rated occurrence', () => {
		const [chili] = groupLogSources([
			log({ nameSnapshot: 'Chili', verdict: null, loggedAt: '2026-07-09T12:00:00Z' }),
			log({ nameSnapshot: 'Chili', verdict: 'REST', loggedAt: '2026-07-08T12:00:00Z' }),
			log({ nameSnapshot: 'Chili', verdict: 'KEEP', loggedAt: '2026-07-01T12:00:00Z' })
		]);
		expect(chili.latestVerdict).toBe('REST');
	});

	it('excludes bare quick logs — "something" is not a resurfaceable source', () => {
		expect(groupLogSources([log({ logType: 'QUICK_LOG', nameSnapshot: null })])).toHaveLength(0);
	});
});

describe('recents / keepers', () => {
	const sources = groupLogSources([
		log({ nameSnapshot: 'Chili', verdict: 'KEEP', loggedAt: '2026-07-05T12:00:00Z' }),
		log({ nameSnapshot: 'Chili', loggedAt: '2026-07-03T12:00:00Z' }),
		log({ nameSnapshot: 'Takeout', verdict: 'REST', loggedAt: '2026-07-08T12:00:00Z' }),
		log({ nameSnapshot: 'Stir fry', verdict: 'KEEP', loggedAt: '2026-07-09T12:00:00Z' })
	]);

	it('recents returns newest-first, limited', () => {
		expect(recents(sources, 2).map((s) => s.name)).toEqual(['Stir fry', 'Takeout']);
	});

	it('keepers returns only KEEP sources, most-made first', () => {
		expect(keepers(sources).map((s) => s.name)).toEqual(['Chili', 'Stir fry']);
	});
});

describe('unratedRecent', () => {
	const now = new Date('2026-07-09T18:00:00Z');

	it('keeps unrated, recent, non-quick logs, newest first and limited', () => {
		const picked = unratedRecent(
			[
				log({ nameSnapshot: 'A', loggedAt: '2026-07-09T12:00:00Z' }),
				log({ nameSnapshot: 'B', loggedAt: '2026-07-08T12:00:00Z' }),
				log({ nameSnapshot: 'Rated', verdict: 'FINE', loggedAt: '2026-07-09T11:00:00Z' }),
				log({ logType: 'QUICK_LOG', nameSnapshot: null, loggedAt: '2026-07-09T10:00:00Z' }),
				log({ nameSnapshot: 'Too old', loggedAt: '2026-07-06T12:00:00Z' })
			],
			now,
			2
		);
		expect(picked.map((l) => l.nameSnapshot)).toEqual(['A', 'B']);
	});
});

describe('deriveDayCoverage', () => {
	it('invites planning when nothing is planned, without judgment', () => {
		const coverage = deriveDayCoverage([]);
		expect(coverage.slots).toEqual([]);
		expect(coverage.headline).toBe("Nothing planned — that's okay.");
	});

	it('rolls slot states up with logged meals as EATEN and worst-state-wins', () => {
		const entries: MealWithFulfillment[] = [
			{ meal: meal({ mealSlot: 'BREAKFAST', status: 'LOGGED' }), fulfillment: null },
			{ meal: meal({ mealSlot: 'LUNCH' }), fulfillment: 'HAVE_IT' },
			{ meal: meal({ mealSlot: 'DINNER' }), fulfillment: 'MUST_ACQUIRE' }
		];
		const coverage = deriveDayCoverage(entries);
		expect(coverage.slots.map((s) => [s.label, s.state])).toEqual([
			['Breakfast', 'EATEN'],
			['Lunch', 'HAVE_IT'],
			['Dinner', 'MUST_ACQUIRE']
		]);
		expect(coverage.headline).toBe('One small gap today.');
		expect(coverage.detail).toContain('Marinara pasta');
	});

	it('celebrates a fully covered day calmly', () => {
		const coverage = deriveDayCoverage([
			{ meal: meal({ mealSlot: 'LUNCH' }), fulfillment: 'HAVE_IT' }
		]);
		expect(coverage.headline).toBe("You're covered today.");
	});

	it('mentions cooking when coverage needs it', () => {
		const coverage = deriveDayCoverage([
			{ meal: meal({ mealSlot: 'DINNER' }), fulfillment: 'CAN_MAKE_IT' }
		]);
		expect(coverage.slots[0].state).toBe('CAN_MAKE_IT');
		expect(coverage.detail).toContain('cooking');
	});

	it('counts multiple gaps plainly', () => {
		const coverage = deriveDayCoverage([
			{ meal: meal({ mealSlot: 'LUNCH' }), fulfillment: 'MUST_ACQUIRE' },
			{ meal: meal({ mealSlot: 'DINNER' }), fulfillment: 'MUST_ACQUIRE' }
		]);
		expect(coverage.headline).toBe('A few things to pick up.');
		expect(coverage.detail).toContain('2 meals');
	});

	it('reports an all-logged day as done', () => {
		const coverage = deriveDayCoverage([
			{ meal: meal({ mealSlot: 'LUNCH', status: 'LOGGED' }), fulfillment: null }
		]);
		expect(coverage.headline).toBe('All logged for today.');
	});

	it('orders slots by band with Anytime last', () => {
		const coverage = deriveDayCoverage([
			{ meal: meal({ mealSlot: null }), fulfillment: 'HAVE_IT' },
			{ meal: meal({ mealSlot: 'DINNER' }), fulfillment: 'HAVE_IT' },
			{ meal: meal({ mealSlot: 'BREAKFAST' }), fulfillment: 'HAVE_IT' }
		]);
		expect(coverage.slots.map((s) => s.label)).toEqual(['Breakfast', 'Dinner', 'Anytime']);
	});
});
