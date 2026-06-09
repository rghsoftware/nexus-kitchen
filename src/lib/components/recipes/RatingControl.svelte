<script lang="ts">
	// A calm 1–5 rating (INV-RC-009). A rating is a verdict on the food, not the person — so the
	// scale is quiet and always reversible (tap the current value again to clear it).
	let {
		rating = null,
		readonly = false,
		onChange
	}: {
		rating?: number | null;
		readonly?: boolean;
		onChange?: (rating: number | null) => void;
	} = $props();

	const VALUES = [1, 2, 3, 4, 5];

	function select(value: number) {
		if (readonly) return;
		// Tapping the current rating clears it.
		onChange?.(rating === value ? null : value);
	}
</script>

<div class="rating" role="group" aria-label="Rating out of 5">
	{#each VALUES as value (value)}
		<button
			type="button"
			class="star"
			class:filled={rating != null && value <= rating}
			disabled={readonly}
			aria-pressed={rating === value}
			aria-label="{value} out of 5"
			onclick={() => select(value)}
		>
			<span aria-hidden="true">{rating != null && value <= rating ? '★' : '☆'}</span>
		</button>
	{/each}
	{#if rating != null}
		<span class="value tabular">{rating}/5</span>
	{/if}
</div>

<style>
	.rating {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
	}
	.star {
		display: grid;
		place-items: center;
		min-width: var(--tap-min);
		min-height: var(--tap-min);
		padding: 0;
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		color: var(--text-muted);
		font-size: var(--text-xl);
		line-height: 1;
		transition:
			color var(--transition),
			transform var(--transition);
	}
	.star:not(:disabled):active {
		transform: translateY(1px) scale(0.96);
	}
	.star:disabled {
		cursor: default;
	}
	.star.filled {
		color: var(--secondary);
	}
	.star:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
	}
	.value {
		margin-left: var(--space-2);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--text-secondary);
	}
</style>
