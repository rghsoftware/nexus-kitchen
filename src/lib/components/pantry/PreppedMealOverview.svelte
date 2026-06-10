<script lang="ts">
	import {
		preppedMeals,
		preppedMealsLoading,
		optimisticConsumePortions,
		optimisticStartDefrost,
		optimisticMarkDefrostReady
	} from '$lib/pantry/preppedMealStore.svelte';
	import type { PreppedMeal } from '$lib/pantry/types';
	import PreppedMealCard from './PreppedMealCard.svelte';

	interface Props {
		onAddPrepped?: () => void;
		onEditMeal?: (meal: PreppedMeal) => void;
	}

	let { onAddPrepped, onEditMeal }: Props = $props();

	// Nearest-expiry first; spread to avoid mutating the live $state array
	const sortedMeals = $derived(
		[...preppedMeals()].sort((a, b) => a.expiration_date.localeCompare(b.expiration_date))
	);

	const eatFirst = $derived(sortedMeals.slice(0, 3));
</script>

{#if preppedMealsLoading()}
	<!-- Loading skeleton -->
	<div
		class="nk-stack"
		style="gap: var(--space-5);"
		aria-busy="true"
		aria-label="Loading prepped meals"
	>
		<div
			style="height: var(--text-xl); width: 12rem; border-radius: var(--radius-sm); background: var(--surface-3);"
			aria-hidden="true"
			class="animate-pulse"
		></div>
		<div class="nk-row" style="gap: var(--space-3);" aria-hidden="true">
			{#each [0, 1, 2] as skeletonIdx (skeletonIdx)}
				<div
					class="nk-card animate-pulse"
					style="flex: 0 0 220px; min-height: 140px; padding: var(--space-4);"
				>
					<div
						style="height: 1rem; width: 70%; border-radius: var(--radius-sm); background: var(--surface-3); margin-bottom: var(--space-3);"
					></div>
					<div
						style="height: 0.75rem; width: 45%; border-radius: var(--radius-sm); background: var(--surface-2);"
					></div>
				</div>
			{/each}
		</div>
	</div>
{:else if preppedMeals().length === 0}
	<!-- Empty state -->
	<div
		class="nk-stack"
		style="align-items: center; justify-content: center; padding: var(--space-10) var(--space-6); gap: var(--space-5); text-align: center;"
	>
		<p style="font-size: var(--text-lg); color: var(--text-secondary);">No prepped meals yet</p>
		<p style="font-size: var(--text-sm); color: var(--text-muted); max-width: 32ch;">
			Add meals you've already made or start a prep session to batch-cook for the week.
		</p>
		<div class="nk-row" style="gap: var(--space-3); flex-wrap: wrap; justify-content: center;">
			{#if onAddPrepped}
				<button class="nk-btn nk-btn--primary" onclick={onAddPrepped} type="button">
					+ Add a prepped meal I already have
				</button>
			{/if}
			<!-- Prep sessions are a separate feature — kept visible but non-functional -->
			<button
				class="nk-btn nk-btn--secondary"
				type="button"
				disabled
				aria-disabled="true"
				title="Prep sessions coming soon"
				style="opacity: 0.5; cursor: not-allowed;"
			>
				+ Start a prep session
			</button>
		</div>
	</div>
{:else}
	<div class="nk-stack" style="gap: var(--space-7);">
		<!-- "Eat this first" section: up to 3 nearest-expiry meals -->
		{#if eatFirst.length > 0}
			<section aria-labelledby="eat-first-heading">
				<h2 id="eat-first-heading" class="nk-eyebrow" style="margin-bottom: var(--space-3);">
					Eat this first
				</h2>
				<!-- Horizontal scroll row on mobile -->
				<div
					class="nk-row nk-scroll"
					style="gap: var(--space-3); overflow-x: auto; padding-bottom: var(--space-2);"
				>
					{#each eatFirst as meal (meal.id)}
						<div style="flex: 0 0 min(220px, 80vw);">
							<PreppedMealCard
								{meal}
								onEdit={() => onEditMeal?.(meal)}
								onConsume={(_id, count) => optimisticConsumePortions(meal.id, count)}
								onStartDefrost={() => optimisticStartDefrost(meal.id)}
								onMarkReady={() => optimisticMarkDefrostReady(meal.id)}
							/>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Full list sorted by expiration date ascending -->
		<section aria-labelledby="all-prepped-heading">
			<h2 id="all-prepped-heading" class="nk-eyebrow" style="margin-bottom: var(--space-3);">
				All prepped meals
			</h2>
			<div class="nk-stack" style="gap: var(--space-3);">
				{#each sortedMeals as meal (meal.id)}
					<PreppedMealCard
						{meal}
						onEdit={() => onEditMeal?.(meal)}
						onConsume={(_id, count) => optimisticConsumePortions(meal.id, count)}
						onStartDefrost={() => optimisticStartDefrost(meal.id)}
						onMarkReady={() => optimisticMarkDefrostReady(meal.id)}
					/>
				{/each}
			</div>
		</section>
	</div>
{/if}
