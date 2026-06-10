<script lang="ts">
	import MealCard from './MealCard.svelte';
	import {
		MEAL_SLOTS,
		mealSlotLabel,
		mealsInGroup,
		todayLocalISO,
		weekDatesOf,
		weekdayLabel,
		dayOfMonth,
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

	// Slot rows per design/screens/web-calendar.html, plus the unslotted "Anytime"
	// group (Domain Spec §2.4: bands are never capacity limits).
	const SLOT_ICONS: Record<MealSlot, string> = {
		BREAKFAST: 'ph-coffee',
		LUNCH: 'ph-bowl-food',
		DINNER: 'ph-fork-knife',
		SNACK: 'ph-cookie'
	};
	const rows: { slot: MealSlot | null; icon: string }[] = [
		...MEAL_SLOTS.map((s) => ({ slot: s as MealSlot | null, icon: SLOT_ICONS[s] })),
		{ slot: null, icon: 'ph-circle-dashed' }
	];

	let dropTarget = $state<string | null>(null);

	function cellKey(date: ISODate, slot: MealSlot | null): string {
		return `${date}|${slot ?? 'ANYTIME'}`;
	}

	function handleDragOver(e: DragEvent, date: ISODate, slot: MealSlot | null) {
		if (!e.dataTransfer?.types.includes('text/nk-planned-meal')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		dropTarget = cellKey(date, slot);
	}

	function handleDrop(e: DragEvent, date: ISODate, slot: MealSlot | null) {
		dropTarget = null;
		const mealId = e.dataTransfer?.getData('text/nk-planned-meal');
		if (!mealId) return;
		e.preventDefault();
		onDropMeal?.(mealId, date, slot);
	}
</script>

<!--
	WeekView — the planning grid per design/screens/web-calendar.html: slot rows
	(label column with icon) × Monday-start day columns. Empty cells invite with a
	dashed "+ Add" (gaps without judgment — design readme); cells are drop targets.
-->
<div class="cal" role="group" aria-label="Week planner">
	<div class="cal__corner"></div>
	{#each dates as date (date)}
		<button
			type="button"
			class="cal__day"
			class:cal__day--today={date === today}
			onclick={() => onOpenDay?.(date)}
			aria-label="Open {weekdayLabel(date)} {date} in day view"
		>
			<span>{weekdayLabel(date)}</span>
			<b>{dayOfMonth(date)}</b>
		</button>
	{/each}

	{#each rows as row (row.slot ?? 'ANYTIME')}
		<div class="cal__slot">
			<span>{mealSlotLabel(row.slot)}</span>
			<i class="ph {row.icon}" aria-hidden="true"></i>
		</div>
		{#each dates as date (date)}
			{@const meals = mealsInGroup(date, row.slot)}
			<div
				class="cell"
				class:cell--today={date === today}
				class:cell--drop={dropTarget === cellKey(date, row.slot)}
				role="group"
				aria-label="{mealSlotLabel(row.slot)} on {date}"
				ondragover={(e) => handleDragOver(e, date, row.slot)}
				ondragleave={() => (dropTarget = null)}
				ondrop={(e) => handleDrop(e, date, row.slot)}
			>
				{#each meals as meal (meal.id)}
					<MealCard {meal} compact onclick={() => onMealClick?.(meal)} />
				{/each}
				<button
					type="button"
					class="cell__add"
					class:cell__add--quiet={meals.length > 0}
					aria-label="Add a meal to {mealSlotLabel(row.slot)} on {date}"
					onclick={() => onAdd?.(date, row.slot)}
				>
					<i class="ph ph-plus" aria-hidden="true"></i>
					{#if meals.length === 0}Add{/if}
				</button>
			</div>
		{/each}
	{/each}
</div>

<style>
	.cal {
		display: grid;
		grid-template-columns: 92px repeat(7, minmax(150px, 1fr));
		gap: var(--space-2);
		min-width: 1040px;
	}

	.cal__day {
		padding: var(--space-2) var(--space-3);
		text-align: center;
		border: none;
		background: transparent;
		border-radius: var(--radius-md);
		cursor: pointer;
		font-family: var(--font-sans);
		transition: background var(--transition);
	}
	.cal__day:hover {
		background: var(--surface-2);
	}
	.cal__day:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.cal__day span {
		font-size: var(--text-xs);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: var(--tracking-wide);
		font-weight: var(--weight-semibold);
		display: block;
	}
	.cal__day b {
		font-family: var(--font-display);
		font-size: var(--text-lg);
		display: block;
		color: var(--text);
	}
	.cal__day--today {
		background: var(--primary-soft);
	}
	.cal__day--today b {
		color: var(--primary-text);
	}

	.cal__slot {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-3) 0 0;
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-muted);
		text-align: right;
	}
	.cal__slot i {
		font-size: 1.3em;
	}

	.cell {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		min-height: 96px;
		padding: var(--space-2);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		transition:
			border-color var(--transition),
			background var(--transition);
	}
	.cell--today {
		background: color-mix(in oklab, var(--primary-soft) 50%, var(--surface));
	}
	.cell--drop {
		border: 1.5px dashed var(--primary);
		background: var(--primary-soft);
	}

	.cell__add {
		flex: 1;
		min-height: 60px;
		border: 1.5px dashed var(--border-strong);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
		font-family: var(--font-sans);
		transition:
			border-color var(--transition),
			color var(--transition),
			background var(--transition);
	}
	.cell__add:hover {
		border-color: var(--primary);
		color: var(--primary-text);
		background: var(--primary-soft);
	}
	.cell__add:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	/* Occupied cells keep a quiet add affordance below the meals */
	.cell__add--quiet {
		flex: 0;
		min-height: 32px;
		border-style: dashed;
		border-color: transparent;
		opacity: 0;
	}
	.cell:hover .cell__add--quiet,
	.cell__add--quiet:focus-visible {
		opacity: 1;
		border-color: var(--border-strong);
	}
</style>
