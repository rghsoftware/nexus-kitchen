<script lang="ts">
	import { plannedMealName, type PlannedMeal } from '$lib/planning';

	interface Props {
		meal: PlannedMeal;
		/** Small chip for week-grid cells; full row for the day view. */
		compact?: boolean;
		onclick?: () => void;
		/** Set while this card is being dragged (pointer devices, FR-PL-013). */
		ondragstartmeal?: (meal: PlannedMeal) => void;
		ondragendmeal?: () => void;
	}

	let { meal, compact = false, onclick, ondragstartmeal, ondragendmeal }: Props = $props();

	const name = $derived(plannedMealName(meal));

	// Source → glyph + worded chip. Icons always pair with a text label (design readme:
	// color is never the only signal). Fulfillment states arrive in a later chunk.
	const SOURCE = {
		RECIPE: { label: 'Recipe', icon: 'ph-cooking-pot', tile: 'tile--recipe' },
		STORE_BOUGHT: { label: 'To buy', icon: 'ph-shopping-bag', tile: 'tile--buy' },
		QUICK: { label: 'Quick', icon: 'ph-lightning', tile: 'tile--quick' },
		PREPPED: { label: 'Prepped', icon: 'ph-snowflake', tile: 'tile--recipe' } // reserved
	} as const;
	const source = $derived(SOURCE[meal.source]);

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
	MealCard — one planned meal (FR-PL-003), per design/screens/web-calendar.html (.meal)
	and mobile-calendar.html (.mmeal): colored glyph tile + name + worded source chip.
	Draggable on pointer devices; the tap Move sheet is the universal path (FR-PL-013).
-->
<div
	role="button"
	tabindex="0"
	aria-label="{name}, {source.label}, {meal.servings} serving{meal.servings === 1 ? '' : 's'}"
	class="meal {compact ? 'meal--compact' : ''}"
	draggable="true"
	{onclick}
	onkeydown={handleKeydown}
	ondragstart={handleDragStart}
	ondragend={() => ondragendmeal?.()}
>
	<span class="tile {source.tile}" aria-hidden="true"><i class="ph {source.icon}"></i></span>
	<span class="body">
		<span class="name">{name}</span>
		{#if !compact}
			<span class="meta">
				<span class="chip"><i class="ph {source.icon}" aria-hidden="true"></i> {source.label}</span>
				<span class="chip chip--quiet">
					{meal.servings} serving{meal.servings === 1 ? '' : 's'}
				</span>
			</span>
		{/if}
	</span>
	{#if !compact}
		<i class="ph ph-caret-right chev" aria-hidden="true"></i>
	{/if}
</div>

<style>
	.meal {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		box-shadow: var(--shadow-sm);
		cursor: grab;
		text-align: left;
		transition:
			border-color var(--transition),
			box-shadow var(--transition);
	}
	.meal:hover {
		border-color: var(--border-strong);
		box-shadow: var(--shadow-md);
	}
	.meal:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.meal:active {
		transform: translateY(1px) scale(0.99);
	}
	.meal--compact {
		gap: var(--space-2);
		padding: var(--space-2);
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		box-shadow: none;
		align-items: flex-start;
	}

	.tile {
		width: 46px;
		height: 46px;
		flex: none;
		border-radius: var(--radius-sm);
		display: grid;
		place-items: center;
		font-size: 24px;
	}
	.meal--compact .tile {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		font-size: 16px;
	}
	.tile--recipe {
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.tile--buy {
		background: var(--clay-50);
		color: var(--clay-600);
	}
	.tile--quick {
		background: var(--surface-2);
		color: var(--text-secondary);
	}
	.meal--compact .tile--quick {
		background: var(--surface);
	}

	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.name {
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
		line-height: var(--leading-snug);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meal--compact .name {
		font-size: var(--text-sm);
		line-height: 1.2;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 5px;
		flex-wrap: wrap;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--text-2xs);
		font-weight: var(--weight-bold);
		padding: 3px 8px;
		border-radius: var(--radius-pill);
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.tile--buy ~ .body .chip:not(.chip--quiet) {
		background: var(--clay-50);
		color: var(--clay-600);
	}
	.tile--quick ~ .body .chip:not(.chip--quiet) {
		background: var(--surface-2);
		color: var(--text-secondary);
	}
	.chip--quiet {
		background: var(--surface-2);
		color: var(--text-secondary);
	}
	.chev {
		color: var(--text-muted);
		font-size: 1.2em;
	}
</style>
