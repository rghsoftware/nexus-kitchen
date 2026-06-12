<script lang="ts">
	import ListsOverview from '$lib/components/shopping/ListsOverview.svelte';
	import ShoppingListView from '$lib/components/shopping/ShoppingListView.svelte';
	import { loadLists, openListId } from '$lib/shopping/shoppingStore.svelte';

	$effect(() => {
		void loadLists();
	});
</script>

<svelte:head><title>Shopping — Nexus Kitchen</title></svelte:head>

<section class="mx-auto flex w-full max-w-3xl flex-col gap-4 p-5">
	<header class="flex items-center gap-3">
		<h1
			class="m-0 font-[var(--font-display)] [font-weight:var(--weight-bold)] text-[var(--text)] text-[var(--text-2xl)]"
		>
			Shopping
		</h1>
	</header>

	{#if openListId() !== null}
		<ShoppingListView />
	{:else}
		<ListsOverview />
	{/if}
</section>
