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
	MonthView — Monday-aligned month grid with compact per-day summaries; tapping a
	day opens the Day view (FR-PL-001). Out-of-month days are dimmed but interactive.
-->
<div class="flex flex-col gap-1">
	<div class="grid grid-cols-7 gap-1" aria-hidden="true">
		{#each weekdays as wd (wd)}
			<span
				class="px-1 text-center font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-xs)]"
			>
				{wd}
			</span>
		{/each}
	</div>

	<div class="grid grid-cols-7 gap-1" aria-label="Month grid">
		{#each dates as date (date)}
			{@const meals = mealsOn(date)}
			<button
				type="button"
				class="flex min-h-[72px] cursor-pointer flex-col items-stretch gap-0.5 rounded-[var(--radius-md)] border bg-[var(--surface)] p-1 text-left transition-shadow duration-[var(--transition)] hover:shadow-[var(--shadow-md)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] {date ===
				today
					? 'border-[var(--primary)]'
					: 'border-[var(--border)]'} {isSameMonth(date, anchor) ? '' : 'opacity-50'}"
				aria-label="{date}, {meals.length} meal{meals.length === 1 ? '' : 's'} planned"
				onclick={() => onOpenDay?.(date)}
			>
				<span
					class="font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text-xs)] {date ===
					today
						? 'text-[var(--primary)]'
						: 'text-[var(--text-secondary)]'}"
				>
					{dayOfMonth(date)}
				</span>
				{#each meals.slice(0, MAX_NAMES) as meal (meal.id)}
					<span
						class="truncate rounded-[var(--radius-sm)] bg-[var(--primary-soft)] px-1 text-[0.625rem] leading-4 text-[var(--text)]"
					>
						{plannedMealName(meal)}
					</span>
				{/each}
				{#if meals.length > MAX_NAMES}
					<span class="px-1 text-[0.625rem] text-[var(--text-muted)]">
						+{meals.length - MAX_NAMES} more
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>
