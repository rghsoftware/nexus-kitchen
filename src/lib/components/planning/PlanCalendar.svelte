<script lang="ts">
	import AddMealSheet from './AddMealSheet.svelte';
	import DayView from './DayView.svelte';
	import MealDetailSheet from './MealDetailSheet.svelte';
	import MonthView from './MonthView.svelte';
	import MoveMealSheet from './MoveMealSheet.svelte';
	import WeekView from './WeekView.svelte';
	import {
		addDays,
		clearPlanError,
		dayFullLabel,
		loadRange,
		monthEndOf,
		monthGridRange,
		monthLabel,
		monthStartOf,
		moveMeal,
		planError,
		planLoading,
		plannedMeals,
		todayLocalISO,
		weekLabel,
		weekRangeOf,
		type ISODate,
		type MealSlot,
		type PlannedMeal
	} from '$lib/planning';

	type View = 'day' | 'week' | 'month';
	const VIEW_STORAGE_KEY = 'nk-plan-view';

	function initialView(): View {
		if (typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem(VIEW_STORAGE_KEY);
			if (saved === 'day' || saved === 'week' || saved === 'month') return saved;
		}
		return 'week'; // default view (A-001)
	}

	let view = $state<View>(initialView());
	let anchor = $state<ISODate>(todayLocalISO());

	// Sheet state
	let addTarget = $state<{ date: ISODate; slot: MealSlot | null } | null>(null);
	let detailMeal = $state<PlannedMeal | null>(null);
	let moveTarget = $state<PlannedMeal | null>(null);

	const visibleRange = $derived(view === 'month' ? monthGridRange(anchor) : weekRangeOf(anchor));

	const periodTitle = $derived(
		view === 'month'
			? monthLabel(anchor)
			: view === 'week'
				? weekLabel(anchor)
				: dayFullLabel(anchor)
	);

	// Persist the chosen view (A-001) and load the visible range (server authoritative).
	$effect(() => {
		localStorage.setItem(VIEW_STORAGE_KEY, view);
	});
	$effect(() => {
		loadRange(visibleRange.start, visibleRange.end);
	});

	function step(direction: 1 | -1) {
		if (view === 'day') {
			anchor = addDays(anchor, direction);
		} else if (view === 'week') {
			anchor = addDays(anchor, 7 * direction);
		} else {
			// Month: jump to the 1st of the adjacent month
			anchor =
				direction === 1
					? addDays(monthEndOf(anchor), 1)
					: monthStartOf(addDays(monthStartOf(anchor), -1));
		}
	}

	function goToday() {
		anchor = todayLocalISO();
	}

	function openDay(date: ISODate) {
		anchor = date;
		view = 'day';
	}

	function openAdd(date: ISODate, slot: MealSlot | null) {
		addTarget = { date, slot };
	}

	function openDetail(meal: PlannedMeal) {
		detailMeal = meal;
	}

	function openMove(meal: PlannedMeal) {
		detailMeal = null;
		moveTarget = meal;
	}

	async function handleDropMeal(mealId: string, date: ISODate, slot: MealSlot | null) {
		await moveMeal(mealId, { date, mealSlot: slot });
	}

	const views: { id: View; label: string }[] = [
		{ id: 'day', label: 'Day' },
		{ id: 'week', label: 'Week' },
		{ id: 'month', label: 'Month' }
	];
</script>

<!--
	PlanCalendar — the Plan surface per design/screens/web-calendar.html: title +
	requirement framing, period nav with icon buttons, Today, view switcher.
	Implicit weekly plans are managed by the service layer, never by the user (FR-PL-011).
-->
<div class="plan">
	<header class="topbar">
		<div class="topbar__title">
			<h1>Plan</h1>
			<p>Each meal you add becomes a requirement — we track what's covered and what's left.</p>
		</div>

		<div class="periodnav" role="group" aria-label="Calendar navigation">
			<button type="button" class="icon-btn" aria-label="Previous {view}" onclick={() => step(-1)}>
				<i class="ph ph-caret-left" aria-hidden="true"></i>
			</button>
			<span class="periodnav__range">{periodTitle}</span>
			<button type="button" class="icon-btn" aria-label="Next {view}" onclick={() => step(1)}>
				<i class="ph ph-caret-right" aria-hidden="true"></i>
			</button>
		</div>
		<button type="button" class="nk-btn nk-btn--secondary nk-btn--sm" onclick={goToday}>
			Today
		</button>

		<span class="spacer"></span>

		<div class="viewswitch" role="group" aria-label="Calendar view">
			{#each views as v (v.id)}
				<button
					type="button"
					class="nk-btn nk-btn--sm {view === v.id ? 'nk-btn--primary' : 'nk-btn--ghost'}"
					aria-pressed={view === v.id}
					onclick={() => (view = v.id)}
				>
					{v.label}
				</button>
			{/each}
		</div>
	</header>

	{#if planError()}
		<div class="plan__error" role="alert">
			<span>{planError()}</span>
			<button type="button" class="nk-btn nk-btn--ghost nk-btn--sm" onclick={clearPlanError}>
				Dismiss
			</button>
		</div>
	{/if}

	{#if planLoading() && plannedMeals().length === 0}
		<p class="plan__loading" aria-live="polite">Loading your plan…</p>
	{/if}

	<div class="plan__scroll nk-scroll">
		{#if view === 'week'}
			<WeekView
				{anchor}
				onAdd={openAdd}
				onMealClick={openDetail}
				onDropMeal={handleDropMeal}
				onOpenDay={openDay}
			/>
		{:else if view === 'day'}
			<DayView
				date={anchor}
				onSelectDay={(d) => (anchor = d)}
				onAdd={openAdd}
				onMealClick={openDetail}
				onDropMeal={handleDropMeal}
			/>
		{:else}
			<MonthView {anchor} onOpenDay={openDay} />
		{/if}
	</div>
</div>

{#if addTarget}
	<div class="sheet-overlay" role="dialog" aria-modal="true" aria-label="Add a meal">
		<div class="sheet-overlay__panel">
			<AddMealSheet
				date={addTarget.date}
				slot={addTarget.slot}
				onClose={() => (addTarget = null)}
			/>
		</div>
	</div>
{/if}

{#if detailMeal}
	<div class="sheet-overlay" role="dialog" aria-modal="true" aria-label="Meal details">
		<div class="sheet-overlay__panel">
			<MealDetailSheet meal={detailMeal} onClose={() => (detailMeal = null)} onMove={openMove} />
		</div>
	</div>
{/if}

{#if moveTarget}
	<div class="sheet-overlay" role="dialog" aria-modal="true" aria-label="Move meal">
		<div class="sheet-overlay__panel">
			<MoveMealSheet meal={moveTarget} onClose={() => (moveTarget = null)} />
		</div>
	</div>
{/if}

<style>
	.plan {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}

	.topbar {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-6);
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
		background: var(--bg);
	}
	.topbar__title h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: var(--weight-bold);
		font-size: var(--text-2xl);
		color: var(--text);
	}
	.topbar__title p {
		margin: 2px 0 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.periodnav {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-left: var(--space-2);
	}
	.periodnav__range {
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
		min-width: 150px;
		text-align: center;
		color: var(--text);
	}
	.icon-btn {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-strong);
		background: var(--surface);
		color: var(--text-secondary);
		display: grid;
		place-items: center;
		cursor: pointer;
		font-size: 1.1em;
		transition:
			background var(--transition),
			color var(--transition);
	}
	.icon-btn:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.icon-btn:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.spacer {
		flex: 1;
	}
	.viewswitch {
		display: flex;
		gap: var(--space-1);
		border: 1px solid var(--border);
		background: var(--surface);
		border-radius: var(--radius-pill);
		padding: 3px;
	}

	.plan__error {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		margin: var(--space-4) var(--space-6) 0;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		background: var(--attention-soft);
		color: var(--attention);
		font-size: var(--text-sm);
	}
	.plan__loading {
		margin: var(--space-4) var(--space-6) 0;
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}

	.plan__scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: var(--space-5) var(--space-6) var(--space-8);
	}

	.sheet-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgb(0 0 0 / 0.5);
	}
	.sheet-overlay__panel {
		width: 100%;
		max-width: 32rem;
		max-height: 90vh;
		overflow-y: auto;
	}
	@media (min-width: 640px) {
		.sheet-overlay {
			align-items: center;
		}
	}
</style>
