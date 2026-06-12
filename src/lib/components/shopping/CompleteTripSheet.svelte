<!--
	CompleteTripSheet — finish the trip (FR-SH-015..018). Review what was bought
	before it lands in inventory: pantry rows (quantity / unit / location editable),
	store-bought purchases as ready-to-eat portions (portions / expiry / location
	editable, auto-linked to their planned meal). Declining is a first-class path —
	REQ-PM-011 is an offer. Unbought items can carry over so the gap stays visible
	(FR-SH-017).
-->
<script lang="ts">
	import {
		completeTrip,
		carryOverItems,
		defaultAdditions,
		type CompletionReport
	} from '$lib/shopping/replenishment';
	import {
		closeShoppingList,
		createList,
		openList,
		openListItems,
		upsertListLocal
	} from '$lib/shopping/shoppingStore.svelte';
	import type { StorageLocation } from '$lib/pantry/types';

	interface Props {
		onClose: () => void;
	}
	let { onClose }: Props = $props();

	const LOCATIONS: { value: StorageLocation; label: string }[] = [
		{ value: 'PANTRY', label: 'Pantry' },
		{ value: 'FRIDGE', label: 'Fridge' },
		{ value: 'FREEZER', label: 'Freezer' },
		{ value: 'OTHER', label: 'Other' }
	];

	const list = openList();
	const items = openListItems();
	const checked = items.filter((i) => i.status === 'CHECKED');
	const unbought = items.filter((i) => i.status === 'PENDING' || i.status === 'UNAVAILABLE');

	// Seeded once from the open list; the sheet unmounts on close. Safe ONLY because
	// the page puts the list behind this sheet under `inert` while it is open — if
	// that guard is removed, edits below the scrim would be silently dropped here.
	const seeded = defaultAdditions(checked);
	let pantryRows = $state(seeded.pantry);
	let portionRows = $state(seeded.portions);
	let carryOver = $state(unbought.length > 0);
	let busy = $state(false);
	let report = $state<CompletionReport | null>(null);

	async function finish(replenish: boolean) {
		if (!list) return;
		busy = true;
		try {
			const result = await completeTrip(
				list,
				replenish ? { pantry: pantryRows, portions: portionRows } : { pantry: [], portions: [] }
			);
			if (carryOver && unbought.length > 0) {
				try {
					const carried = await carryOverItems(createList, unbought);
					if (!carried.list || carried.carried < unbought.length) {
						result.failures.push({
							name: 'Carry over',
							message:
								"We couldn't move the unbought items to a new list — they stayed on this one."
						});
					}
				} catch {
					result.failures.push({
						name: 'Carry over',
						message: "We couldn't move the unbought items to a new list — they stayed on this one."
					});
				}
			}
			if (result.list) upsertListLocal(result.list);
			if (result.failures.length > 0) {
				report = result; // keep the sheet open so nothing fails silently
			} else {
				closeShoppingList();
				onClose();
			}
		} catch {
			report = {
				list: null,
				pantryItemsAdded: 0,
				portionsCreated: 0,
				mealsLinked: 0,
				failures: [
					{
						name: 'Completing the trip',
						message: "Something didn't go through — your list is still here. You can try again."
					}
				]
			};
		} finally {
			busy = false;
		}
	}
</script>

<div
	class="flex flex-col gap-4 rounded-[var(--radius-lg)] bg-[var(--surface)] p-6"
	style="box-shadow: var(--shadow-lg, var(--shadow-md));"
>
	<header class="flex items-start justify-between gap-2">
		<div>
			<h2
				class="m-0 font-[var(--font-display)] [font-weight:var(--weight-bold)] text-[var(--text)] text-[var(--text-xl)]"
			>
				Complete shopping
			</h2>
			<p class="m-0 text-[var(--text-secondary)] text-[var(--text-sm)]">
				{checked.length} checked item{checked.length === 1 ? '' : 's'} ready to put away.
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

	{#if report}
		<div
			class="flex flex-col gap-2 rounded-[var(--radius-md)] bg-[var(--attention-soft)] p-4"
			role="alert"
		>
			<p class="m-0 [font-weight:var(--weight-semibold)] text-[var(--attention)]">
				Some steps didn't go through:
			</p>
			<ul class="m-0 flex list-none flex-col gap-1 p-0 text-[var(--text)] text-[var(--text-sm)]">
				{#each report.failures as failure (failure.name)}
					<li>{failure.name}: {failure.message}</li>
				{/each}
			</ul>
			<p class="m-0 text-[var(--text-secondary)] text-[var(--text-sm)]">
				Everything else was saved ({report.pantryItemsAdded} pantry item{report.pantryItemsAdded ===
				1
					? ''
					: 's'}, {report.portionsCreated} portion{report.portionsCreated === 1 ? '' : 's'}). You
				can close this and tidy up from the pantry.
			</p>
			<button
				type="button"
				class="nk-btn nk-btn--secondary nk-btn--sm self-start"
				onclick={() => {
					closeShoppingList();
					onClose();
				}}
			>
				Close
			</button>
		</div>
	{:else}
		{#if pantryRows.length > 0}
			<div class="flex flex-col gap-2">
				<h3 class="nk-eyebrow m-0">To the pantry</h3>
				{#each pantryRows as row, index (row.itemId)}
					<div
						class="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-2"
					>
						<span class="min-w-28 flex-1 text-[var(--text)]">{row.name}</span>
						<label class="flex items-center gap-1">
							<span class="sr-only">Quantity of {row.name}</span>
							<input
								class="h-10 w-20 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--text)]"
								type="number"
								min="0.001"
								step="any"
								bind:value={pantryRows[index].quantity}
							/>
						</label>
						<label class="flex items-center gap-1">
							<span class="sr-only">Unit of {row.name}</span>
							<input
								class="h-10 w-20 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--text)]"
								type="text"
								bind:value={pantryRows[index].unit}
							/>
						</label>
						<label class="flex items-center gap-1">
							<span class="sr-only">Where {row.name} is stored</span>
							<select
								class="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--text)]"
								bind:value={pantryRows[index].storageLocation}
							>
								{#each LOCATIONS as loc (loc.value)}
									<option value={loc.value}>{loc.label}</option>
								{/each}
							</select>
						</label>
					</div>
				{/each}
			</div>
		{/if}

		{#if portionRows.length > 0}
			<div class="flex flex-col gap-2">
				<h3 class="nk-eyebrow m-0">Ready to eat</h3>
				<p class="m-0 text-[var(--text-muted)] text-[var(--text-sm)]">
					Bought meals become portions and their planned day reads "Have it".
				</p>
				{#each portionRows as row, index (row.itemId)}
					<div
						class="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] p-2"
					>
						<span class="min-w-28 flex-1 text-[var(--text)]">{row.name}</span>
						<label
							class="flex items-center gap-1 text-[var(--text-secondary)] text-[var(--text-sm)]"
						>
							Portions
							<input
								class="h-10 w-16 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--text)]"
								type="number"
								min="1"
								step="1"
								bind:value={portionRows[index].portions}
							/>
						</label>
						<label
							class="flex items-center gap-1 text-[var(--text-secondary)] text-[var(--text-sm)]"
						>
							Eat by
							<input
								class="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--text)]"
								type="date"
								bind:value={portionRows[index].expirationDate}
							/>
						</label>
						<label class="flex items-center gap-1">
							<span class="sr-only">Where {row.name} is stored</span>
							<select
								class="h-10 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 text-[var(--text)]"
								bind:value={portionRows[index].storageLocation}
							>
								{#each LOCATIONS as loc (loc.value)}
									<option value={loc.value}>{loc.label}</option>
								{/each}
							</select>
						</label>
					</div>
				{/each}
			</div>
		{/if}

		{#if unbought.length > 0}
			<label class="flex items-center gap-2 text-[var(--text)]">
				<input type="checkbox" class="size-5" bind:checked={carryOver} />
				Carry {unbought.length} unbought item{unbought.length === 1 ? '' : 's'} to a new list
			</label>
		{/if}

		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="nk-btn nk-btn--primary nk-btn--lg"
				disabled={busy || (pantryRows.length === 0 && portionRows.length === 0)}
				onclick={() => finish(true)}
			>
				<i class="ph ph-jar" aria-hidden="true"></i>
				{busy ? 'Putting things away…' : 'Add to pantry & complete'}
			</button>
			<button
				type="button"
				class="nk-btn nk-btn--secondary"
				disabled={busy}
				onclick={() => finish(false)}
			>
				Complete without adding
			</button>
		</div>
	{/if}
</div>
