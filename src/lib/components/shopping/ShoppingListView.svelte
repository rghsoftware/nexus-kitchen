<!--
	ShoppingListView — one open list (Domain Spec §4.7). Pending items grouped by the
	fixed built-in categories in enum order (FR-SH-019); checked items move to a
	collapsible "Checked" section that stays visible for the whole trip (FR-SH-008,
	REQ-SL-010). Unavailable items keep their own calm shelf so unmet gaps stay seen.
-->
<script lang="ts">
	import AddItemForm from './AddItemForm.svelte';
	import ItemRow from './ItemRow.svelte';
	import {
		closeShoppingList,
		openList,
		openListItems,
		shoppingLoading
	} from '$lib/shopping/shoppingStore.svelte';
	import {
		CATEGORY_LABELS,
		SHOPPING_CATEGORIES,
		type ShoppingCategory,
		type ShoppingItem
	} from '$lib/shopping/types';

	interface Props {
		/** Provided once completion exists (US4); the button hides without it. */
		onComplete?: () => void;
	}
	let { onComplete }: Props = $props();

	let checkedOpen = $state(true);
	let addOpen = $state(false);

	const CATEGORY_ICONS: Record<ShoppingCategory, string> = {
		PRODUCE: 'ph-carrot',
		DAIRY: 'ph-egg',
		MEAT_SEAFOOD: 'ph-fish',
		CANNED: 'ph-package',
		FROZEN: 'ph-snowflake',
		BAKERY: 'ph-bread',
		PANTRY_STAPLES: 'ph-jar',
		OTHER: 'ph-basket'
	};

	const list = $derived(openList());
	const items = $derived(openListItems());
	const pending = $derived(items.filter((i) => i.status === 'PENDING'));
	const checked = $derived(items.filter((i) => i.status === 'CHECKED'));
	const unavailable = $derived(items.filter((i) => i.status === 'UNAVAILABLE'));
	const progressTotal = $derived(pending.length + checked.length);

	const groups = $derived(
		SHOPPING_CATEGORIES.map((category) => ({
			category,
			items: pending.filter((i: ShoppingItem) => i.category === category)
		})).filter((g) => g.items.length > 0)
	);
</script>

{#if list}
	<section class="flex flex-col gap-4" aria-label={list.name}>
		<header class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				class="nk-btn nk-btn--ghost nk-btn--sm"
				aria-label="Back to your lists"
				onclick={closeShoppingList}
			>
				<i class="ph ph-arrow-left" aria-hidden="true"></i>
			</button>
			<h2
				class="m-0 flex-1 font-[var(--font-display)] [font-weight:var(--weight-bold)] text-[var(--text)] text-[var(--text-xl)]"
			>
				{list.name}
			</h2>
			{#if progressTotal > 0}
				<p class="m-0 text-[var(--text-secondary)] text-[var(--text-sm)]" aria-live="polite">
					{checked.length}/{progressTotal} checked
				</p>
			{/if}
		</header>

		{#if progressTotal > 0}
			<div
				class="h-2 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface-2)]"
				role="progressbar"
				aria-valuemin="0"
				aria-valuemax={progressTotal}
				aria-valuenow={checked.length}
				aria-label="Shopping progress"
			>
				<div
					class="h-full rounded-[var(--radius-pill)] bg-[var(--primary)] transition-[width]"
					style="width: {progressTotal === 0 ? 0 : (checked.length / progressTotal) * 100}%"
				></div>
			</div>
		{/if}

		{#if shoppingLoading()}
			<p class="m-0 text-[var(--text-muted)]">Loading your list…</p>
		{:else if items.length === 0}
			<p class="m-0 text-[var(--text-secondary)]">Nothing here yet — add your first item below.</p>
		{/if}

		{#each groups as group (group.category)}
			<div class="flex flex-col gap-2">
				<h3 class="nk-eyebrow m-0 flex items-center gap-2">
					<i class="ph {CATEGORY_ICONS[group.category]}" aria-hidden="true"></i>
					{CATEGORY_LABELS[group.category]}
				</h3>
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					{#each group.items as item (item.id)}
						<ItemRow {item} />
					{/each}
				</ul>
			</div>
		{/each}

		{#if unavailable.length > 0}
			<div class="flex flex-col gap-2">
				<h3 class="nk-eyebrow m-0 flex items-center gap-2">
					<i class="ph ph-storefront" aria-hidden="true"></i>
					Couldn't find ({unavailable.length})
				</h3>
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					{#each unavailable as item (item.id)}
						<ItemRow {item} />
					{/each}
				</ul>
			</div>
		{/if}

		{#if checked.length > 0}
			<div class="flex flex-col gap-2">
				<button
					type="button"
					class="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2 text-left [font-weight:var(--weight-semibold)] text-[var(--text-secondary)]"
					aria-expanded={checkedOpen}
					onclick={() => (checkedOpen = !checkedOpen)}
				>
					<i class="ph ph-check-circle" aria-hidden="true"></i>
					Checked ({checked.length})
					<i class="ph {checkedOpen ? 'ph-caret-up' : 'ph-caret-down'} ml-auto" aria-hidden="true"
					></i>
				</button>
				{#if checkedOpen}
					<ul class="m-0 flex list-none flex-col gap-2 p-0">
						{#each checked as item (item.id)}
							<ItemRow {item} />
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		<div class="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
			{#if addOpen}
				<AddItemForm />
				<button
					type="button"
					class="nk-btn nk-btn--ghost nk-btn--sm mt-2"
					onclick={() => (addOpen = false)}
				>
					Done adding
				</button>
			{:else}
				<button type="button" class="nk-btn nk-btn--secondary" onclick={() => (addOpen = true)}>
					<i class="ph ph-plus" aria-hidden="true"></i>
					Add item
				</button>
			{/if}
		</div>

		{#if onComplete && (list.status === 'ACTIVE' || list.status === 'SHOPPING') && checked.length > 0}
			<button
				type="button"
				class="nk-btn nk-btn--primary nk-btn--lg nk-btn--block"
				onclick={onComplete}
			>
				<i class="ph ph-basket" aria-hidden="true"></i>
				Complete shopping — add to pantry
			</button>
		{/if}
	</section>
{/if}
