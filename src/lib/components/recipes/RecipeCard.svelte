<script lang="ts">
	import { resolve } from '$app/paths';
	import type { RecipeSummary } from '$lib/recipes/types';

	let { recipe }: { recipe: RecipeSummary } = $props();

	// Assign a calm tile hue for visual variety (no judgment) from the id — stable per recipe.
	const tileHue = $derived(
		(recipe.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 5) + 1
	);
	const isFavorite = $derived(recipe.meta?.isFavorite ?? false);
	const rating = $derived(recipe.meta?.rating ?? null);
	const totalTime = $derived(recipe.totalTimeMinutes);
	// Food-tile glyph: the recipe's initial (no emoji — design system §6). Phosphor icons come later.
	const initial = $derived(recipe.title.trim().charAt(0).toUpperCase() || '·');
</script>

<a
	class="card nk-card"
	href={resolve('/recipes/[id]', { id: recipe.id })}
	aria-label={recipe.title}
>
	<div class="media">
		{#if recipe.imageUrl}
			<img src={recipe.imageUrl} alt="" loading="lazy" />
		{:else}
			<div
				class="nk-tile"
				style="background: var(--tile-{tileHue}-soft); color: var(--tile-{tileHue});"
				aria-hidden="true"
			>
				<span class="glyph">{initial}</span>
			</div>
		{/if}
		{#if isFavorite}
			<span class="fav" aria-label="Favorite">♥</span>
		{/if}
	</div>

	<div class="body">
		<h3 class="title">{recipe.title}</h3>
		<div class="meta">
			{#if totalTime > 0}
				<span class="tabular">{totalTime} min</span>
			{/if}
			{#if rating != null}
				<span class="rating" aria-label="{rating} out of 5">★ {rating}</span>
			{/if}
		</div>
	</div>
</a>

<style>
	.card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
		transition:
			transform var(--transition),
			box-shadow var(--transition);
	}
	.card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}
	.card:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.media {
		position: relative;
		aspect-ratio: 4 / 3;
	}
	.media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.media :global(.nk-tile) {
		width: 100%;
		height: 100%;
		aspect-ratio: auto;
		border: none;
		border-radius: 0;
	}
	.glyph {
		font-family: var(--font-display);
		font-weight: var(--weight-bold);
		font-size: var(--text-4xl);
	}
	.fav {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: var(--secondary);
		box-shadow: var(--shadow-sm);
		font-size: var(--text-sm);
	}
	.body {
		padding: var(--space-3) var(--space-4) var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.title {
		font-size: var(--text-md);
		font-weight: var(--weight-semibold);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.rating {
		color: var(--secondary-text);
	}
</style>
