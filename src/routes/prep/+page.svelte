<script lang="ts">
	import MealPrepOverview from '$lib/components/planning/mealPrep/MealPrepOverview.svelte';
	import MealPrepSessionForm from '$lib/components/planning/mealPrep/MealPrepSessionForm.svelte';
	import {
		buildPrepShoppingListAction,
		loadSessions
	} from '$lib/planning/mealPrep/mealPrepStore.svelte';
	import type { MealPrepSession } from '$lib/planning/mealPrep/types';

	let showSessionForm = $state(false);
	let buildNotice = $state<string | null>(null);

	$effect(() => {
		void loadSessions();
	});

	function closeSessionForm() {
		showSessionForm = false;
		void loadSessions();
	}

	async function handleBuildShoppingList(session: MealPrepSession) {
		buildNotice = null;
		const { itemCount } = await buildPrepShoppingListAction(session.id);
		buildNotice =
			itemCount > 0
				? `Added ${itemCount} item${itemCount === 1 ? '' : 's'} to a prep shopping list.`
				: 'Everything for this session is already in your pantry.';
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && showSessionForm) closeSessionForm();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head><title>Meal prep — Nexus Kitchen</title></svelte:head>

<!-- inert: the form seeds its recipe list once on mount, so the page behind it
     must not stay interactive (matches the shopping sheets). -->
<section class="mx-auto flex w-full max-w-3xl flex-col gap-4 p-5" inert={showSessionForm}>
	<header class="flex items-center gap-3">
		<h1
			class="m-0 font-[var(--font-display)] [font-weight:var(--weight-bold)] text-[var(--text)] text-[var(--text-2xl)]"
		>
			Meal prep
		</h1>
	</header>

	{#if buildNotice}
		<p class="nk-card text-[var(--text-secondary)] text-[var(--text-sm)]" role="status">
			{buildNotice}
		</p>
	{/if}

	<MealPrepOverview
		onNewSession={() => (showSessionForm = true)}
		onBuildShoppingList={handleBuildShoppingList}
	/>
</section>

{#if showSessionForm}
	<div class="sheet-overlay" role="dialog" aria-modal="true" aria-label="Start a meal prep session">
		<div class="sheet-overlay__panel">
			<MealPrepSessionForm onClose={closeSessionForm} onCreated={closeSessionForm} />
		</div>
	</div>
{/if}

<style>
	.sheet-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgb(0 0 0 / 0.5);
	}
	.sheet-overlay__panel {
		width: 100%;
		max-width: 32rem;
		max-height: 90vh;
		overflow-y: auto;
	}
	@media (min-width: 640px) {
		.sheet-overlay {
			align-items: center;
		}
	}
</style>
