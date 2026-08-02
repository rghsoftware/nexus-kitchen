<script lang="ts">
	import { completeSessionAction } from '$lib/planning/mealPrep/mealPrepStore.svelte';
	import type { MealPrepSession, YieldChoice } from '$lib/planning/mealPrep/types';
	import type { StorageLocation } from '$lib/pantry/types';

	interface Props {
		session: MealPrepSession;
		onClose: () => void;
		onCompleted?: () => void;
	}

	let { session, onClose, onCompleted }: Props = $props();

	// Per-recipe storage choice, keyed by sessionRecipeId. Default everything to FRIDGE.
	// Seeded once from the initial session prop; the dialog unmounts per session.
	// svelte-ignore state_referenced_locally
	let choices = $state<Record<string, StorageLocation>>(
		Object.fromEntries(session.recipes.map((r) => [r.id, 'FRIDGE' as StorageLocation]))
	);

	let saving = $state(false);
	let errorMsg = $state<string | null>(null);

	function setAll(location: StorageLocation) {
		choices = Object.fromEntries(session.recipes.map((r) => [r.id, location]));
	}

	function setOne(sessionRecipeId: string, location: StorageLocation) {
		choices = { ...choices, [sessionRecipeId]: location };
	}

	async function handleConfirm() {
		if (saving) return;
		saving = true;
		errorMsg = null;

		const yields: YieldChoice[] = session.recipes.map((r) => ({
			sessionRecipeId: r.id,
			storageLocation: choices[r.id] ?? 'FRIDGE'
		}));

		try {
			await completeSessionAction(session.id, yields);
			onCompleted?.();
			onClose();
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
		} finally {
			saving = false;
		}
	}

	const TOGGLE: { value: StorageLocation; label: string }[] = [
		{ value: 'FRIDGE', label: 'Fridge' },
		{ value: 'FREEZER', label: 'Freezer' }
	];
</script>

<div
	class="nk-stack"
	style="gap: var(--space-5); padding: var(--space-6);"
	aria-label="Mark prep session as prepped"
>
	<div class="nk-stack" style="gap: var(--space-1);">
		<h2
			style="font-family: var(--font-display); font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--text); margin: 0;"
		>
			Mark as prepped
		</h2>
		<p style="margin: 0; font-size: var(--text-sm); color: var(--text-secondary);">
			Tell us where each batch is going so we can track it.
		</p>
	</div>

	<!-- Session-level quick default -->
	<div class="nk-stack" style="gap: var(--space-2);">
		<span
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			Set all to
		</span>
		<div class="nk-row" style="gap: var(--space-2);">
			<button
				type="button"
				class="nk-btn nk-btn--secondary"
				onclick={() => setAll('FRIDGE')}
				disabled={saving}
			>
				All fridge
			</button>
			<button
				type="button"
				class="nk-btn nk-btn--secondary"
				onclick={() => setAll('FREEZER')}
				disabled={saving}
			>
				All freezer
			</button>
		</div>
	</div>

	<hr style="border: none; border-top: 1px solid var(--border); margin: 0;" />

	<!-- Per-recipe storage toggles -->
	<ul class="nk-stack" style="list-style: none; margin: 0; padding: 0; gap: var(--space-3);">
		{#each session.recipes as recipe (recipe.id)}
			<li class="nk-stack" style="gap: var(--space-2);">
				<span
					style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text);"
				>
					{recipe.recipeName}
				</span>
				<div
					role="radiogroup"
					aria-label="Where to store {recipe.recipeName}"
					class="nk-row"
					style="gap: var(--space-2);"
				>
					{#each TOGGLE as option (option.value)}
						{@const active = (choices[recipe.id] ?? 'FRIDGE') === option.value}
						<button
							type="button"
							role="radio"
							aria-checked={active}
							onclick={() => setOne(recipe.id, option.value)}
							disabled={saving}
							style="min-height: var(--tap-min); padding: 0 var(--space-5); border-radius: var(--radius-pill); border: 1.5px solid {active
								? 'var(--primary)'
								: 'var(--border-strong)'}; background: {active
								? 'var(--primary-soft)'
								: 'var(--surface)'}; color: {active
								? 'var(--primary-text)'
								: 'var(--text-secondary)'}; font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); cursor: pointer;"
						>
							{option.label}
						</button>
					{/each}
				</div>
			</li>
		{/each}
	</ul>

	{#if errorMsg}
		<p
			role="alert"
			style="margin: 0; font-size: var(--text-sm); color: var(--attention); padding: var(--space-3); border-radius: var(--radius-sm); background: var(--attention-soft);"
		>
			{errorMsg}
		</p>
	{/if}

	<hr style="border: none; border-top: 1px solid var(--border); margin: 0;" />

	<div class="nk-row" style="gap: var(--space-3);">
		<button
			type="button"
			class="nk-btn nk-btn--primary"
			onclick={handleConfirm}
			disabled={saving}
			aria-busy={saving}
			style="flex: 1;"
		>
			{saving ? 'Saving…' : 'Mark as prepped'}
		</button>
		<button
			type="button"
			class="nk-btn nk-btn--secondary"
			onclick={onClose}
			disabled={saving}
			style="flex: 1;"
		>
			Cancel
		</button>
	</div>
</div>
