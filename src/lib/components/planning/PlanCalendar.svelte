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

	function setView(v: View) {
		view = v;
	}

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
	PlanCalendar — the Plan tab shell (FR-PL-001): Day/Week/Month switcher, period
	navigation, Today shortcut. The calendar is the only planning surface; implicit
	weekly plans are managed by the service layer, never by the user (FR-PL-011).
-->
<div class="flex h-full flex-col gap-3 p-4">
	<header class="flex flex-wrap items-center gap-2">
		<h2
			class="m-0 min-w-0 flex-1 truncate font-[var(--font-display)] font-[var(--weight-bold)] text-[var(--text)] text-[var(--text-xl)]"
		>
			{periodTitle}
		</h2>

		<div class="flex items-center gap-1" role="group" aria-label="Calendar navigation">
			<button
				type="button"
				class="nk-btn nk-btn--ghost nk-btn--sm"
				aria-label="Previous {view}"
				onclick={() => step(-1)}
			>
				‹
			</button>
			<button type="button" class="nk-btn nk-btn--secondary nk-btn--sm" onclick={goToday}>
				Today
			</button>
			<button
				type="button"
				class="nk-btn nk-btn--ghost nk-btn--sm"
				aria-label="Next {view}"
				onclick={() => step(1)}
			>
				›
			</button>
		</div>

		<div
			class="flex gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-0.5"
			role="group"
			aria-label="Calendar view"
		>
			{#each views as v (v.id)}
				<button
					type="button"
					class="nk-btn nk-btn--sm {view === v.id ? 'nk-btn--primary' : 'nk-btn--ghost'}"
					aria-pressed={view === v.id}
					onclick={() => setView(v.id)}
				>
					{v.label}
				</button>
			{/each}
		</div>
	</header>

	{#if planError()}
		<div
			class="flex items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--attention-soft,var(--surface))] p-3 text-[var(--attention)] text-[var(--text-sm)]"
			role="alert"
		>
			<span>{planError()}</span>
			<button type="button" class="nk-btn nk-btn--ghost nk-btn--sm" onclick={clearPlanError}>
				Dismiss
			</button>
		</div>
	{/if}

	{#if planLoading() && plannedMeals().length === 0}
		<p class="m-0 text-[var(--text-secondary)] text-[var(--text-sm)]" aria-live="polite">
			Loading your plan…
		</p>
	{/if}

	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if view === 'week'}
			<WeekView
				{anchor}
				onAdd={openAdd}
				onMealClick={openDetail}
				onDropMeal={handleDropMeal}
				onOpenDay={openDay}
			/>
		{:else if view === 'day'}
			<DayView date={anchor} onAdd={openAdd} onMealClick={openDetail} onDropMeal={handleDropMeal} />
		{:else}
			<MonthView {anchor} onOpenDay={openDay} />
		{/if}
	</div>
</div>

{#if addTarget}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-label="Add a meal"
	>
		<div class="max-h-[90vh] w-full max-w-lg overflow-y-auto">
			<AddMealSheet
				date={addTarget.date}
				slot={addTarget.slot}
				onClose={() => (addTarget = null)}
			/>
		</div>
	</div>
{/if}

{#if detailMeal}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-label="Meal details"
	>
		<div class="max-h-[90vh] w-full max-w-lg overflow-y-auto">
			<MealDetailSheet meal={detailMeal} onClose={() => (detailMeal = null)} onMove={openMove} />
		</div>
	</div>
{/if}

{#if moveTarget}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-label="Move meal"
	>
		<div class="max-h-[90vh] w-full max-w-lg overflow-y-auto">
			<MoveMealSheet meal={moveTarget} onClose={() => (moveTarget = null)} />
		</div>
	</div>
{/if}
