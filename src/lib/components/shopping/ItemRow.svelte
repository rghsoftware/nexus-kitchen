<!--
	ItemRow — one shopping item. Check/uncheck follows the §5.3 state machine with
	optimistic store writes (REQ-CN-003); checked rows render in the Checked section
	(FR-SH-008) and never disappear mid-trip. "Couldn't find it" marks UNAVAILABLE —
	calm wording, never blame (P13). Removing the last visible item of an active list
	prompts to archive instead (INV-SH-001).
-->
<script lang="ts">
	import {
		checkItem,
		deleteOpenItem,
		markItemUnavailable,
		uncheckItem,
		updateOpenItem,
		wouldEmptyActiveList
	} from '$lib/shopping/shoppingStore.svelte';
	import {
		CATEGORY_LABELS,
		SHOPPING_CATEGORIES,
		type ShoppingCategory,
		type ShoppingItem
	} from '$lib/shopping/types';

	interface Props {
		item: ShoppingItem;
	}
	let { item }: Props = $props();

	let editing = $state(false);
	let confirmingArchive = $state(false);
	let busy = $state(false);

	// Edit drafts are seeded when editing opens, not bound to the live item.
	let draftName = $state('');
	let draftQuantity = $state(1);
	let draftUnit = $state('');
	let draftCategory = $state<ShoppingCategory>('OTHER');

	const checked = $derived(item.status === 'CHECKED');
	const unavailable = $derived(item.status === 'UNAVAILABLE');
	const attribution = $derived(item.neededFor.map((n) => n.title).join(', '));
	const quantityLabel = $derived(
		item.unit === 'x' ? `(${item.quantity})` : `(${item.quantity} ${item.unit})`
	);

	function openEdit() {
		draftName = item.name;
		draftQuantity = item.quantity;
		draftUnit = item.unit;
		draftCategory = item.category;
		editing = true;
	}

	async function saveEdit(event: SubmitEvent) {
		event.preventDefault();
		if (draftName.trim().length === 0 || !(draftQuantity > 0)) return;
		busy = true;
		try {
			await updateOpenItem(item.id, {
				name: draftName.trim(),
				quantity: draftQuantity,
				unit: draftUnit.trim() || 'x',
				category: draftCategory
			});
			editing = false;
		} finally {
			busy = false;
		}
	}

	async function toggle() {
		busy = true;
		try {
			await (checked ? uncheckItem(item.id) : checkItem(item.id));
		} finally {
			busy = false;
		}
	}

	async function remove(archive: boolean) {
		busy = true;
		try {
			await deleteOpenItem(item.id, archive);
			confirmingArchive = false;
		} finally {
			busy = false;
		}
	}

	function onRemoveClick() {
		if (wouldEmptyActiveList(item.id)) {
			confirmingArchive = true;
		} else {
			void remove(false);
		}
	}
</script>

<li
	class="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
	class:opacity-70={checked || unavailable}
>
	<div class="flex items-center gap-3">
		<button
			type="button"
			class="grid size-11 shrink-0 place-items-center rounded-[var(--radius-sm)] border text-[var(--text-lg)] transition-colors
				{checked
				? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary-text)]'
				: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'}"
			role="checkbox"
			aria-checked={checked}
			aria-label={checked ? `Uncheck ${item.name}` : `Check off ${item.name}`}
			disabled={busy || unavailable}
			onclick={toggle}
		>
			<i class="ph {checked ? 'ph-check-square' : 'ph-square'}" aria-hidden="true"></i>
		</button>

		<div class="min-w-0 flex-1">
			<p
				class="m-0 [font-weight:var(--weight-semibold)] text-[var(--text)]"
				class:line-through={checked}
			>
				{item.name}
				<span class="[font-weight:var(--weight-regular)] text-[var(--text-secondary)]">
					{quantityLabel}
				</span>
			</p>
			{#if attribution}
				<p class="m-0 truncate text-[var(--text-muted)] text-[var(--text-sm)]">
					For: {attribution}
				</p>
			{/if}
			{#if unavailable}
				<p class="m-0 text-[var(--attention)] text-[var(--text-sm)]">
					<i class="ph ph-storefront" aria-hidden="true"></i>
					Couldn't find it
				</p>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-1">
			{#if item.status === 'PENDING'}
				<button
					type="button"
					class="nk-btn nk-btn--ghost nk-btn--sm"
					aria-label="Couldn't find {item.name} at the store"
					title="Couldn't find it"
					disabled={busy}
					onclick={() => markItemUnavailable(item.id)}
				>
					<i class="ph ph-storefront" aria-hidden="true"></i>
				</button>
			{:else if unavailable}
				<button
					type="button"
					class="nk-btn nk-btn--ghost nk-btn--sm"
					aria-label="Put {item.name} back on the list"
					title="Back on the list"
					disabled={busy}
					onclick={() => uncheckItem(item.id)}
				>
					<i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i>
				</button>
			{/if}
			{#if !checked}
				<button
					type="button"
					class="nk-btn nk-btn--ghost nk-btn--sm"
					aria-label="Edit {item.name}"
					disabled={busy}
					onclick={() => (editing ? (editing = false) : openEdit())}
				>
					<i class="ph ph-pencil-simple" aria-hidden="true"></i>
				</button>
				<button
					type="button"
					class="nk-btn nk-btn--ghost nk-btn--sm"
					aria-label="Remove {item.name}"
					disabled={busy}
					onclick={onRemoveClick}
				>
					<i class="ph ph-x" aria-hidden="true"></i>
				</button>
			{/if}
		</div>
	</div>

	{#if confirmingArchive}
		<div
			class="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2 text-[var(--text-sm)]"
			role="alertdialog"
			aria-label="Archive list confirmation"
		>
			<span class="text-[var(--text-secondary)]">
				That's the last item — removing it will archive this list.
			</span>
			<button
				type="button"
				class="nk-btn nk-btn--secondary nk-btn--sm"
				disabled={busy}
				onclick={() => remove(true)}
			>
				Remove & archive
			</button>
			<button
				type="button"
				class="nk-btn nk-btn--ghost nk-btn--sm"
				onclick={() => (confirmingArchive = false)}
			>
				Keep it
			</button>
		</div>
	{/if}

	{#if editing}
		<form class="flex flex-wrap items-end gap-2" onsubmit={saveEdit} aria-label="Edit {item.name}">
			<label class="flex min-w-32 flex-1 flex-col gap-1">
				<span class="text-[var(--text-2xs)] text-[var(--text-muted)]">Name</span>
				<input
					class="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--text)]"
					type="text"
					bind:value={draftName}
					required
				/>
			</label>
			<label class="flex w-18 flex-col gap-1">
				<span class="text-[var(--text-2xs)] text-[var(--text-muted)]">Qty</span>
				<input
					class="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--text)]"
					type="number"
					bind:value={draftQuantity}
					min="0.001"
					step="any"
					required
				/>
			</label>
			<label class="flex w-20 flex-col gap-1">
				<span class="text-[var(--text-2xs)] text-[var(--text-muted)]">Unit</span>
				<input
					class="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--text)]"
					type="text"
					bind:value={draftUnit}
				/>
			</label>
			<label class="flex w-36 flex-col gap-1">
				<span class="text-[var(--text-2xs)] text-[var(--text-muted)]">Category</span>
				<select
					class="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--text)]"
					bind:value={draftCategory}
				>
					{#each SHOPPING_CATEGORIES as c (c)}
						<option value={c}>{CATEGORY_LABELS[c]}</option>
					{/each}
				</select>
			</label>
			<button type="submit" class="nk-btn nk-btn--primary nk-btn--sm" disabled={busy}>Save</button>
			<button
				type="button"
				class="nk-btn nk-btn--ghost nk-btn--sm"
				onclick={() => (editing = false)}
			>
				Cancel
			</button>
		</form>
	{/if}
</li>
