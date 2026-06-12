<!--
	ListsOverview — the Shopping landing surface (Domain Spec §4.7): active lists to
	continue, a create form, generate-from-plan entry, and a calm shelf of recent
	(completed/archived) lists (FR-SH-004).
-->
<script lang="ts">
	import {
		activeLists,
		createList,
		openShoppingList,
		recentLists,
		shoppingError,
		shoppingLists,
		shoppingListsLoaded,
		shoppingLoading
	} from '$lib/shopping/shoppingStore.svelte';
	import type { ShoppingList } from '$lib/shopping/types';

	interface Props {
		/** Provided once generation exists (US2); the button hides without it. */
		onGenerate?: () => void;
	}
	let { onGenerate }: Props = $props();

	let creating = $state(false);
	let newName = $state('');
	let busy = $state(false);

	const active = $derived(activeLists());
	const recent = $derived(recentLists());

	function listDateLabel(list: ShoppingList): string {
		const stamp = list.completedAt ?? list.updatedAt;
		return new Date(stamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	async function submitCreate(event: SubmitEvent) {
		event.preventDefault();
		const name = newName.trim();
		if (name.length === 0) return;
		busy = true;
		try {
			const created = await createList(name);
			if (created) {
				creating = false;
				newName = '';
				await openShoppingList(created.id);
			}
		} finally {
			busy = false;
		}
	}
</script>

<section class="flex flex-col gap-4" aria-label="Your shopping lists">
	{#if shoppingError()}
		<p class="m-0 text-[var(--attention)] text-[var(--text-sm)]" role="alert">
			{shoppingError()}
		</p>
	{/if}

	{#if shoppingLoading() && !shoppingListsLoaded()}
		<p class="m-0 text-[var(--text-muted)]">Loading your lists…</p>
	{:else}
		{#if active.length > 0}
			<div class="flex flex-col gap-2">
				<h2 class="nk-eyebrow m-0">Active</h2>
				{#each active as list (list.id)}
					<article class="nk-card flex items-center gap-3 p-4">
						<i
							class="ph ph-shopping-cart-simple text-[1.4rem] text-[var(--primary-text)]"
							aria-hidden="true"
						></i>
						<div class="min-w-0 flex-1">
							<h3 class="m-0 [font-weight:var(--weight-semibold)] text-[var(--text)]">
								{list.name}
							</h3>
							<p class="m-0 text-[var(--text-muted)] text-[var(--text-sm)]">
								{list.sourceType === 'FROM_PLAN' ? 'From your plan' : 'Made by hand'}
								{#if list.status === 'SHOPPING'}
									· shopping now
								{/if}
							</p>
						</div>
						<button
							type="button"
							class="nk-btn nk-btn--primary nk-btn--sm"
							onclick={() => openShoppingList(list.id)}
						>
							{list.status === 'SHOPPING' ? 'Continue' : 'Open'}
						</button>
					</article>
				{/each}
			</div>
		{:else if shoppingListsLoaded()}
			<div class="nk-card flex flex-col items-start gap-2 p-5">
				<h2 class="m-0 [font-weight:var(--weight-semibold)] text-[var(--text)]">No lists yet</h2>
				<p class="m-0 text-[var(--text-secondary)] text-[var(--text-sm)]">
					Start one by hand, or build it straight from this week's plan.
				</p>
			</div>
		{/if}

		<div class="flex flex-wrap gap-2">
			{#if onGenerate}
				<button type="button" class="nk-btn nk-btn--primary" onclick={onGenerate}>
					<i class="ph ph-calendar-dots" aria-hidden="true"></i>
					Generate from meal plan
				</button>
			{/if}
			{#if creating}
				<form class="flex flex-wrap items-center gap-2" onsubmit={submitCreate}>
					<label class="flex items-center gap-2">
						<span class="sr-only">List name</span>
						<input
							class="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]"
							type="text"
							bind:value={newName}
							placeholder="e.g. Corner store"
							required
						/>
					</label>
					<button type="submit" class="nk-btn nk-btn--primary" disabled={busy}>Create</button>
					<button type="button" class="nk-btn nk-btn--ghost" onclick={() => (creating = false)}>
						Cancel
					</button>
				</form>
			{:else}
				<button type="button" class="nk-btn nk-btn--secondary" onclick={() => (creating = true)}>
					<i class="ph ph-plus" aria-hidden="true"></i>
					New list
				</button>
			{/if}
		</div>

		{#if recent.length > 0}
			<div class="flex flex-col gap-2">
				<h2 class="nk-eyebrow m-0">Recent</h2>
				<ul class="m-0 flex list-none flex-col gap-1 p-0">
					{#each recent.slice(0, 8) as list (list.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left hover:bg-[var(--surface-2)]"
								onclick={() => openShoppingList(list.id)}
							>
								<i
									class="ph {list.status === 'COMPLETED'
										? 'ph-check-circle'
										: 'ph-archive'} text-[var(--text-muted)]"
									aria-hidden="true"
								></i>
								<span class="flex-1 text-[var(--text-secondary)]">{list.name}</span>
								<span class="text-[var(--text-muted)] text-[var(--text-sm)]">
									{listDateLabel(list)} · {list.status === 'COMPLETED' ? 'Completed' : 'Archived'}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{/if}

	{#if shoppingLists().length === 0 && !shoppingListsLoaded() && !shoppingLoading()}
		<p class="m-0 text-[var(--text-muted)]">Your lists will appear here.</p>
	{/if}
</section>
