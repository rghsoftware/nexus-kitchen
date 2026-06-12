<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import RatingControl from '$lib/components/recipes/RatingControl.svelte';
	import ServingScaler from '$lib/components/recipes/ServingScaler.svelte';
	import {
		loadRecipe,
		cachedRecipe,
		setFavorite,
		setRating,
		deleteRecipe
	} from '$lib/recipes/recipesStore.svelte';
	import { signImageUrl } from '$lib/recipes/recipesRepository';
	import { scaleIngredients } from '$lib/recipes/recipeScaling';
	import type { RecipeWithDetail, UserRecipeMeta } from '$lib/recipes/types';
	import { SvelteMap } from 'svelte/reactivity';

	const id = $derived(page.params.id ?? '');

	let recipe = $state<RecipeWithDetail | null>(null);
	let meta = $state<UserRecipeMeta | null>(null);
	let heroSrc = $state<string | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let tab = $state<'ingredients' | 'instructions'>('ingredients');
	let targetServings = $state(1);
	let confirmingDelete = $state(false);
	let deleting = $state(false);

	// Resolve a signed URL for the hero image (private bucket; image_url holds a path).
	$effect(() => {
		const path = recipe?.imageUrl ?? null;
		if (!path) {
			heroSrc = null;
			return;
		}
		let active = true;
		signImageUrl(path).then((url) => {
			if (active) heroSrc = url;
		});
		return () => {
			active = false;
		};
	});

	// Load (and reload when the id changes).
	$effect(() => {
		const recipeId = id;
		let active = true;
		loading = true;
		error = null;
		loadRecipe(recipeId)
			.then((r) => {
				if (!active) return;
				recipe = r;
				meta = r?.meta ?? null;
				targetServings = r?.servings ?? 1;
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

	const scaledIngredients = $derived(
		recipe ? scaleIngredients(recipe.ingredients, recipe.servings, targetServings) : []
	);

	const substitutesByPrimaryId = $derived(
		(() => {
			const map = new SvelteMap<string, string[]>();
			for (const ing of scaledIngredients) {
				if (ing.substituteFor) {
					const existing = map.get(ing.substituteFor) ?? [];
					map.set(ing.substituteFor, [...existing, ing.name]);
				}
			}
			return map;
		})()
	);

	async function toggleFavorite() {
		if (!recipe) return;
		actionError = null;
		const prev = meta;
		meta = { ...(meta ?? blankMeta()), isFavorite: !(meta?.isFavorite ?? false) };
		try {
			await setFavorite(recipe.id, meta.isFavorite);
			meta = cachedRecipe(recipe.id)?.meta ?? meta;
		} catch (e) {
			meta = prev;
			actionError = e instanceof Error ? e.message : 'Could not update favorite.';
		}
	}

	async function changeRating(rating: number | null) {
		if (!recipe) return;
		actionError = null;
		const prev = meta;
		meta = { ...(meta ?? blankMeta()), rating };
		try {
			await setRating(recipe.id, rating);
			meta = cachedRecipe(recipe.id)?.meta ?? meta;
		} catch (e) {
			meta = prev;
			actionError = e instanceof Error ? e.message : 'Could not update rating.';
		}
	}

	function blankMeta(): UserRecipeMeta {
		return {
			id: `local-${id}`,
			userId: '',
			recipeId: id,
			isFavorite: false,
			rating: null,
			timesCooked: 0,
			lastCookedAt: null
		};
	}

	async function confirmDelete() {
		if (!recipe) return;
		deleting = true;
		actionError = null;
		try {
			await deleteRecipe(recipe.id);
			await goto(resolve('/recipes'));
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Could not delete this recipe.';
			deleting = false;
			confirmingDelete = false;
		}
	}
</script>

<svelte:head><title>{recipe ? recipe.title : 'Recipe'} · Nexus Kitchen</title></svelte:head>

<main class="page nk-stack">
	<a class="nk-btn nk-btn--ghost nk-btn--sm back" href={resolve('/recipes')}>← Recipes</a>

	{#if loading}
		<p class="state">Loading…</p>
	{:else if error}
		<p class="state nk-note" role="alert">{error}</p>
	{:else if recipe}
		<article class="nk-stack detail">
			<header class="hero nk-card">
				{#if heroSrc}
					<img class="hero-img" src={heroSrc} alt="" />
				{/if}
				<div class="hero-body nk-stack">
					<div class="title-row">
						<h1>{recipe.title}</h1>
						<div class="hero-actions">
							<button
								type="button"
								class="nk-btn nk-btn--ghost nk-btn--sm"
								aria-pressed={meta?.isFavorite ?? false}
								onclick={toggleFavorite}
							>
								{meta?.isFavorite ? '♥ Favorited' : '♡ Favorite'}
							</button>
							<a
								class="nk-btn nk-btn--secondary nk-btn--sm"
								href={resolve('/recipes/[id]/edit', { id: recipe.id })}>Edit</a
							>
						</div>
					</div>

					{#if recipe.description}<p class="desc">{recipe.description}</p>{/if}

					<div class="facts">
						{#if recipe.totalTimeMinutes > 0}<span class="tabular"
								>{recipe.totalTimeMinutes} min total</span
							>{/if}
						{#if recipe.activeTimeMinutes}<span class="tabular"
								>{recipe.activeTimeMinutes} min hands-on</span
							>{/if}
						<span class="tabular">Serves {recipe.servings}</span>
						{#if recipe.cuisineType}<span>{recipe.cuisineType}</span>{/if}
					</div>

					<div class="rating-row">
						<span class="rating-lbl">Your rating</span>
						<RatingControl rating={meta?.rating ?? null} onChange={changeRating} />
					</div>

					{#if recipe.tags.length > 0}
						<div class="tags">
							{#each recipe.tags as tag (tag.id)}<span class="nk-chip">{tag.name}</span>{/each}
						</div>
					{/if}
				</div>
			</header>

			{#if actionError}<p class="nk-note" role="alert">{actionError}</p>{/if}

			<div class="tabs" role="tablist" aria-label="Recipe details">
				<button
					type="button"
					role="tab"
					id="tab-ingredients"
					aria-controls="panel-ingredients"
					aria-selected={tab === 'ingredients'}
					class="tab"
					class:active={tab === 'ingredients'}
					onclick={() => (tab = 'ingredients')}>Ingredients</button
				>
				<button
					type="button"
					role="tab"
					id="tab-instructions"
					aria-controls="panel-instructions"
					aria-selected={tab === 'instructions'}
					class="tab"
					class:active={tab === 'instructions'}
					onclick={() => (tab = 'instructions')}>Instructions</button
				>
			</div>

			{#if tab === 'ingredients'}
				<div
					class="panel nk-stack"
					role="tabpanel"
					tabindex="0"
					id="panel-ingredients"
					aria-labelledby="tab-ingredients"
				>
					<ServingScaler baseServings={recipe.servings} bind:target={targetServings} />
					<ul class="ingredients">
						{#each scaledIngredients as ing (ing.id)}
							<li>
								<span class="amount tabular">{ing.displayQuantity} {ing.unit}</span>
								<span class="iname">
									{ing.name}{#if ing.preparation}, {ing.preparation}{/if}
									{#if ing.isOptional}<span class="opt">(optional)</span>{/if}
									{#if (substitutesByPrimaryId.get(ing.id) ?? []).length > 0}
										<span class="sub-hint"
											>or: {substitutesByPrimaryId.get(ing.id)!.join(', ')}</span
										>
									{/if}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{:else}
				<div
					class="panel"
					role="tabpanel"
					tabindex="0"
					id="panel-instructions"
					aria-labelledby="tab-instructions"
				>
					<ol class="steps">
						{#each recipe.steps as step (step.id)}
							<li>
								<p>{step.instruction}</p>
								{#if step.timerMinutes}
									<span class="timer tabular"
										>Timer: {step.timerMinutes} min{#if step.timerLabel}
											· {step.timerLabel}{/if}</span
									>
								{/if}
							</li>
						{/each}
					</ol>
				</div>
			{/if}

			{#if recipe.notes}
				<section class="panel notes">
					<p class="nk-eyebrow">Notes</p>
					<p>{recipe.notes}</p>
				</section>
			{/if}

			<footer class="danger">
				{#if confirmingDelete}
					<span>Delete this recipe? This can’t be undone.</span>
					<button
						type="button"
						class="nk-btn nk-btn--secondary nk-btn--sm"
						onclick={() => (confirmingDelete = false)}
						disabled={deleting}>Keep it</button
					>
					<button
						type="button"
						class="nk-btn nk-btn--sm delete-confirm"
						onclick={confirmDelete}
						disabled={deleting}
					>
						{deleting ? 'Deleting…' : 'Delete recipe'}
					</button>
				{:else}
					<button
						type="button"
						class="nk-btn nk-btn--ghost nk-btn--sm delete"
						onclick={() => (confirmingDelete = true)}>Delete recipe</button
					>
				{/if}
			</footer>
		</article>
	{/if}
</main>

<style>
	.page {
		gap: var(--space-5);
		padding: var(--space-6) var(--space-5) var(--space-10);
		max-width: 880px;
		margin: 0 auto;
	}
	.back {
		align-self: flex-start;
	}
	.detail {
		gap: var(--space-5);
	}
	.hero {
		overflow: hidden;
	}
	.hero-img {
		width: 100%;
		max-height: 320px;
		object-fit: cover;
		display: block;
	}
	.hero-body {
		padding: var(--space-5);
		gap: var(--space-3);
	}
	.title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	h1 {
		font-size: var(--text-2xl);
	}
	.hero-actions {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.desc {
		color: var(--text-secondary);
	}
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.rating-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.rating-lbl {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--text-secondary);
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.tabs {
		display: flex;
		gap: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.tab {
		min-height: var(--tap-min);
		padding: 0 var(--space-4);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
		color: var(--text-secondary);
	}
	.tab.active {
		color: var(--text);
		border-bottom-color: var(--primary);
	}
	.tab:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
	}
	.panel {
		gap: var(--space-3);
	}
	.ingredients {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.ingredients li {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border);
	}
	.amount {
		flex: 0 0 110px;
		font-weight: var(--weight-semibold);
	}
	.opt {
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	.steps {
		margin: 0;
		padding-left: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.steps li {
		padding-left: var(--space-2);
	}
	.timer {
		display: inline-block;
		margin-top: var(--space-2);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	.notes p:last-child {
		color: var(--text-secondary);
	}
	.danger {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}
	.delete,
	.delete-confirm {
		color: var(--attention);
	}
	.delete-confirm {
		background: var(--attention-soft);
	}
	.sub-hint {
		display: block;
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-top: var(--space-1);
	}
</style>
