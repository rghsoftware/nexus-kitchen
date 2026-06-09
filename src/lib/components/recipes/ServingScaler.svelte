<script lang="ts">
	// Display-only serving control. Emits the chosen target serving count; the parent rescales
	// displayed quantities (recipeScaling). Never mutates the stored recipe (FR-016, SC-006).
	let {
		baseServings,
		target = $bindable()
	}: {
		baseServings: number;
		target: number;
	} = $props();

	function step(delta: number) {
		const next = target + delta;
		if (next >= 1 && next <= 100) target = next;
	}

	function reset() {
		target = baseServings;
	}
</script>

<div class="scaler nk-row" role="group" aria-label="Servings">
	<span class="lbl">Servings</span>
	<button
		type="button"
		class="nk-btn nk-btn--ghost nk-btn--sm"
		onclick={() => step(-1)}
		disabled={target <= 1}
		aria-label="Fewer servings">−</button
	>
	<span class="count tabular" aria-live="polite">{target}</span>
	<button
		type="button"
		class="nk-btn nk-btn--ghost nk-btn--sm"
		onclick={() => step(1)}
		disabled={target >= 100}
		aria-label="More servings">+</button
	>
	{#if target !== baseServings}
		<button type="button" class="nk-btn nk-btn--ghost nk-btn--sm reset" onclick={reset}>
			Reset to {baseServings}
		</button>
	{/if}
</div>

<style>
	.scaler {
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.lbl {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--text-secondary);
	}
	.count {
		min-width: 2ch;
		text-align: center;
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
	}
	.reset {
		color: var(--primary-text);
	}
</style>
