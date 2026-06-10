<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		MEAL_SLOTS,
		dayFullLabel,
		mealSlotLabel,
		plannedMealName,
		removeMeal,
		updateMeal,
		type PlannedMeal,
		type PlannedMealPatch
	} from '$lib/planning';

	interface Props {
		meal: PlannedMeal;
		onClose: () => void;
		/** Hands off to the tap-based MoveMealSheet (FR-PL-013). */
		onMove: (meal: PlannedMeal) => void;
	}

	let { meal, onClose, onMove }: Props = $props();

	// The sheet unmounts on close, so capturing the meal's initial values is intentional.
	// svelte-ignore state_referenced_locally
	let servings = $state(meal.servings);
	// svelte-ignore state_referenced_locally
	let chosenSlot = $state(meal.mealSlot);
	// svelte-ignore state_referenced_locally
	let storeBoughtName = $state(meal.storeBoughtName ?? '');
	// svelte-ignore state_referenced_locally
	let quickName = $state(meal.quickMealName ?? '');
	let saving = $state(false);
	let confirmingRemove = $state(false);
	let error = $state<string | null>(null);

	const name = $derived(plannedMealName(meal));

	function buildPatch(): PlannedMealPatch {
		const patch: PlannedMealPatch = {};
		if (servings !== meal.servings && servings > 0) patch.servings = servings;
		if (chosenSlot !== meal.mealSlot) patch.mealSlot = chosenSlot;
		if (meal.source === 'STORE_BOUGHT' && storeBoughtName.trim() !== meal.storeBoughtName) {
			if (storeBoughtName.trim() !== '') patch.storeBoughtName = storeBoughtName.trim();
		}
		if (meal.source === 'QUICK' && quickName.trim() !== meal.quickMealName) {
			if (quickName.trim() !== '') patch.quickMealName = quickName.trim();
		}
		return patch;
	}

	async function save() {
		const patch = buildPatch();
		if (Object.keys(patch).length === 0) {
			onClose();
			return;
		}
		saving = true;
		error = null;
		const updated = await updateMeal(meal.id, patch);
		saving = false;
		if (updated) onClose();
		else error = "We couldn't save those changes. Please try again.";
	}

	/** Single lightweight confirm, then remove (FR-PL-014). */
	async function handleRemove() {
		if (!confirmingRemove) {
			confirmingRemove = true;
			return;
		}
		saving = true;
		const ok = await removeMeal(meal.id);
		saving = false;
		if (ok) onClose();
		else {
			confirmingRemove = false;
			error = "We couldn't remove that meal. Please try again.";
		}
	}
</script>

<!-- MealDetailSheet — edit servings/slot/source details, move, or remove (FR-PL-012/014). -->
<div
	class="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-[var(--surface)] p-6"
	style="box-shadow: var(--shadow-lg, var(--shadow-md));"
>
	<header class="flex items-start justify-between gap-2">
		<div class="min-w-0">
			<h2
				class="m-0 truncate font-[var(--font-display)] font-[var(--weight-bold)] text-[var(--text)] text-[var(--text-xl)]"
			>
				{name}
			</h2>
			<p class="m-0 text-[var(--text-secondary)] text-[var(--text-sm)]">
				{dayFullLabel(meal.date)} · {mealSlotLabel(meal.mealSlot)}
			</p>
		</div>
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

	{#if meal.source === 'RECIPE' && meal.recipeId}
		<a
			class="text-[var(--primary)] text-[var(--text-sm)] underline"
			href={resolve('/recipes/[id]', { id: meal.recipeId })}
		>
			View recipe
		</a>
	{/if}

	{#if meal.source === 'STORE_BOUGHT'}
		<div class="flex flex-col gap-2">
			<label
				for="detail-store-bought"
				class="font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
			>
				Store-bought meal
			</label>
			<input
				id="detail-store-bought"
				type="text"
				maxlength="200"
				class="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 font-[var(--font-sans)] text-[var(--text)]"
				bind:value={storeBoughtName}
			/>
		</div>
	{:else if meal.source === 'QUICK'}
		<div class="flex flex-col gap-2">
			<label
				for="detail-quick"
				class="font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
			>
				Quick meal
			</label>
			<input
				id="detail-quick"
				type="text"
				maxlength="200"
				class="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 font-[var(--font-sans)] text-[var(--text)]"
				bind:value={quickName}
			/>
		</div>
	{/if}

	<div class="flex items-center gap-2">
		<label
			for="detail-servings"
			class="font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
		>
			Servings
		</label>
		<input
			id="detail-servings"
			type="number"
			min="1"
			step="1"
			class="w-20 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 font-[var(--font-sans)] text-[var(--text)]"
			bind:value={servings}
		/>
	</div>

	<div class="flex flex-col gap-2">
		<span
			class="font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
			id="detail-slot-label"
		>
			When
		</span>
		<div class="flex flex-wrap gap-1" role="group" aria-labelledby="detail-slot-label">
			{#each [...MEAL_SLOTS, null] as s (s ?? 'ANYTIME')}
				<button
					type="button"
					class="nk-btn nk-btn--sm {chosenSlot === s ? 'nk-btn--primary' : 'nk-btn--secondary'}"
					aria-pressed={chosenSlot === s}
					onclick={() => (chosenSlot = s)}
				>
					{mealSlotLabel(s)}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<button type="button" class="nk-btn nk-btn--primary" disabled={saving} onclick={save}>
			{saving ? 'Saving…' : 'Save'}
		</button>
		<button
			type="button"
			class="nk-btn nk-btn--secondary"
			disabled={saving}
			onclick={() => onMove(meal)}
		>
			Move
		</button>
		<span class="flex-1"></span>
		<button
			type="button"
			class="nk-btn nk-btn--ghost text-[var(--attention)]"
			disabled={saving}
			onclick={handleRemove}
		>
			{confirmingRemove ? 'Really remove?' : 'Remove'}
		</button>
	</div>
</div>
