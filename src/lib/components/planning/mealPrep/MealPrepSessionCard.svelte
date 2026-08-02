<script lang="ts">
	import type { MealPrepSession } from '$lib/planning/mealPrep/types';

	interface Props {
		session: MealPrepSession;
		onComplete?: (session: MealPrepSession) => void;
		onCancel?: (session: MealPrepSession) => void;
		onBuildShoppingList?: (session: MealPrepSession) => void;
	}

	let { session, onComplete, onCancel, onBuildShoppingList }: Props = $props();

	const STATUS_LABEL: Record<MealPrepSession['status'], string> = {
		PLANNED: 'Planned',
		COMPLETED: 'Prepped',
		CANCELLED: 'Cancelled'
	};

	// Status chip colors via semantic tokens — never color alone (text label always present).
	const STATUS_STYLE: Record<MealPrepSession['status'], string> = {
		PLANNED: 'background: var(--primary-soft); color: var(--primary-text);',
		COMPLETED: 'background: var(--surface-3); color: var(--text-secondary);',
		CANCELLED: 'background: var(--surface-3); color: var(--text-muted);'
	};

	const isPlanned = $derived(session.status === 'PLANNED');

	// 'YYYY-MM-DD' parses as UTC midnight; render in UTC to avoid an off-by-one day.
	const prepDayFormatted = $derived(
		new Date(`${session.prepDay}T00:00:00Z`).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		})
	);
</script>

<article
	class="nk-card nk-stack"
	aria-label="Prep session for {prepDayFormatted}"
	style="gap: var(--space-4); padding: var(--space-5);"
>
	<header
		class="nk-row"
		style="justify-content: space-between; align-items: flex-start; gap: var(--space-3);"
	>
		<div class="nk-stack" style="gap: var(--space-1);">
			<span class="nk-eyebrow">Prep day</span>
			<span
				style="font-family: var(--font-display); font-size: var(--text-lg); font-weight: var(--weight-bold); color: var(--text);"
			>
				{prepDayFormatted}
			</span>
		</div>
		<span
			style="flex-shrink: 0; padding: var(--space-1) var(--space-3); border-radius: var(--radius-pill); font-size: var(--text-xs); font-weight: var(--weight-semibold); {STATUS_STYLE[
				session.status
			]}"
		>
			{STATUS_LABEL[session.status]}
		</span>
	</header>

	<ul class="nk-stack" style="list-style: none; margin: 0; padding: 0; gap: var(--space-2);">
		{#each session.recipes as recipe (recipe.id)}
			<li
				class="nk-row"
				style="justify-content: space-between; gap: var(--space-3); font-size: var(--text-sm);"
			>
				<span
					style="color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
				>
					{recipe.recipeName}
				</span>
				<span
					style="flex-shrink: 0; color: var(--text-secondary); font-variant-numeric: tabular-nums;"
				>
					{recipe.servingsToPrep} serving{recipe.servingsToPrep === 1 ? '' : 's'}
				</span>
			</li>
		{/each}
	</ul>

	{#if isPlanned}
		<div class="nk-row" style="gap: var(--space-2); flex-wrap: wrap;">
			<button type="button" class="nk-btn nk-btn--primary" onclick={() => onComplete?.(session)}>
				Mark prepped
			</button>
			{#if onBuildShoppingList}
				<button
					type="button"
					class="nk-btn nk-btn--secondary"
					onclick={() => onBuildShoppingList(session)}
				>
					Build shopping list
				</button>
			{/if}
			<button type="button" class="nk-btn nk-btn--secondary" onclick={() => onCancel?.(session)}>
				Cancel
			</button>
		</div>
	{/if}
</article>
