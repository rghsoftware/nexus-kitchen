<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import RecipeForm from '$lib/components/recipes/RecipeForm.svelte';
	import { createRecipe } from '$lib/recipes/recipesStore.svelte';
	import type { RecipeInput } from '$lib/recipes/types';

	async function handleSubmit(input: RecipeInput, imageFile: File | null) {
		const created = await createRecipe(input, imageFile);
		await goto(resolve('/recipes/[id]', { id: created.id }));
	}
</script>

<svelte:head><title>New recipe · Nexus Kitchen</title></svelte:head>

<main class="page nk-stack">
	<header class="head">
		<a class="nk-btn nk-btn--ghost nk-btn--sm" href={resolve('/recipes')}>← Recipes</a>
		<h1>Add a recipe</h1>
		<p class="sub">No rush — you can tweak any of this later.</p>
	</header>

	<RecipeForm submitLabel="Save recipe" onSubmit={handleSubmit} />
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
	.sub {
		color: var(--text-secondary);
	}
</style>
