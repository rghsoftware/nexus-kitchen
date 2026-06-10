<script lang="ts">
	import {
		dayOfMonth,
		isSameMonth,
		mealsOn,
		monthGridDates,
		plannedMealName,
		todayLocalISO,
		type ISODate
	} from '$lib/planning';

	interface Props {
		/** Any date inside the month to display. */
		anchor: ISODate;
		/** Tapping a day opens it in Day view (FR-PL-001). */
		onOpenDay?: (date: ISODate) => void;
	}

	let { anchor, onOpenDay }: Props = $props();

	const dates = $derived(monthGridDates(anchor));
	const today = todayLocalISO();
	const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const MAX_NAMES = 3;
</script>

<!--
	MonthView — Monday-aligned month grid in the calendar's visual language
	(surface cells, primary-soft today). Tapping a day opens the Day view (FR-PL-001).
-->
<div class="month">
	<div class="month__weekdays" aria-hidden="true">
		{#each weekdays as wd (wd)}
			<span>{wd}</span>
		{/each}
	</div>

	<div class="month__grid" aria-label="Month grid">
		{#each dates as date (date)}
			{@const meals = mealsOn(date)}
			<button
				type="button"
				class="mday"
				class:mday--today={date === today}
				class:mday--out={!isSameMonth(date, anchor)}
				aria-label="{date}, {meals.length} meal{meals.length === 1 ? '' : 's'} planned"
				onclick={() => onOpenDay?.(date)}
			>
				<b>{dayOfMonth(date)}</b>
				{#each meals.slice(0, MAX_NAMES) as meal (meal.id)}
					<span class="mday__meal">{plannedMealName(meal)}</span>
				{/each}
				{#if meals.length > MAX_NAMES}
					<span class="mday__more">+{meals.length - MAX_NAMES} more</span>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.month__weekdays {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.month__weekdays span {
		text-align: center;
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.month__grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: var(--space-2);
	}
	.mday {
		min-height: 88px;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 3px;
		padding: var(--space-2);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		cursor: pointer;
		text-align: left;
		font-family: var(--font-sans);
		transition:
			border-color var(--transition),
			box-shadow var(--transition);
	}
	.mday:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-sm);
	}
	.mday:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.mday b {
		font-family: var(--font-display);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	.mday--today {
		background: color-mix(in oklab, var(--primary-soft) 50%, var(--surface));
		border-color: var(--primary);
	}
	.mday--today b {
		color: var(--primary-text);
	}
	.mday--out {
		opacity: 0.45;
	}
	.mday__meal {
		font-size: var(--text-2xs);
		font-weight: var(--weight-semibold);
		line-height: 1.5;
		padding: 1px 6px;
		border-radius: var(--radius-pill);
		background: var(--primary-soft);
		color: var(--primary-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mday__more {
		font-size: var(--text-2xs);
		color: var(--text-muted);
		padding-left: 6px;
	}
</style>
