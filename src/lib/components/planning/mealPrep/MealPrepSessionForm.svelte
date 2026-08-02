<script lang="ts">
	import { recipesRepository, type RecipeSummary } from '$lib/recipes';
	import { createSessionAction } from '$lib/planning/mealPrep/mealPrepStore.svelte';
	import { isNotPast, suggestPrepDay } from '$lib/planning/mealPrep/prepDay';
	import type { MealPrepSession, NewMealPrepSession } from '$lib/planning/mealPrep/types';

	interface Props {
		onClose: () => void;
		onCreated?: (session: MealPrepSession) => void;
	}

	let { onClose, onCreated }: Props = $props();

	interface ChosenRecipe {
		recipeId: string;
		recipeName: string;
		servingsToPrep: number;
	}

	let recipes = $state<RecipeSummary[]>([]);
	let recipesLoaded = $state(false);
	let search = $state('');
	// Map of recipeId → chosen recipe (with servings). Order preserved by insertion.
	let chosen = $state<ChosenRecipe[]>([]);

	// Default to the next common prep day; user can change it.
	let prepDay = $state(suggestPrepDay(new Date()));

	let saving = $state(false);
	let loadError = $state<string | null>(null);
	let formError = $state<string | null>(null);
	let showValidation = $state(false);

	$effect(() => {
		if (!recipesLoaded) {
			recipesRepository
				.listRecipes()
				.then((r) => {
					recipes = r;
					recipesLoaded = true;
				})
				.catch(() => {
					loadError = "We couldn't load your recipes. Please try again in a moment.";
				});
		}
	});

	const filteredRecipes = $derived(
		search.trim() === ''
			? recipes
			: recipes.filter((r) => r.title.toLowerCase().includes(search.trim().toLowerCase()))
	);

	const prepDayValid = $derived(isNotPast(prepDay, new Date()));

	function isChosen(recipeId: string): boolean {
		return chosen.some((c) => c.recipeId === recipeId);
	}

	function toggleRecipe(recipe: RecipeSummary) {
		if (isChosen(recipe.id)) {
			chosen = chosen.filter((c) => c.recipeId !== recipe.id);
		} else {
			chosen = [
				...chosen,
				{
					recipeId: recipe.id,
					recipeName: recipe.title,
					servingsToPrep: recipe.servings > 0 ? recipe.servings : 1
				}
			];
		}
	}

	function setServings(recipeId: string, value: number) {
		const next = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
		chosen = chosen.map((c) => (c.recipeId === recipeId ? { ...c, servingsToPrep: next } : c));
	}

	function stepServings(recipeId: string, delta: number) {
		const current = chosen.find((c) => c.recipeId === recipeId);
		if (!current) return;
		setServings(recipeId, current.servingsToPrep + delta);
	}

	const canSubmit = $derived(
		chosen.length >= 1 && chosen.every((c) => c.servingsToPrep >= 1) && prepDayValid && !saving
	);

	async function handleSubmit() {
		showValidation = true;
		formError = null;
		if (chosen.length < 1) return;
		if (!chosen.every((c) => c.servingsToPrep >= 1)) return;
		if (!prepDayValid) return;
		if (saving) return;

		saving = true;
		const draft: NewMealPrepSession = {
			prepDay,
			recipes: chosen.map((c) => ({
				recipeId: c.recipeId,
				recipeName: c.recipeName,
				servingsToPrep: c.servingsToPrep
			}))
		};

		try {
			const created = await createSessionAction(draft);
			onCreated?.(created);
			onClose();
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
		} finally {
			saving = false;
		}
	}
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleSubmit();
	}}
	novalidate
	aria-label="Plan a prep session"
	class="nk-stack"
	style="gap: var(--space-5); padding: var(--space-6); background: var(--surface); border-radius: var(--radius-lg);"
>
	<header
		class="nk-row"
		style="justify-content: space-between; align-items: flex-start; gap: var(--space-2);"
	>
		<div class="nk-stack" style="gap: var(--space-1);">
			<h2
				style="font-family: var(--font-display); font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--text); margin: 0;"
			>
				Plan a prep session
			</h2>
			<p style="margin: 0; font-size: var(--text-sm); color: var(--text-secondary);">
				Pick what you want to batch-cook and how much.
			</p>
		</div>
		<button type="button" class="nk-btn nk-btn--secondary" onclick={onClose} aria-label="Close">
			Close
		</button>
	</header>

	{#if formError}
		<p role="alert" style="margin: 0; color: var(--attention); font-size: var(--text-sm);">
			{formError}
		</p>
	{/if}

	<!-- Recipe multi-select -->
	<div class="nk-stack" style="gap: var(--space-3);">
		<span
			id="prep-recipes-label"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			What are you prepping?
		</span>

		<input
			type="search"
			placeholder="Search recipes…"
			aria-label="Search recipes"
			bind:value={search}
			style="min-height: var(--tap-min); padding: 0 var(--space-4); border: 1.5px solid var(--border-strong); border-radius: var(--radius-pill); background: var(--bg); color: var(--text); font-family: var(--font-sans); font-size: var(--text-base); width: 100%;"
		/>

		{#if loadError}
			<p role="alert" style="margin: 0; color: var(--attention); font-size: var(--text-sm);">
				{loadError}
			</p>
		{:else if !recipesLoaded}
			<p
				aria-live="polite"
				style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);"
			>
				Loading recipes…
			</p>
		{:else if filteredRecipes.length === 0}
			<p style="margin: 0; color: var(--text-secondary); font-size: var(--text-sm);">
				{recipes.length === 0
					? 'No recipes yet — add one from the Recipes tab first.'
					: 'No recipes match that search.'}
			</p>
		{:else}
			<ul
				aria-labelledby="prep-recipes-label"
				class="nk-stack"
				style="list-style: none; margin: 0; padding: 0; gap: var(--space-2); max-height: 16rem; overflow-y: auto;"
			>
				{#each filteredRecipes as recipe (recipe.id)}
					<li>
						<button
							type="button"
							class="nk-card nk-row"
							aria-pressed={isChosen(recipe.id)}
							onclick={() => toggleRecipe(recipe)}
							style="width: 100%; justify-content: space-between; align-items: center; gap: var(--space-2); padding: var(--space-3); text-align: left; cursor: pointer; border: 1.5px solid {isChosen(
								recipe.id
							)
								? 'var(--primary)'
								: 'var(--border)'};"
						>
							<span
								style="font-family: var(--font-sans); font-weight: var(--weight-semibold); color: var(--text); font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
							>
								{recipe.title}
							</span>
							<span
								style="flex-shrink: 0; color: var(--text-secondary); font-size: var(--text-xs);"
							>
								{isChosen(recipe.id) ? 'Added' : 'Add'}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if showValidation && chosen.length < 1}
			<p role="alert" style="margin: 0; color: var(--attention); font-size: var(--text-sm);">
				Pick at least one recipe to prep.
			</p>
		{/if}
	</div>

	<!-- Chosen recipes with servings steppers -->
	{#if chosen.length > 0}
		<div class="nk-stack" style="gap: var(--space-3);">
			<span
				style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
			>
				How many servings of each?
			</span>
			{#each chosen as item (item.recipeId)}
				<div
					class="nk-row"
					style="justify-content: space-between; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--surface-2); border-radius: var(--radius-md);"
				>
					<span
						style="font-family: var(--font-sans); font-weight: var(--weight-semibold); color: var(--text); font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
					>
						{item.recipeName}
					</span>
					<div
						class="nk-row"
						role="group"
						aria-label="Servings to prep for {item.recipeName}"
						style="gap: 0; border: 1.5px solid var(--border-strong); border-radius: var(--radius-pill); overflow: hidden; flex-shrink: 0;"
					>
						<button
							type="button"
							onclick={() => stepServings(item.recipeId, -1)}
							disabled={item.servingsToPrep <= 1}
							aria-label="Decrease servings for {item.recipeName}"
							style="min-width: var(--tap-min); min-height: var(--tap-min); background: var(--surface); border: none; color: var(--text); font-size: var(--text-lg); font-weight: var(--weight-semibold); cursor: pointer; padding: 0 var(--space-3);"
						>
							−
						</button>
						<input
							type="number"
							min="1"
							step="1"
							value={item.servingsToPrep}
							aria-label="Servings for {item.recipeName}"
							oninput={(e) => setServings(item.recipeId, Number(e.currentTarget.value))}
							style="width: 3.5rem; text-align: center; min-height: var(--tap-min); border: none; background: var(--surface); color: var(--text); font-size: var(--text-base); font-family: var(--font-sans); font-variant-numeric: tabular-nums;"
						/>
						<button
							type="button"
							onclick={() => stepServings(item.recipeId, 1)}
							aria-label="Increase servings for {item.recipeName}"
							style="min-width: var(--tap-min); min-height: var(--tap-min); background: var(--surface); border: none; color: var(--text); font-size: var(--text-lg); font-weight: var(--weight-semibold); cursor: pointer; padding: 0 var(--space-3);"
						>
							+
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Prep day -->
	<div class="nk-stack" style="gap: var(--space-2);">
		<label
			for="prep-day"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			When will you prep?
		</label>
		<input
			id="prep-day"
			type="date"
			bind:value={prepDay}
			aria-invalid={!prepDayValid}
			aria-describedby={!prepDayValid ? 'prep-day-error' : undefined}
			style="min-height: var(--tap-min); padding: 0 var(--space-4); border: 1.5px solid {prepDayValid
				? 'var(--border-strong)'
				: 'var(--attention)'}; border-radius: var(--radius-pill); background: var(--bg); color: var(--text); font-family: var(--font-sans); font-size: var(--text-base); width: 100%;"
		/>
		{#if !prepDayValid}
			<p
				id="prep-day-error"
				role="alert"
				style="margin: 0; color: var(--attention); font-size: var(--text-sm);"
			>
				Pick today or a day in the future.
			</p>
		{/if}
	</div>

	<!-- Actions -->
	<div class="nk-row" style="gap: var(--space-3); margin-top: var(--space-2);">
		<button
			type="submit"
			class="nk-btn nk-btn--primary"
			disabled={!canSubmit}
			aria-busy={saving}
			style="flex: 1;"
		>
			{saving ? 'Saving…' : 'Plan this session'}
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
</form>
