<script lang="ts">
	import { plannedMealName, type PlannedMeal } from '$lib/planning';

	interface Props {
		meal: PlannedMeal;
		/** Compact rendering for tight week columns. */
		compact?: boolean;
		onclick?: () => void;
		/** Set while this card is being dragged (pointer devices, FR-PL-013). */
		ondragstartmeal?: (meal: PlannedMeal) => void;
		ondragendmeal?: () => void;
	}

	let { meal, compact = false, onclick, ondragstartmeal, ondragendmeal }: Props = $props();

	const name = $derived(plannedMealName(meal));

	function sourceLabel(source: PlannedMeal['source']): string {
		switch (source) {
			case 'RECIPE':
				return 'Recipe';
			case 'STORE_BOUGHT':
				return 'Buy';
			case 'QUICK':
				return 'Quick';
			case 'PREPPED':
				return 'Prepped';
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick?.();
		}
	}

	function handleDragStart(e: DragEvent) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData('text/nk-planned-meal', meal.id);
		e.dataTransfer.effectAllowed = 'move';
		ondragstartmeal?.(meal);
	}
</script>

<!--
	MealCard — one planned meal on the calendar (FR-PL-003).
	Touch target ≥44px in full mode; draggable on pointer devices, with the
	tap-based Move sheet as the universal path (FR-PL-013).
-->
<div
	role="button"
	tabindex="0"
	aria-label="{name}, {sourceLabel(meal.source)}, {meal.servings} serving{meal.servings === 1
		? ''
		: 's'}"
	class="nk-card flex w-full cursor-pointer items-center gap-2 text-left transition-shadow duration-[var(--transition)] hover:shadow-[var(--shadow-md)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] active:scale-[0.99] {compact
		? 'min-h-[32px] p-1.5'
		: 'min-h-[44px] p-2.5'}"
	draggable="true"
	{onclick}
	onkeydown={handleKeydown}
	ondragstart={handleDragStart}
	ondragend={() => ondragendmeal?.()}
>
	<div class="min-w-0 flex-1">
		<p
			class="truncate font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text)] {compact
				? 'text-[var(--text-xs)]'
				: 'text-[var(--text-sm)]'}"
		>
			{name}
		</p>
		{#if !compact}
			<p class="text-[var(--text-secondary)] text-[var(--text-xs)]">
				{sourceLabel(meal.source)} · {meal.servings} serving{meal.servings === 1 ? '' : 's'}
			</p>
		{/if}
	</div>
	{#if compact}
		<span class="nk-badge nk-badge--muted shrink-0" aria-hidden="true">
			{sourceLabel(meal.source)}
		</span>
	{/if}
</div>
