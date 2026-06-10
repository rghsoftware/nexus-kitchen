<script lang="ts">
	import {
		MEAL_SLOTS,
		mealSlotLabel,
		moveMeal,
		plannedMealName,
		type PlannedMeal
	} from '$lib/planning';

	interface Props {
		meal: PlannedMeal;
		onClose: () => void;
	}

	let { meal, onClose }: Props = $props();

	// The sheet unmounts on close, so capturing the meal's initial placement is intentional.
	// svelte-ignore state_referenced_locally
	let targetDate = $state(meal.date);
	// svelte-ignore state_referenced_locally
	let targetSlot = $state(meal.mealSlot);
	let moving = $state(false);
	let error = $state<string | null>(null);

	const name = $derived(plannedMealName(meal));

	/**
	 * Tap-based move — the accessible path for touch, keyboard, and screen-reader
	 * users (FR-PL-013). Cross-week moves re-home to the target week's plan
	 * automatically (FR-PL-015).
	 */
	async function handleMove() {
		moving = true;
		error = null;
		const moved = await moveMeal(meal.id, { date: targetDate, mealSlot: targetSlot });
		moving = false;
		if (moved) onClose();
		else error = "We couldn't move that meal. Please try again.";
	}
</script>

<!-- MoveMealSheet — pick a new date + slot for a planned meal. -->
<div
	class="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-[var(--surface)] p-6"
	style="box-shadow: var(--shadow-lg, var(--shadow-md));"
>
	<header class="flex items-start justify-between gap-2">
		<h2
			class="m-0 min-w-0 truncate font-[var(--font-display)] font-[var(--weight-bold)] text-[var(--text)] text-[var(--text-xl)]"
		>
			Move “{name}”
		</h2>
		<button
			type="button"
			class="nk-btn nk-btn--ghost nk-btn--sm"
			aria-label="Close"
			onclick={onClose}
		>
			✕
		</button>
	</header>

	{#if error}
		<p class="m-0 text-[var(--attention)] text-[var(--text-sm)]" role="alert">{error}</p>
	{/if}

	<div class="flex flex-col gap-2">
		<label
			for="move-date"
			class="font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
		>
			New day
		</label>
		<input
			id="move-date"
			type="date"
			class="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 font-[var(--font-sans)] text-[var(--text)]"
			bind:value={targetDate}
		/>
	</div>

	<div class="flex flex-col gap-2">
		<span
			class="font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
			id="move-slot-label"
		>
			When
		</span>
		<div class="flex flex-wrap gap-1" role="group" aria-labelledby="move-slot-label">
			{#each [...MEAL_SLOTS, null] as s (s ?? 'ANYTIME')}
				<button
					type="button"
					class="nk-btn nk-btn--sm {targetSlot === s ? 'nk-btn--primary' : 'nk-btn--secondary'}"
					aria-pressed={targetSlot === s}
					onclick={() => (targetSlot = s)}
				>
					{mealSlotLabel(s)}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex gap-2">
		<button
			type="button"
			class="nk-btn nk-btn--primary"
			disabled={moving || !targetDate}
			onclick={handleMove}
		>
			{moving ? 'Moving…' : 'Move meal'}
		</button>
		<button type="button" class="nk-btn nk-btn--ghost" disabled={moving} onclick={onClose}>
			Cancel
		</button>
	</div>
</div>
