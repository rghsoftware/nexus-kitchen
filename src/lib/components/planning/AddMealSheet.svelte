<script lang="ts">
	import {
		MEAL_SLOTS,
		addMeal,
		dayFullLabel,
		mealSlotLabel,
		type ISODate,
		type MealSlot,
		type PlannedMealDraft
	} from '$lib/planning';
	import { recipesRepository, type RecipeSummary } from '$lib/recipes';

	interface Props {
		date: ISODate;
		/** Pre-filled slot from the tapped band; null = "Anytime" (FR-PL-005). */
		slot: MealSlot | null;
		onClose: () => void;
	}

	let { date, slot, onClose }: Props = $props();

	type SourceTab = 'RECIPE' | 'STORE_BOUGHT' | 'QUICK';
	let tab = $state<SourceTab>('RECIPE');
	// The sheet unmounts on close, so capturing the initial slot is intentional.
	// svelte-ignore state_referenced_locally
	let chosenSlot = $state<MealSlot | null>(slot);
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Recipe tab (FR-PL-006)
	let recipes = $state<RecipeSummary[]>([]);
	let recipesLoaded = $state(false);
	let search = $state('');
	let selectedRecipe = $state<RecipeSummary | null>(null);
	let servings = $state(1);

	// Store-bought / quick tabs (FR-PL-007/008)
	let storeBoughtName = $state('');
	let quickName = $state('');
	const QUICK_OPTIONS = ['Takeout', 'Leftovers'];

	$effect(() => {
		if (tab === 'RECIPE' && !recipesLoaded) {
			recipesRepository
				.listRecipes()
				.then((r) => {
					recipes = r;
					recipesLoaded = true;
				})
				.catch(() => {
					error = "We couldn't load your recipes. You can still add a store-bought or quick meal.";
				});
		}
	});

	const filteredRecipes = $derived(
		search.trim() === ''
			? recipes
			: recipes.filter((r) => r.title.toLowerCase().includes(search.trim().toLowerCase()))
	);

	function pickRecipe(recipe: RecipeSummary) {
		selectedRecipe = recipe;
		servings = recipe.servings; // default from the recipe (FR-PL-006)
	}

	async function save(draft: PlannedMealDraft) {
		saving = true;
		error = null;
		const created = await addMeal(draft, { date, mealSlot: chosenSlot });
		saving = false;
		if (created) {
			onClose();
		} else {
			error = "We couldn't add that meal. Please try again.";
		}
	}

	function saveRecipe() {
		if (!selectedRecipe) return;
		void save({
			source: 'RECIPE',
			recipeId: selectedRecipe.id,
			recipeTitle: selectedRecipe.title,
			servings: servings > 0 ? servings : 1
		});
	}

	function saveStoreBought() {
		const name = storeBoughtName.trim();
		if (name === '') return;
		void save({ source: 'STORE_BOUGHT', storeBoughtName: name, servings: 1 });
	}

	/** One-tap quick path: tap option → saved (FR-PL-021). */
	function saveQuick(name: string) {
		const trimmed = name.trim();
		if (trimmed === '') return;
		void save({ source: 'QUICK', quickMealName: trimmed, servings: 1 });
	}

	const tabs: { id: SourceTab; label: string }[] = [
		{ id: 'RECIPE', label: 'Recipe' },
		{ id: 'STORE_BOUGHT', label: 'Store-bought' },
		{ id: 'QUICK', label: 'Quick' }
	];
</script>

<!--
	AddMealSheet — place a meal on (date, slot). Three sources: a recipe to cook, a
	store-bought meal to buy (REQ-MP-011), or a pressure-free quick option
	(FR-PL-005..008). Slots are bands, never limits; "Anytime" leaves it unslotted.
-->
<div
	class="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-[var(--surface)] p-6"
	style="box-shadow: var(--shadow-lg, var(--shadow-md));"
>
	<header class="flex items-start justify-between gap-2">
		<div>
			<h2
				class="m-0 font-[var(--font-display)] [font-weight:var(--weight-bold)] text-[var(--text)] text-[var(--text-xl)]"
			>
				Add a meal
			</h2>
			<p class="m-0 text-[var(--text-secondary)] text-[var(--text-sm)]">
				{dayFullLabel(date)}
			</p>
		</div>
		<button
			type="button"
			class="nk-btn nk-btn--ghost nk-btn--sm"
			aria-label="Close"
			onclick={onClose}
		>
			<i class="ph ph-x" aria-hidden="true"></i>
		</button>
	</header>

	{#if error}
		<p class="m-0 text-[var(--attention)] text-[var(--text-sm)]" role="alert">{error}</p>
	{/if}

	<!-- Slot picker (band pre-filled from the tapped band, FR-PL-005) -->
	<div class="flex flex-col gap-2">
		<span
			class="font-[var(--font-sans)] [font-weight:var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
			id="add-slot-label"
		>
			When
		</span>
		<div class="flex flex-wrap gap-1" role="group" aria-labelledby="add-slot-label">
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

	<!-- Source tabs -->
	<div class="flex gap-1 border-b border-[var(--border)]" role="tablist" aria-label="Meal source">
		{#each tabs as t (t.id)}
			<button
				type="button"
				role="tab"
				aria-selected={tab === t.id}
				class="cursor-pointer rounded-t-[var(--radius-sm)] border-0 bg-transparent px-3 py-2 font-[var(--font-sans)] text-[var(--text-sm)] {tab ===
				t.id
					? 'border-b-2 border-[var(--primary)] [font-weight:var(--weight-semibold)] text-[var(--primary)]'
					: 'text-[var(--text-secondary)]'}"
				onclick={() => (tab = t.id)}
			>
				{t.label}
			</button>
		{/each}
	</div>

	{#if tab === 'RECIPE'}
		<div class="flex flex-col gap-3" role="tabpanel" aria-label="Recipe">
			<input
				type="search"
				class="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 font-[var(--font-sans)] text-[var(--text)] text-[var(--text-base)]"
				placeholder="Search recipes…"
				aria-label="Search recipes"
				bind:value={search}
			/>

			{#if !recipesLoaded}
				<p class="m-0 text-[var(--text-secondary)] text-[var(--text-sm)]" aria-live="polite">
					Loading recipes…
				</p>
			{:else if filteredRecipes.length === 0}
				<p class="m-0 text-[var(--text-secondary)] text-[var(--text-sm)]">
					{recipes.length === 0
						? 'No recipes yet — add one from the Recipes tab, or plan a store-bought or quick meal.'
						: 'No recipes match that search.'}
				</p>
			{:else}
				<ul class="m-0 flex max-h-64 list-none flex-col gap-1 overflow-y-auto p-0">
					{#each filteredRecipes as recipe (recipe.id)}
						<li>
							<button
								type="button"
								class="nk-card flex w-full cursor-pointer items-center justify-between gap-2 p-2.5 text-left {selectedRecipe?.id ===
								recipe.id
									? 'outline-2 outline-[var(--primary)]'
									: ''}"
								aria-pressed={selectedRecipe?.id === recipe.id}
								onclick={() => pickRecipe(recipe)}
							>
								<span
									class="truncate font-[var(--font-sans)] [font-weight:var(--weight-semibold)] text-[var(--text)] text-[var(--text-sm)]"
								>
									{recipe.title}
								</span>
								<span class="shrink-0 text-[var(--text-secondary)] text-[var(--text-xs)]">
									{recipe.servings} serving{recipe.servings === 1 ? '' : 's'}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if selectedRecipe}
				<div class="flex items-center gap-2">
					<label
						for="add-servings"
						class="font-[var(--font-sans)] [font-weight:var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
					>
						Servings
					</label>
					<input
						id="add-servings"
						type="number"
						min="1"
						step="1"
						class="w-20 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 font-[var(--font-sans)] text-[var(--text)]"
						bind:value={servings}
					/>
				</div>
			{/if}

			<button
				type="button"
				class="nk-btn nk-btn--primary"
				disabled={!selectedRecipe || saving}
				onclick={saveRecipe}
			>
				{saving ? 'Adding…' : 'Add to plan'}
			</button>
		</div>
	{:else if tab === 'STORE_BOUGHT'}
		<div class="flex flex-col gap-3" role="tabpanel" aria-label="Store-bought">
			<form
				class="flex flex-col gap-3"
				onsubmit={(e) => {
					e.preventDefault();
					saveStoreBought();
				}}
			>
				<label
					for="add-store-bought"
					class="font-[var(--font-sans)] [font-weight:var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
				>
					What will you buy?
				</label>
				<input
					id="add-store-bought"
					type="text"
					maxlength="200"
					class="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 font-[var(--font-sans)] text-[var(--text)] text-[var(--text-base)]"
					placeholder="e.g. Frozen lasagna"
					bind:value={storeBoughtName}
				/>
				<button
					type="submit"
					class="nk-btn nk-btn--primary"
					disabled={storeBoughtName.trim() === '' || saving}
				>
					{saving ? 'Adding…' : 'Add to plan'}
				</button>
			</form>
		</div>
	{:else}
		<div class="flex flex-col gap-3" role="tabpanel" aria-label="Quick">
			<div class="flex flex-wrap gap-2">
				{#each QUICK_OPTIONS as option (option)}
					<button
						type="button"
						class="nk-btn nk-btn--secondary"
						disabled={saving}
						onclick={() => saveQuick(option)}
					>
						{option}
					</button>
				{/each}
			</div>
			<form
				class="flex gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					saveQuick(quickName);
				}}
			>
				<input
					type="text"
					maxlength="200"
					class="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 font-[var(--font-sans)] text-[var(--text)] text-[var(--text-base)]"
					placeholder="Or type your own…"
					aria-label="Custom quick meal"
					bind:value={quickName}
				/>
				<button
					type="submit"
					class="nk-btn nk-btn--primary"
					disabled={quickName.trim() === '' || saving}
				>
					Add
				</button>
			</form>
		</div>
	{/if}
</div>
