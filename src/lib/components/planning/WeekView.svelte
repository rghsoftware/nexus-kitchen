<script lang="ts">
	import SlotBand from './SlotBand.svelte';
	import {
		MEAL_SLOTS,
		dayLabel,
		mealsInGroup,
		todayLocalISO,
		weekDatesOf,
		weekdayLabel,
		type ISODate,
		type MealSlot,
		type PlannedMeal
	} from '$lib/planning';

	interface Props {
		/** Any date inside the week to display. */
		anchor: ISODate;
		onAdd?: (date: ISODate, slot: MealSlot | null) => void;
		onMealClick?: (meal: PlannedMeal) => void;
		onDropMeal?: (mealId: string, date: ISODate, slot: MealSlot | null) => void;
		onOpenDay?: (date: ISODate) => void;
	}

	let { anchor, onAdd, onMealClick, onDropMeal, onOpenDay }: Props = $props();

	const dates = $derived(weekDatesOf(anchor));
	const today = todayLocalISO();
	const bands: (MealSlot | null)[] = [...MEAL_SLOTS, null];
</script>

<!--
	WeekView — 7 Monday-start day columns of slot bands (FR-PL-001/002). On small
	screens the grid scrolls horizontally with snap points so every day stays
	reachable; the Day view is the focused small-screen experience (FR-PL-004).
-->
<div
	class="grid snap-x snap-mandatory auto-cols-[minmax(11rem,1fr)] grid-flow-col gap-2 overflow-x-auto pb-2 lg:auto-cols-fr"
	role="list"
	aria-label="Week of {dayLabel(dates[0])}"
>
	{#each dates as date (date)}
		<div
			role="listitem"
			class="flex min-w-0 snap-start flex-col gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-2 {date ===
			today
				? 'border-[var(--primary)]'
				: ''}"
		>
			<button
				type="button"
				class="flex items-baseline gap-2 rounded-[var(--radius-sm)] border-0 bg-transparent p-1 text-left focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] {onOpenDay
					? 'cursor-pointer'
					: ''}"
				aria-label="Open {weekdayLabel(date)} {dayLabel(date)} in day view"
				onclick={() => onOpenDay?.(date)}
			>
				<span
					class="font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text-sm)] {date ===
					today
						? 'text-[var(--primary)]'
						: 'text-[var(--text)]'}"
				>
					{weekdayLabel(date)}
				</span>
				<span class="text-[var(--text-secondary)] text-[var(--text-xs)]">{dayLabel(date)}</span>
				{#if date === today}
					<span class="nk-badge shrink-0">Today</span>
				{/if}
			</button>

			{#each bands as slot (slot ?? 'ANYTIME')}
				<SlotBand
					{date}
					{slot}
					meals={mealsInGroup(date, slot)}
					compact
					{onAdd}
					{onMealClick}
					{onDropMeal}
				/>
			{/each}
		</div>
	{/each}
</div>
