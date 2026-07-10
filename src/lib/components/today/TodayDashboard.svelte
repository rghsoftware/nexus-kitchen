<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		fulfillmentFor,
		loadFulfillmentInputs,
		loadRange,
		mealsOn,
		type PlannedMeal
	} from '$lib/planning';
	import { loadPreppedMeals, preppedMeals, readyToEat } from '$lib/pantry/preppedMealStore.svelte';
	import { loadPantryItems, runningLow } from '$lib/pantry/pantryStore.svelte';
	import {
		clearLogNotice,
		deriveDayCoverage,
		deriveNudge,
		isDayCovered,
		keepers,
		loadRecents,
		loadToday,
		localDateISO,
		logError,
		logMeal,
		logNotice,
		nudgeDismissKey,
		rateLog,
		recentLogs,
		recentSources,
		recents,
		todayLogs,
		unratedRecent,
		type LoggedSource,
		type MealVerdict
	} from '$lib/log';
	import type { MealSlot } from '$lib/planning';
	import type { PreppedMeal } from '$lib/pantry/types';
	import TodayMealCard from './TodayMealCard.svelte';
	import DayCoverageCard from './DayCoverageCard.svelte';
	import NudgeBanner from './NudgeBanner.svelte';
	import QuickLogSheet from './QuickLogSheet.svelte';
	import RecapCard from './RecapCard.svelte';
	import AttentionList from './AttentionList.svelte';

	// The clock is state so greeting/nudges roll forward while the tab stays open.
	let now = $state(new Date());
	$effect(() => {
		const timer = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(timer);
	});

	const todayISO = $derived(localDateISO(now));

	// Loads: plan-for-today + fulfillment inputs + inventory + logs. Keyed on the
	// civil date only (not the ticking clock), so it runs on mount and at midnight
	// rollover — never on minute ticks.
	$effect(() => {
		void todayISO;
		void loadRange(todayISO, todayISO).then(loadFulfillmentInputs);
		void loadPreppedMeals();
		void loadPantryItems();
		void loadToday(new Date());
		void loadRecents();
	});

	const todaysMeals = $derived(mealsOn(todayISO));
	const logByPlannedMealId = $derived(
		new Map(todayLogs().flatMap((log) => (log.plannedMealId ? [[log.plannedMealId, log]] : [])))
	);

	const coverage = $derived(
		deriveDayCoverage(
			todaysMeals.map((meal) => ({ meal, fulfillment: fulfillmentFor(meal)?.state ?? null }))
		)
	);
	// Covered days confirm in the greeting itself; the card (a shape that asks
	// for attention) is reserved for gaps and empty days.
	const covered = $derived(isDayCovered(coverage));

	// Nudge dismissals are device-local, per day+slot (research R6). localStorage
	// isn't reactive, so a version counter invalidates the derivation on dismiss.
	let dismissalVersion = $state(0);
	const dismissedSlots = $derived.by(() => {
		void dismissalVersion;
		const slots: MealSlot[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
		return slots.filter((slot) => localStorage.getItem(nudgeDismissKey(todayISO, slot)) !== null);
	});
	const nudge = $derived(deriveNudge(now, todaysMeals, todayLogs(), dismissedSlots));

	function dismissNudge(slot: MealSlot) {
		localStorage.setItem(nudgeDismissKey(todayISO, slot), '1');
		dismissalVersion += 1;
	}

	// Recap: recent unrated logs, minus today's planned meals (their cards already ask).
	const recapLogs = $derived(
		unratedRecent(recentLogs(), now, 3).filter(
			(log) => !log.plannedMealId || !logByPlannedMealId.has(log.plannedMealId)
		)
	);

	const attentionPrepped = $derived(
		preppedMeals().filter((m) => m.isExpiringSoon && m.portions_remaining > 0)
	);
	const attentionLow = $derived(runningLow().slice(0, 3));

	const sources = $derived(recentSources());
	const sheetRecents = $derived(recents(sources, 4));
	const sheetKeepers = $derived(keepers(sources).slice(0, 4));
	const sheetPrepped = $derived(readyToEat().filter((m) => m.portions_remaining > 0));

	const greeting = $derived(
		now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
	);
	const dateLine = $derived(
		now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
	);

	const EMPTY_SLOT_COPY: Record<MealSlot, string> = {
		BREAKFAST: 'Add breakfast',
		LUNCH: 'Add lunch',
		DINNER: 'Add dinner',
		SNACK: 'Add a snack'
	};
	const emptySlots = $derived(
		(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as MealSlot[]).filter(
			(slot) => !todaysMeals.some((meal) => meal.mealSlot === slot)
		)
	);

	let sheetOpen = $state(false);
	let busy = $state(false);

	async function runLog<T>(action: () => Promise<T>): Promise<T> {
		busy = true;
		try {
			return await action();
		} finally {
			busy = false;
		}
	}

	function logPlanned(meal: PlannedMeal) {
		void runLog(() => logMeal({ kind: 'fromPlan', plannedMeal: meal }));
	}

	function handleRate(logId: string, verdict: MealVerdict | null) {
		void rateLog(logId, verdict);
	}

	// The sheet closing is the success confirmation — a failed insert (logMeal
	// resolves null) keeps it open so the error banner isn't hidden behind it.
	function closeSheetIfSaved(saved: unknown) {
		if (saved) sheetOpen = false;
	}

	function logSomething(slot: MealSlot, verdict: MealVerdict | null) {
		void runLog(() => logMeal({ kind: 'quick', slot, verdict })).then(closeSheetIfSaved);
	}

	function logPrepped(
		meal: Pick<PreppedMeal, 'id' | 'name'>,
		slot: MealSlot,
		verdict: MealVerdict | null
	) {
		void runLog(() =>
			logMeal({ kind: 'fromPrepped', preppedMeal: { id: meal.id, name: meal.name }, slot, verdict })
		).then(closeSheetIfSaved);
	}

	function logSource(source: LoggedSource, slot: MealSlot, verdict: MealVerdict | null) {
		void runLog(() =>
			logMeal(
				source.recipeId
					? { kind: 'fromRecipe', recipeId: source.recipeId, name: source.name, slot, verdict }
					: { kind: 'custom', name: source.name, slot, verdict }
			)
		).then(closeSheetIfSaved);
	}
</script>

<svelte:head>
	<title>Today · Nexus Kitchen</title>
</svelte:head>

<div class="today" inert={sheetOpen ? true : undefined}>
	<div class="wrap">
		<header class="greet">
			<div class="greet__txt">
				<h1>{greeting}.</h1>
				<p>{dateLine} · here's your day, no pressure.</p>
				{#if covered}
					<p class="greet__status" role="status">
						<i class="ph-fill ph-check-circle" aria-hidden="true"></i>
						{coverage.headline}
					</p>
				{/if}
			</div>
			<button
				type="button"
				class="nk-btn nk-btn--primary greet__log"
				onclick={() => (sheetOpen = true)}
			>
				<i class="ph ph-plus" aria-hidden="true"></i> Log a meal
			</button>
		</header>

		{#if logError()}
			<div class="banner banner--error" role="alert">{logError()}</div>
		{/if}
		{#if logNotice()}
			<div class="banner banner--notice" role="status">
				{logNotice()}
				<button type="button" class="banner__close" aria-label="Dismiss" onclick={clearLogNotice}>
					<i class="ph ph-x" aria-hidden="true"></i>
				</button>
			</div>
		{/if}

		{#if !covered}
			<DayCoverageCard {coverage} />
		{/if}

		{#if nudge}
			<NudgeBanner
				{nudge}
				{busy}
				onLog={() => {
					const meal = todaysMeals.find((m) => m.id === nudge.plannedMealId);
					if (meal) logPlanned(meal);
				}}
				onDismiss={() => dismissNudge(nudge.slot)}
			/>
		{/if}

		<h2 class="sec-label">Today's meals</h2>
		<div class="meals">
			{#each todaysMeals as meal (meal.id)}
				<TodayMealCard
					{meal}
					log={logByPlannedMealId.get(meal.id) ?? null}
					preppedPortionsLeft={meal.preppedMealId
						? (preppedMeals().find((p) => p.id === meal.preppedMealId)?.portions_remaining ?? null)
						: null}
					{busy}
					onLog={() => logPlanned(meal)}
					onRate={handleRate}
				/>
			{/each}
			{#each emptySlots as slot (slot)}
				<a class="meal-empty" href={resolve('/plan')}>
					<i class="ph ph-plus-circle" aria-hidden="true"></i>
					{EMPTY_SLOT_COPY[slot]}
					<span>optional</span>
				</a>
			{/each}
		</div>

		<div class="cols">
			<section aria-label="Quick actions">
				<h2 class="sec-label sec-label--flush">Quick actions</h2>
				<div class="qa">
					<a class="qa__btn" href={resolve('/plan')}>
						<i class="ph ph-calendar-dots" aria-hidden="true"></i> Plan the week
					</a>
					<a class="qa__btn" href={resolve('/shopping')}>
						<i class="ph ph-shopping-cart-simple" aria-hidden="true"></i> Build shopping list
					</a>
					<a class="qa__btn" href={resolve('/pantry')}>
						<i class="ph ph-shelves" aria-hidden="true"></i> Browse the pantry
					</a>
					<a class="qa__btn" href={resolve('/recipes')}>
						<i class="ph ph-book-open" aria-hidden="true"></i> Browse recipes
					</a>
				</div>
			</section>
			<div>
				{#if recapLogs.length > 0}
					<h2 class="sec-label sec-label--flush">How were these?</h2>
					<RecapCard logs={recapLogs} onRate={handleRate} />
				{/if}
				{#if attentionPrepped.length > 0 || attentionLow.length > 0}
					<h2 class="sec-label" class:sec-label--flush={recapLogs.length === 0}>
						Keep things moving
					</h2>
					<AttentionList expiringPrepped={attentionPrepped} lowStock={attentionLow} />
				{/if}
			</div>
		</div>
	</div>

	<button type="button" class="fab" onclick={() => (sheetOpen = true)}>
		<i class="ph ph-plus" aria-hidden="true"></i> Log a meal
	</button>
</div>

{#if sheetOpen}
	<QuickLogSheet
		preppedReady={sheetPrepped}
		recents={sheetRecents}
		keepers={sheetKeepers}
		{busy}
		onClose={() => (sheetOpen = false)}
		onLogSomething={logSomething}
		onLogPrepped={logPrepped}
		onLogSource={logSource}
	/>
{/if}

<style>
	.today {
		height: 100%;
		overflow-y: auto;
		position: relative;
	}
	.wrap {
		max-width: 1080px;
		margin: 0 auto;
		padding: var(--space-8) var(--space-6) var(--space-9);
	}

	.greet {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
	}
	.greet__txt {
		flex: 1 1 340px;
		min-width: 0;
	}
	.greet h1 {
		font-family: var(--font-display);
		font-size: clamp(1.7rem, 3vw, 2.375rem);
		margin: 0;
	}
	.greet p {
		color: var(--text-muted);
		margin-top: 4px;
		font-size: var(--text-base);
	}
	/* Covered-day confirmation lives in the greeting as plain page state — no
	   card chrome, so it can't read as a dismissable notification. */
	.greet__status {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.greet p.greet__status {
		color: var(--have-text);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		margin-top: var(--space-2);
	}
	.greet__status i {
		font-size: 1.2em;
	}

	.banner {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-top: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
	}
	.banner--error {
		background: var(--attention-soft);
		color: var(--attention);
	}
	.banner--notice {
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.banner__close {
		margin-left: auto;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		display: grid;
		place-items: center;
		min-width: var(--tap-min);
		min-height: var(--tap-min);
	}

	.sec-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-caps);
		text-transform: uppercase;
		color: var(--text-muted);
		margin: var(--space-8) 0 var(--space-4);
	}
	.sec-label--flush {
		margin-top: 0;
	}

	.meals {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-4);
	}
	.meal-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: 168px;
		border: 1px dashed var(--border-strong);
		border-radius: var(--radius-lg);
		color: var(--text-muted);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
		text-decoration: none;
		text-align: center;
	}
	.meal-empty i {
		font-size: 26px;
	}
	.meal-empty span {
		font-size: var(--text-2xs);
		font-weight: var(--weight-semibold);
	}
	.meal-empty:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.cols {
		display: grid;
		grid-template-columns: 1.4fr 1fr;
		gap: var(--space-6);
		margin-top: var(--space-8);
		align-items: start;
	}
	.qa {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}
	.qa__btn {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
		color: var(--text);
		text-decoration: none;
		transition:
			border-color var(--transition),
			background var(--transition);
	}
	.qa__btn:hover {
		border-color: var(--primary);
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.qa__btn:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.qa__btn i {
		font-size: 1.4em;
		color: var(--primary-text);
	}

	.fab {
		display: none;
		position: fixed;
		right: var(--space-5);
		bottom: 92px;
		height: 56px;
		padding: 0 var(--space-5);
		border-radius: var(--radius-pill);
		background: var(--primary);
		color: var(--text-on-accent);
		border: none;
		font-family: var(--font-sans);
		font-weight: var(--weight-bold);
		font-size: var(--text-base);
		align-items: center;
		gap: var(--space-2);
		box-shadow: var(--shadow-lg);
		cursor: pointer;
		z-index: 20;
	}
	.fab:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}

	@media (max-width: 1080px) {
		.meals {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 760px) {
		.wrap {
			padding: var(--space-5) var(--space-5) var(--space-9);
		}
		.meals {
			grid-template-columns: 1fr;
		}
		.cols {
			grid-template-columns: 1fr;
		}
		.greet__log {
			display: none;
		}
		.fab {
			display: flex;
		}
		.meal-empty {
			min-height: 96px;
		}
	}
</style>
