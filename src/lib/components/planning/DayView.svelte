<script lang="ts">
	import SlotBand from './SlotBand.svelte';
	import {
		MEAL_SLOTS,
		dayFullLabel,
		dayOfMonth,
		mealsInGroup,
		mealsOn,
		todayLocalISO,
		weekDatesOf,
		weekdayLabel,
		type ISODate,
		type MealSlot,
		type PlannedMeal
	} from '$lib/planning';

	interface Props {
		date: ISODate;
		onSelectDay?: (date: ISODate) => void;
		onAdd?: (date: ISODate, slot: MealSlot | null) => void;
		onMealClick?: (meal: PlannedMeal) => void;
		onDropMeal?: (mealId: string, date: ISODate, slot: MealSlot | null) => void;
	}

	let { date, onSelectDay, onAdd, onMealClick, onDropMeal }: Props = $props();

	const today = todayLocalISO();
	const weekDates = $derived(weekDatesOf(date));

	const SLOT_ICONS: Record<MealSlot, string> = {
		BREAKFAST: 'ph-coffee',
		LUNCH: 'ph-bowl-food',
		DINNER: 'ph-fork-knife',
		SNACK: 'ph-cookie'
	};
	const bands: { slot: MealSlot | null; icon: string }[] = [
		...MEAL_SLOTS.map((s) => ({ slot: s as MealSlot | null, icon: SLOT_ICONS[s] })),
		{ slot: null, icon: 'ph-circle-dashed' }
	];
</script>

<!--
	DayView — day-focused planning per design/screens/mobile-calendar.html:
	a week strip of day pills (dots = planned meals) above the day's slot sections.
-->
<div class="dayview">
	<div class="weekstrip" role="group" aria-label="Pick a day this week">
		{#each weekDates as d (d)}
			{@const count = Math.min(mealsOn(d).length, 4)}
			<button
				type="button"
				class="day"
				class:day--sel={d === date}
				aria-pressed={d === date}
				aria-label="{weekdayLabel(d)} {d}, {mealsOn(d).length} meal{mealsOn(d).length === 1
					? ''
					: 's'} planned"
				onclick={() => onSelectDay?.(d)}
			>
				<span>{weekdayLabel(d)}</span>
				<b>{dayOfMonth(d)}</b>
				<span class="day__dots" aria-hidden="true">
					{#each Array.from({ length: count }).keys() as i (i)}<i></i>{/each}
				</span>
			</button>
		{/each}
	</div>

	<h3 class="dayview__title">
		{dayFullLabel(date)}
		{#if date === today}
			<span class="nk-badge">Today</span>
		{/if}
	</h3>

	{#each bands as band (band.slot ?? 'ANYTIME')}
		<SlotBand
			{date}
			slot={band.slot}
			icon={band.icon}
			meals={mealsInGroup(date, band.slot)}
			{onAdd}
			{onMealClick}
			{onDropMeal}
		/>
	{/each}
</div>

<style>
	.dayview {
		max-width: 40rem;
		margin: 0 auto;
		width: 100%;
	}
	.weekstrip {
		display: flex;
		gap: var(--space-2);
		padding-bottom: var(--space-4);
		overflow-x: auto;
	}
	.day {
		flex: none;
		width: 50px;
		height: 66px;
		border-radius: var(--radius-md);
		background: var(--surface);
		border: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		cursor: pointer;
		font-family: var(--font-sans);
		transition:
			background var(--transition),
			border-color var(--transition);
	}
	.day:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.day span {
		font-size: var(--text-2xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: var(--weight-bold);
		color: var(--text-muted);
	}
	.day b {
		font-family: var(--font-display);
		font-size: var(--text-lg);
		color: var(--text);
	}
	.day__dots {
		display: flex;
		gap: 3px;
		margin-top: 2px;
		min-height: 5px;
	}
	.day__dots i {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--primary);
		opacity: 0.5;
	}
	.day--sel {
		background: var(--primary);
		border-color: var(--primary);
	}
	.day--sel span,
	.day--sel b {
		color: var(--text-on-accent);
	}
	.day--sel .day__dots i {
		background: var(--text-on-accent);
		opacity: 0.8;
	}

	.dayview__title {
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-display);
		font-weight: var(--weight-bold);
		font-size: var(--text-lg);
		color: var(--text);
	}
</style>
