<script lang="ts">
	import { resolve } from '$app/paths';
	import RecipeCard from '$lib/components/recipes/RecipeCard.svelte';
	import RecipeFilters, { type LibraryFilter } from '$lib/components/recipes/RecipeFilters.svelte';
	import { recipesState, loadLibrary } from '$lib/recipes/recipesStore.svelte';

	let search = $state('');
	let mode = $state<LibraryFilter>('all');
	let activeTags = $state<string[]>([]);

	$effect(() => {
		void loadLibrary();
	});

	const availableTags = $derived(
		Array.from(new Set(recipesState.library.flatMap((r) => r.tags.map((t) => t.name)))).sort()
	);

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return recipesState.library.filter((r) => {
			if (mode === 'favorites' && !r.meta?.isFavorite) return false;
			if (mode === 'quick' && !(r.totalTimeMinutes > 0 && r.totalTimeMinutes <= 30)) return false;
			if (activeTags.length > 0) {
				const names = r.tags.map((t) => t.name);
				if (!activeTags.every((t) => names.includes(t))) return false;
			}
			if (q) {
				const haystack =
					`${r.title} ${r.cuisineType ?? ''} ${r.tags.map((t) => t.name).join(' ')}`.toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			return true;
		});
	});
</script>

<svelte:head><title>Recipes · Nexus Kitchen</title></svelte:head>

<main class="page nk-stack">
	<header class="head">
		<div>
			<p class="nk-eyebrow">Your kitchen</p>
			<h1>Recipes</h1>
		</div>
		<a class="nk-btn nk-btn--primary" href={resolve('/recipes/new')}>+ Add recipe</a>
	</header>

	<div class="search">
		<input
			type="search"
			bind:value={search}
			placeholder="Search by name, cuisine, or tag…"
			aria-label="Search recipes"
		/>
	</div>

	<RecipeFilters bind:mode bind:activeTags {availableTags} />

	{#if recipesState.loading && recipesState.library.length === 0}
		<p class="state">Loading your recipes…</p>
	{:else if recipesState.error}
		<p class="state nk-note" role="alert">{recipesState.error}</p>
	{:else if recipesState.library.length === 0}
		<div class="empty nk-card">
			<h2>No recipes yet</h2>
			<p>Add your first recipe whenever you’re ready — there’s no rush.</p>
			<a class="nk-btn nk-btn--primary nk-btn--lg" href={resolve('/recipes/new')}
				>+ Add your first recipe</a
			>
		</div>
	{:else if filtered.length === 0}
		<p class="state">No recipes match that. Try clearing a filter or your search.</p>
	{:else}
		<ul class="grid" aria-label="Recipes">
			{#each filtered as recipe (recipe.id)}
				<li><RecipeCard {recipe} /></li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.page {
		gap: var(--space-5);
		padding: var(--space-6) var(--space-5) var(--space-10);
		max-width: var(--container);
		margin: 0 auto;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	h1 {
		font-size: var(--text-3xl);
	}
	.search input {
		width: 100%;
		min-height: var(--tap-min);
		padding: 0 var(--space-4);
		font-size: var(--text-base);
		font-family: var(--font-sans);
		color: var(--text);
		background: var(--surface);
		border: 1.5px solid var(--border);
		border-radius: var(--radius-pill);
	}
	.search input:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--primary);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--space-4);
	}
	.state {
		color: var(--text-secondary);
		padding: var(--space-4) 0;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		text-align: center;
		padding: var(--space-9) var(--space-5);
	}
	.empty h2 {
		font-size: var(--text-xl);
	}
	.empty p {
		color: var(--text-secondary);
		max-width: 42ch;
	}
</style>
