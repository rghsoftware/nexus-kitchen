<!--
	AddItemForm — manual item entry (FR-SH-005). Quantity must stay positive
	(INV-SH-002, guarded here and by the DB CHECK). Category is auto-suggested from
	the name via the keyword categorizer until the user picks one themselves
	(FR-SH-019: fixed built-in set).
-->
<script lang="ts">
	import { categorize } from '$lib/shopping/categorize';
	import { addItemToOpenList } from '$lib/shopping/shoppingStore.svelte';
	import { CATEGORY_LABELS, SHOPPING_CATEGORIES, type ShoppingCategory } from '$lib/shopping/types';

	let name = $state('');
	let quantity = $state(1);
	let unit = $state('x');
	let chosenCategory = $state<ShoppingCategory | null>(null); // null = follow suggestion
	let busy = $state(false);
	let error = $state<string | null>(null);

	const category = $derived(chosenCategory ?? categorize(name));

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		if (trimmed.length === 0) {
			error = 'Give the item a name.';
			return;
		}
		if (!(quantity > 0)) {
			error = 'Quantity needs to be more than zero.';
			return;
		}
		error = null;
		busy = true;
		try {
			const created = await addItemToOpenList({
				name: trimmed,
				quantity,
				unit: unit.trim() || 'x',
				category
			});
			if (created) {
				name = '';
				quantity = 1;
				unit = 'x';
				chosenCategory = null;
			}
		} finally {
			busy = false;
		}
	}
</script>

<form class="flex flex-wrap items-end gap-2" onsubmit={submit} aria-label="Add an item">
	<label class="flex min-w-40 flex-1 flex-col gap-1">
		<span
			class="[font-weight:var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
		>
			Item
		</span>
		<input
			class="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]"
			type="text"
			bind:value={name}
			placeholder="e.g. Onions"
			required
		/>
	</label>

	<label class="flex w-20 flex-col gap-1">
		<span
			class="[font-weight:var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
		>
			Qty
		</span>
		<input
			class="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]"
			type="number"
			bind:value={quantity}
			min="0.001"
			step="any"
			required
		/>
	</label>

	<label class="flex w-24 flex-col gap-1">
		<span
			class="[font-weight:var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
		>
			Unit
		</span>
		<input
			class="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]"
			type="text"
			bind:value={unit}
			placeholder="x"
		/>
	</label>

	<label class="flex w-40 flex-col gap-1">
		<span
			class="[font-weight:var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
		>
			Category
		</span>
		<select
			class="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]"
			value={category}
			onchange={(e) => (chosenCategory = e.currentTarget.value as ShoppingCategory)}
		>
			{#each SHOPPING_CATEGORIES as c (c)}
				<option value={c}>{CATEGORY_LABELS[c]}</option>
			{/each}
		</select>
	</label>

	<button type="submit" class="nk-btn nk-btn--primary" disabled={busy}>
		<i class="ph ph-plus" aria-hidden="true"></i>
		Add
	</button>

	{#if error}
		<p class="m-0 w-full text-[var(--attention)] text-[var(--text-sm)]" role="alert">{error}</p>
	{/if}
</form>
