<script lang="ts">
	import MealCard from './MealCard.svelte';
	import { mealSlotLabel, type ISODate, type MealSlot, type PlannedMeal } from '$lib/planning';

	interface Props {
		date: ISODate;
		slot: MealSlot | null;
		meals: PlannedMeal[];
		/** Compact rendering for tight week columns. */
		compact?: boolean;
		onAdd?: (date: ISODate, slot: MealSlot | null) => void;
		onMealClick?: (meal: PlannedMeal) => void;
		/** Drop target for drag-and-drop moves (FR-PL-013/015). */
		onDropMeal?: (mealId: string, date: ISODate, slot: MealSlot | null) => void;
		ondragstartmeal?: (meal: PlannedMeal) => void;
		ondragendmeal?: () => void;
	}

	let {
		date,
		slot,
		meals,
		compact = false,
		onAdd,
		onMealClick,
		onDropMeal,
		ondragstartmeal,
		ondragendmeal
	}: Props = $props();

	let dropActive = $state(false);

	function handleDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('text/nk-planned-meal')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		dropActive = true;
	}

	function handleDrop(e: DragEvent) {
		dropActive = false;
		const mealId = e.dataTransfer?.getData('text/nk-planned-meal');
		if (!mealId) return;
		e.preventDefault();
		onDropMeal?.(mealId, date, slot);
	}
</script>

<!--
	SlotBand — one (date, slot) group: a conceptual time-of-day band, never a capacity
	limit (Domain Spec §2.4). Any number of meals, ordered by saved sort order; the
	null slot renders as "Anytime". Empty copy is neutral, never guilt (FR-PL-020).
-->
<section
	aria-label="{mealSlotLabel(slot)} on {date}"
	class="flex flex-col gap-1 rounded-[var(--radius-md)] transition-colors duration-[var(--transition)] {compact
		? 'p-1'
		: 'p-2'} {dropActive
		? 'bg-[var(--primary-soft)] outline-2 outline-[var(--primary)] outline-dashed'
		: ''}"
	ondragover={handleDragOver}
	ondragleave={() => (dropActive = false)}
	ondrop={handleDrop}
>
	<header class="flex items-center justify-between gap-1">
		<h4 class="nk-eyebrow m-0 {compact ? 'text-[0.625rem]' : ''}">
			{mealSlotLabel(slot)}
		</h4>
		<button
			type="button"
			class="nk-btn nk-btn--ghost nk-btn--sm shrink-0 {compact ? 'min-h-[28px] px-1.5' : ''}"
			aria-label="Add a meal to {mealSlotLabel(slot)} on {date}"
			onclick={() => onAdd?.(date, slot)}
		>
			+
		</button>
	</header>

	{#if meals.length === 0}
		<p class="m-0 px-1 text-[var(--text-muted)] text-[var(--text-xs)] italic">
			{compact ? '—' : 'Nothing planned'}
		</p>
	{:else}
		<ul class="m-0 flex list-none flex-col gap-1 p-0">
			{#each meals as meal (meal.id)}
				<li>
					<MealCard
						{meal}
						{compact}
						onclick={() => onMealClick?.(meal)}
						{ondragstartmeal}
						{ondragendmeal}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</section>
