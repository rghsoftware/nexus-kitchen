<script lang="ts">
	import MealCard from './MealCard.svelte';
	import { mealSlotLabel, type ISODate, type MealSlot, type PlannedMeal } from '$lib/planning';

	interface Props {
		date: ISODate;
		slot: MealSlot | null;
		icon: string;
		meals: PlannedMeal[];
		onAdd?: (date: ISODate, slot: MealSlot | null) => void;
		onMealClick?: (meal: PlannedMeal) => void;
		/** Drop target for drag-and-drop moves (FR-PL-013/015). */
		onDropMeal?: (mealId: string, date: ISODate, slot: MealSlot | null) => void;
	}

	let { date, slot, icon, meals, onAdd, onMealClick, onDropMeal }: Props = $props();

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

	const label = $derived(mealSlotLabel(slot));
</script>

<!--
	SlotBand — one day-view slot section per design/screens/mobile-calendar.html
	(.slot / .mmeal / .addmeal). A band is a time-of-day group, never a capacity limit
	(Domain Spec §2.4). The empty state is the dashed add affordance itself —
	"Empty meal slots say 'Add', never 'You skipped'" (design readme, FR-PL-020).
-->
<section
	aria-label="{label} on {date}"
	class="slot"
	class:slot--drop={dropActive}
	ondragover={handleDragOver}
	ondragleave={() => (dropActive = false)}
	ondrop={handleDrop}
>
	<header class="slot__head">
		<i class="ph {icon}" aria-hidden="true"></i>
		<h4>{label}</h4>
	</header>

	{#if meals.length > 0}
		<ul class="slot__meals">
			{#each meals as meal (meal.id)}
				<li>
					<MealCard {meal} onclick={() => onMealClick?.(meal)} />
				</li>
			{/each}
		</ul>
	{/if}

	<button
		type="button"
		class="addmeal"
		class:addmeal--after={meals.length > 0}
		aria-label="Add a meal to {label} on {date}"
		onclick={() => onAdd?.(date, slot)}
	>
		<i class="ph ph-plus" aria-hidden="true"></i>
		Add {meals.length > 0 ? 'another' : 'a meal'}
	</button>
</section>

<style>
	.slot {
		margin-top: var(--space-5);
		border-radius: var(--radius-md);
		transition: background var(--transition);
	}
	.slot--drop {
		background: var(--primary-soft);
		outline: 1.5px dashed var(--primary);
		outline-offset: 4px;
	}
	.slot__head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.slot__head i {
		color: var(--text-muted);
		font-size: 1.2em;
	}
	.slot__head h4 {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.slot__meals {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.addmeal {
		width: 100%;
		min-height: 56px;
		border: 1.5px dashed var(--border-strong);
		border-radius: var(--radius-md);
		background: transparent;
		color: var(--text-muted);
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
		font-family: var(--font-sans);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		cursor: pointer;
		transition:
			border-color var(--transition),
			color var(--transition),
			background var(--transition);
	}
	.addmeal--after {
		margin-top: var(--space-2);
		min-height: 44px;
		font-size: var(--text-sm);
	}
	.addmeal:hover {
		border-color: var(--primary);
		color: var(--primary-text);
		background: var(--primary-soft);
	}
	.addmeal:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
