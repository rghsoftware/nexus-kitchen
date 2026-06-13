<!--
	GenerateListSheet — turn the plan's must-acquire gaps into a list (FR-SH-010/014).
	Range defaults to today → +6 days (clarified 2026-06-11) and stays user-adjustable.
	A fully-covered range is a calm success state — no list is created (INV-SH-001).
-->
<script lang="ts">
	import { addDays, todayLocalISO } from '$lib/planning/weekMath';
	import {
		activeLists,
		generateFromPlan,
		openShoppingList,
		shoppingError,
		shoppingLoading
	} from '$lib/shopping/shoppingStore.svelte';

	interface Props {
		onClose: () => void;
	}
	let { onClose }: Props = $props();

	const today = todayLocalISO();
	let start = $state(today);
	let end = $state(addDays(today, 6));
	let intoListId = $state<string>(''); // '' = new list
	let covered = $state(false);

	const existingGenerated = $derived(activeLists().filter((l) => l.sourceType === 'FROM_PLAN'));
	const rangeValid = $derived(start.length > 0 && end.length > 0 && end >= start);

	async function generate(event: SubmitEvent) {
		event.preventDefault();
		if (!rangeValid) return;
		covered = false;
		const outcome = await generateFromPlan(
			{ start, end },
			intoListId === '' ? undefined : intoListId
		);
		if (outcome === null) return; // error surfaced via shoppingError()
		if (outcome.added === 0) {
			covered = true;
			return;
		}
		if (outcome.list) {
			await openShoppingList(outcome.list.id);
		}
		onClose();
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
				Generate from meal plan
			</h2>
			<p class="m-0 text-[var(--text-secondary)] text-[var(--text-sm)]">
				Missing ingredients and to-buy meals for the days you pick.
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

	{#if shoppingError()}
		<p class="m-0 text-[var(--attention)] text-[var(--text-sm)]" role="alert">{shoppingError()}</p>
	{/if}

	{#if covered}
		<div class="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--primary-soft)] p-4">
			<i
				class="ph ph-check-circle text-[var(--primary-text)] text-[var(--text-xl)]"
				aria-hidden="true"
			></i>
			<p class="m-0 text-[var(--primary-text)]">
				You're covered — nothing in those days needs buying.
			</p>
		</div>
		<button type="button" class="nk-btn nk-btn--secondary" onclick={onClose}>Nice — close</button>
	{:else}
		<form class="flex flex-col gap-4" onsubmit={generate}>
			<div class="flex flex-wrap gap-3">
				<label class="flex flex-1 basis-36 flex-col gap-1">
					<span
						class="[font-weight:var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
					>
						From
					</span>
					<input
						class="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]"
						type="date"
						bind:value={start}
						required
					/>
				</label>
				<label class="flex flex-1 basis-36 flex-col gap-1">
					<span
						class="[font-weight:var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
					>
						Through
					</span>
					<input
						class="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]"
						type="date"
						bind:value={end}
						min={start}
						required
					/>
				</label>
			</div>

			{#if existingGenerated.length > 0}
				<label class="flex flex-col gap-1">
					<span
						class="[font-weight:var(--weight-semibold)] text-[var(--text-secondary)] text-[var(--text-sm)]"
					>
						Add to
					</span>
					<select
						class="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--text)]"
						bind:value={intoListId}
					>
						<option value="">A new list</option>
						{#each existingGenerated as list (list.id)}
							<option value={list.id}>{list.name} (existing)</option>
						{/each}
					</select>
				</label>
			{/if}

			{#if !rangeValid}
				<p class="m-0 text-[var(--attention)] text-[var(--text-sm)]">
					The end day needs to be on or after the start day.
				</p>
			{/if}

			<button
				type="submit"
				class="nk-btn nk-btn--primary nk-btn--lg"
				disabled={!rangeValid || shoppingLoading()}
			>
				<i class="ph ph-list-checks" aria-hidden="true"></i>
				{shoppingLoading() ? 'Looking at your plan…' : 'Generate list'}
			</button>
		</form>
	{/if}
</div>
