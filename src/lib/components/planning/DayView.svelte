<script lang="ts">
	import SlotBand from './SlotBand.svelte';
	import {
		MEAL_SLOTS,
		dayFullLabel,
		mealsInGroup,
		todayLocalISO,
		type ISODate,
		type MealSlot,
		type PlannedMeal
	} from '$lib/planning';

	interface Props {
		date: ISODate;
		onAdd?: (date: ISODate, slot: MealSlot | null) => void;
		onMealClick?: (meal: PlannedMeal) => void;
		onDropMeal?: (mealId: string, date: ISODate, slot: MealSlot | null) => void;
	}

	let { date, onAdd, onMealClick, onDropMeal }: Props = $props();

	const today = todayLocalISO();
	const bands: (MealSlot | null)[] = [...MEAL_SLOTS, null];
</script>

<!-- DayView — full slot-band detail for a single day (FR-PL-001/004). -->
<div class="mx-auto flex w-full max-w-2xl flex-col gap-2">
	<h3
		class="m-0 flex items-center gap-2 font-[var(--font-display)] font-[var(--weight-bold)] text-[var(--text)] text-[var(--text-lg)]"
	>
		{dayFullLabel(date)}
		{#if date === today}
			<span class="nk-badge">Today</span>
		{/if}
	</h3>

	{#each bands as slot (slot ?? 'ANYTIME')}
		<div class="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
			<SlotBand {date} {slot} meals={mealsInGroup(date, slot)} {onAdd} {onMealClick} {onDropMeal} />
		</div>
	{/each}
</div>
