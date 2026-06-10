<script lang="ts">
	import { pantryItems, pantryLoading } from '$lib/pantry/pantryStore.svelte';
	import type { PantryItem, StorageLocation } from '$lib/pantry/types';
	import PantryItemCard from './PantryItemCard.svelte';

	interface Props {
		storageFilter: 'ALL' | StorageLocation;
		onAddItem?: () => void;
		onEditItem?: (item: PantryItem) => void;
	}

	let { storageFilter, onAddItem, onEditItem }: Props = $props();

	const filtered = $derived(
		storageFilter === 'ALL'
			? pantryItems()
			: pantryItems().filter((i) => i.storage_location === storageFilter)
	);

	const locationLabel = $derived(
		storageFilter === 'ALL'
			? 'pantry'
			: storageFilter === 'PANTRY'
				? 'pantry'
				: storageFilter === 'FRIDGE'
					? 'fridge'
					: storageFilter === 'FREEZER'
						? 'freezer'
						: 'storage'
	);
</script>

{#if pantryLoading()}
	<!-- Loading skeleton: 3 placeholder cards -->
	<div
		class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
		aria-busy="true"
		aria-label="Loading pantry items"
	>
		{#each [0, 1, 2] as skeletonIdx (skeletonIdx)}
			<div
				class="nk-card animate-pulse"
				style="min-height: 120px; padding: var(--space-4);"
				aria-hidden="true"
			>
				<div
					style="height: 1rem; width: 60%; border-radius: var(--radius-sm); background: var(--surface-3); margin-bottom: var(--space-3);"
				></div>
				<div
					style="height: 0.75rem; width: 40%; border-radius: var(--radius-sm); background: var(--surface-2);"
				></div>
			</div>
		{/each}
	</div>
{:else if filtered.length === 0}
	<!-- Empty state -->
	<div
		class="nk-stack"
		style="align-items: center; justify-content: center; padding: var(--space-10) var(--space-6); gap: var(--space-5); text-align: center;"
	>
		<p style="font-size: var(--text-lg); color: var(--text-secondary);">
			Your {locationLabel} is empty
		</p>
		<p style="font-size: var(--text-sm); color: var(--text-muted); max-width: 28ch;">
			Track what you have on hand so nothing goes to waste.
		</p>
		{#if onAddItem}
			<button class="nk-btn nk-btn--primary" onclick={onAddItem} type="button">
				+ Add your first item
			</button>
		{/if}
	</div>
{:else}
	<!-- Populated grid -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#each filtered as item (item.id)}
			<PantryItemCard {item} onclick={() => onEditItem?.(item)} />
		{/each}
	</div>
{/if}
