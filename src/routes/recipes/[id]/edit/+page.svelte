<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import RecipeForm from '$lib/components/recipes/RecipeForm.svelte';
	import { loadRecipe, updateRecipe } from '$lib/recipes/recipesStore.svelte';
	import type { RecipeInput, RecipeWithDetail } from '$lib/recipes/types';

	const id = $derived(page.params.id ?? '');

	let recipe = $state<RecipeWithDetail | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		const recipeId = id;
		let active = true;
		loading = true;
		error = null;
		loadRecipe(recipeId)
			.then((r) => {
				if (!active) return;
				recipe = r;
				if (!r) error = 'That recipe could not be found.';
			})
			.catch((e) => {
				if (!active) return;
				error = e instanceof Error ? e.message : 'Could not load this recipe.';
			})
			.finally(() => {
				if (active) loading = false;
			});
		return () => {
			active = false;
		};
	});

	async function handleSubmit(input: RecipeInput, imageFile: File | null) {
		await updateRecipe(id, input, imageFile);
		await goto(resolve('/recipes/[id]', { id }));
	}
</script>

<svelte:head><title>Edit {recipe ? recipe.title : 'recipe'} · Nexus Kitchen</title></svelte:head>

<main class="page nk-stack">
	<header class="head">
		<a class="nk-btn nk-btn--ghost nk-btn--sm" href={resolve('/recipes/[id]', { id })}>← Back</a>
		<h1>Edit recipe</h1>
	</header>

	{#if loading}
		<p class="state">Loading…</p>
	{:else if error}
		<p class="state nk-note" role="alert">{error}</p>
	{:else if recipe}
		{#key recipe.id}
			<RecipeForm initial={recipe} submitLabel="Save changes" onSubmit={handleSubmit} />
		{/key}
	{/if}
</main>

<style>
	.page {
		gap: var(--space-6);
		padding: var(--space-6) var(--space-5) var(--space-10);
		max-width: var(--container);
		margin: 0 auto;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		align-items: flex-start;
	}
	h1 {
		font-size: var(--text-2xl);
	}
	.state {
		color: var(--text-secondary);
		padding: var(--space-4) 0;
	}
</style>
