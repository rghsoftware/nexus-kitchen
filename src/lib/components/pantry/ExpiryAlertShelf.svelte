<script lang="ts">
	import { expiringSoonPantry, runningLow } from '$lib/pantry/pantryStore.svelte';
	import { expiringSoonPrepped } from '$lib/pantry/preppedMealStore.svelte';
	import { addPantryItemsFromShoppingList } from '$lib/pantry/shoppingListIntegration';

	// Getter functions are called inside $derived so the component re-evaluates
	// whenever the underlying store state changes. Exporting $derived directly from
	// a .svelte.ts module is a Svelte compiler error (derived_invalid_export), so
	// the stores expose getter functions and consumers create local $derived here.
	const lowStock = $derived(runningLow());

	const allExpiring = $derived([
		...expiringSoonPantry().map((item) => ({
			id: item.id,
			name: item.name,
			expirationDate: item.expiration_date,
			photoUrl: item.photo_url ?? item.thumbnail_url ?? null,
			kind: 'pantry' as const
		})),
		...expiringSoonPrepped().map((meal) => ({
			id: meal.id,
			name: meal.name,
			expirationDate: meal.expiration_date,
			photoUrl: meal.photo_url ?? null,
			kind: 'prepped' as const
		}))
	]);

	function formatDate(isoDate: string | null): string {
		if (!isoDate) return '';
		const d = new Date(isoDate + 'T00:00:00Z');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
	}

	function handleAddToShoppingList() {
		void addPantryItemsFromShoppingList([]);
	}
</script>

<!--
	ExpiryAlertShelf — attention-first shelf shown when items are expiring or running low.
	Renders nothing when both lists are empty (no unnecessary empty space).
	ADHD-friendly: clear labels, no shame language, warm-ochre (not red) attention color.
	Touch targets: buttons min 44px via .nk-btn.
-->
{#if allExpiring.length > 0 || lowStock.length > 0}
	<section
		aria-label="Items that need your attention"
		class="nk-stack gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]"
	>
		<!-- Expiring Soon horizontal scroll row -->
		{#if allExpiring.length > 0}
			<div class="nk-stack gap-2">
				<h2 class="nk-eyebrow" style="color: var(--color-warning-text);">Expiring Soon</h2>

				<!-- Horizontal scroll container -->
				<div
					class="nk-scroll -mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
					aria-label="Items expiring soon"
					role="list"
				>
					{#each allExpiring as entry (entry.id)}
						<div
							role="listitem"
							class="nk-stack w-28 shrink-0 gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-2"
						>
							<!-- Photo or placeholder -->
							{#if entry.photoUrl}
								<img
									src={entry.photoUrl}
									alt={entry.name}
									class="h-16 w-full rounded-[var(--radius-sm)] object-cover"
									loading="lazy"
								/>
							{:else}
								<div class="nk-tile h-16 w-full rounded-[var(--radius-sm)]" aria-hidden="true">
									<span style="font-size: 1.25rem;">{entry.kind === 'prepped' ? '🍱' : '🥫'}</span>
								</div>
							{/if}

							<!-- Item name -->
							<p
								class="line-clamp-2 leading-[var(--leading-snug)] [font-weight:var(--weight-semibold)] text-[var(--text)] text-[var(--text-sm)]"
							>
								{entry.name}
							</p>

							<!-- Expiry date -->
							{#if entry.expirationDate}
								<p
									class="text-[var(--color-warning-text)] text-[var(--text-xs)]"
									aria-label="Expires {formatDate(entry.expirationDate)}"
								>
									{formatDate(entry.expirationDate)}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Running Low text list -->
		{#if lowStock.length > 0}
			<div class="nk-stack gap-2">
				<h2 class="nk-eyebrow">Running Low</h2>

				<ul class="nk-stack m-0 list-none gap-1.5 p-0" aria-label="Items running low">
					{#each lowStock as item (item.id)}
						<li class="nk-row justify-between gap-2">
							<span
								class="truncate [font-weight:var(--weight-medium)] text-[var(--text)] text-[var(--text-sm)]"
							>
								{item.name}
							</span>
							<span
								class="tabular shrink-0 text-[var(--text-muted)] text-[var(--text-sm)]"
								aria-label="{item.quantity} {item.unit} remaining"
							>
								{item.quantity}
								{item.unit}
							</span>
						</li>
					{/each}
				</ul>

				<!-- Add to Shopping List CTA -->
				<button
					class="nk-btn nk-btn--secondary nk-btn--sm w-fit"
					onclick={handleAddToShoppingList}
					aria-label="Add low-stock pantry items to shopping list"
				>
					Add to Shopping List
				</button>
			</div>
		{/if}
	</section>
{/if}
