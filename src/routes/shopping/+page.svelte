<script lang="ts">
	import CompleteTripSheet from '$lib/components/shopping/CompleteTripSheet.svelte';
	import GenerateListSheet from '$lib/components/shopping/GenerateListSheet.svelte';
	import ListsOverview from '$lib/components/shopping/ListsOverview.svelte';
	import ShoppingListView from '$lib/components/shopping/ShoppingListView.svelte';
	import { loadLists, openListId } from '$lib/shopping/shoppingStore.svelte';

	let showGenerate = $state(false);
	let showComplete = $state(false);

	$effect(() => {
		void loadLists();
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Escape') return;
		if (showComplete) showComplete = false;
		else if (showGenerate) showGenerate = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head><title>Shopping — Nexus Kitchen</title></svelte:head>

<!-- inert: the page behind an open sheet must not stay interactive — the sheets seed
     their state once on mount and assume the list can't change underneath them. -->
<section
	class="mx-auto flex w-full max-w-3xl flex-col gap-4 p-5"
	inert={showComplete || showGenerate}
>
	<header class="flex items-center gap-3">
		<h1
			class="m-0 font-[var(--font-display)] [font-weight:var(--weight-bold)] text-[var(--text)] text-[var(--text-2xl)]"
		>
			Shopping
		</h1>
	</header>

	{#if openListId() !== null}
		<ShoppingListView onComplete={() => (showComplete = true)} />
	{:else}
		<ListsOverview onGenerate={() => (showGenerate = true)} />
	{/if}
</section>

{#if showComplete}
	<div class="sheet-overlay" role="dialog" aria-modal="true" aria-label="Complete shopping">
		<div class="sheet-overlay__panel">
			<CompleteTripSheet onClose={() => (showComplete = false)} />
		</div>
	</div>
{/if}

{#if showGenerate}
	<div class="sheet-overlay" role="dialog" aria-modal="true" aria-label="Generate from meal plan">
		<div class="sheet-overlay__panel">
			<GenerateListSheet onClose={() => (showGenerate = false)} />
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
