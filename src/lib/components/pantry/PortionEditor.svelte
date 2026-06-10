<script lang="ts">
	import {
		optimisticConsumePortions,
		optimisticCorrectPortions
	} from '$lib/pantry/preppedMealStore.svelte';
	import type { PreppedMeal } from '$lib/pantry/types';

	interface Props {
		meal: PreppedMeal;
		onClose?: () => void;
	}

	let { meal, onClose }: Props = $props();

	let consumeCount = $state(1);
	// correctionCount tracks meal.portions_remaining reactively but is also user-editable
	let correctionCount = $derived(meal.portions_remaining);
	let showCorrect = $state(false);
	let busy = $state(false);
	let errorMsg = $state<string | null>(null);

	const canConsume = $derived(meal.portions_remaining > 0 && !busy);

	// Clamp consumeCount independently so the stepper never exceeds what's left
	$effect(() => {
		if (consumeCount > meal.portions_remaining) {
			consumeCount = Math.max(1, meal.portions_remaining);
		}
	});

	function formatExpiry(isoDate: string): string {
		return new Date(isoDate).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	async function handleConsume() {
		if (!canConsume) return;
		errorMsg = null;
		busy = true;
		try {
			await optimisticConsumePortions(meal.id, consumeCount);
			onClose?.();
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
		} finally {
			busy = false;
		}
	}

	async function handleCorrect() {
		busy = true;
		errorMsg = null;
		try {
			await optimisticCorrectPortions(meal.id, correctionCount);
			onClose?.();
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
		} finally {
			busy = false;
		}
	}
</script>

<div
	class="nk-stack"
	style="gap: var(--space-5); padding: var(--space-6);"
	aria-label="Manage portions for {meal.name}"
>
	<!-- Meal name + expiry info -->
	<div class="nk-stack" style="gap: var(--space-2);">
		<h2
			style="font-family: var(--font-display); font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--text);"
		>
			{meal.name}
		</h2>

		{#if meal.expiration_date}
			<div class="nk-row" style="gap: var(--space-2); flex-wrap: wrap;">
				<span style="font-size: var(--text-sm); color: var(--text-secondary);">
					Expires {formatExpiry(meal.expiration_date)}
				</span>
				{#if meal.isExpiringSoon && !meal.isExpired}
					<span class="nk-note" role="status" aria-label="Expiring soon">
						<!-- Warning icon: unicode so no icon lib dependency -->
						<span aria-hidden="true">&#9888;</span>
						Eat soon
					</span>
				{:else if meal.isExpired}
					<span class="nk-note" role="status" aria-label="Expired" style="color: var(--attention);">
						<span aria-hidden="true">&#9888;</span>
						Past best-by date
					</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Divider -->
	<hr style="border: none; border-top: 1px solid var(--border); margin: 0;" />

	<!-- Consume section (primary) -->
	<section aria-labelledby="consume-heading">
		<div class="nk-stack" style="gap: var(--space-4);">
			<div class="nk-stack" style="gap: var(--space-1);">
				<h3
					id="consume-heading"
					style="font-size: var(--text-base); font-weight: var(--weight-semibold); color: var(--text);"
				>
					Portions remaining
				</h3>
				<p
					style="font-family: var(--font-display); font-size: var(--text-3xl); font-weight: var(--weight-bold); color: var(--primary); line-height: var(--leading-tight);"
					aria-live="polite"
					aria-atomic="true"
				>
					{meal.portions_remaining}
				</p>
			</div>

			<!-- Stepper -->
			<div class="nk-row" style="gap: var(--space-3); align-items: center;">
				<label
					for="consume-count"
					style="font-size: var(--text-sm); color: var(--text-secondary); white-space: nowrap;"
				>
					How many?
				</label>
				<div
					class="nk-row"
					style="gap: 0; border: 1.5px solid var(--border-strong); border-radius: var(--radius-pill); overflow: hidden;"
					role="group"
					aria-label="Portion count"
				>
					<button
						type="button"
						onclick={() => {
							if (consumeCount > 1) consumeCount -= 1;
						}}
						disabled={consumeCount <= 1 || busy}
						aria-label="Decrease by 1"
						style="min-width: var(--tap-min); min-height: var(--tap-min); background: var(--surface); border: none; color: var(--text); font-size: var(--text-lg); font-weight: var(--weight-semibold); cursor: pointer; padding: 0 var(--space-4); transition: background var(--transition);"
					>
						−
					</button>
					<span
						id="consume-count"
						aria-live="polite"
						aria-atomic="true"
						style="min-width: 3ch; text-align: center; font-size: var(--text-lg); font-weight: var(--weight-bold); color: var(--text); font-variant-numeric: tabular-nums; padding: 0 var(--space-2); line-height: var(--tap-min); background: var(--surface);"
					>
						{consumeCount}
					</span>
					<button
						type="button"
						onclick={() => {
							if (consumeCount < meal.portions_remaining) consumeCount += 1;
						}}
						disabled={consumeCount >= meal.portions_remaining || busy}
						aria-label="Increase by 1"
						style="min-width: var(--tap-min); min-height: var(--tap-min); background: var(--surface); border: none; color: var(--text); font-size: var(--text-lg); font-weight: var(--weight-semibold); cursor: pointer; padding: 0 var(--space-4); transition: background var(--transition);"
					>
						+
					</button>
				</div>
			</div>

			<!-- Primary action -->
			<button
				class="nk-btn nk-btn--primary nk-btn--lg nk-btn--block"
				type="button"
				onclick={handleConsume}
				disabled={!canConsume}
				aria-disabled={!canConsume}
			>
				{#if busy}
					Saving…
				{:else if meal.portions_remaining === 0}
					No portions left
				{:else}
					Eat {consumeCount}
					{consumeCount === 1 ? 'portion' : 'portions'}
				{/if}
			</button>

			<!-- Error message -->
			{#if errorMsg}
				<p
					role="alert"
					style="font-size: var(--text-sm); color: var(--attention); padding: var(--space-3); border-radius: var(--radius-sm); background: var(--attention-soft);"
				>
					{errorMsg}
				</p>
			{/if}
		</div>
	</section>

	<!-- Divider -->
	<hr style="border: none; border-top: 1px solid var(--border); margin: 0;" />

	<!-- Correction section (secondary, de-emphasized) -->
	<section aria-labelledby="correct-heading">
		<div class="nk-stack" style="gap: var(--space-4);">
			<button
				class="nk-btn nk-btn--ghost"
				type="button"
				onclick={() => (showCorrect = !showCorrect)}
				aria-expanded={showCorrect}
				aria-controls="correct-panel"
				style="align-self: flex-start; color: var(--text-muted); font-size: var(--text-sm);"
			>
				{showCorrect ? '▲' : '▼'}
				Correct total
			</button>

			{#if showCorrect}
				<div
					id="correct-panel"
					class="nk-stack"
					style="gap: var(--space-4); padding: var(--space-4); border-radius: var(--radius-md); background: var(--surface-2); border: 1px solid var(--border);"
				>
					<p style="font-size: var(--text-sm); color: var(--text-muted); font-style: italic;">
						Use this to fix a typo, not to eat portions.
					</p>
					<div class="nk-row" style="gap: var(--space-3); align-items: center; flex-wrap: wrap;">
						<label
							for="correction-count"
							style="font-size: var(--text-sm); color: var(--text-secondary); white-space: nowrap;"
						>
							Actual portions remaining
						</label>
						<input
							id="correction-count"
							type="number"
							min="0"
							bind:value={correctionCount}
							disabled={busy}
							style="width: 5rem; min-height: var(--tap-min); padding: 0 var(--space-3); border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font-size: var(--text-base); font-family: var(--font-sans); font-variant-numeric: tabular-nums; text-align: center; transition: border-color var(--transition);"
						/>
					</div>
					<button
						class="nk-btn nk-btn--secondary"
						type="button"
						onclick={handleCorrect}
						disabled={busy}
						style="align-self: flex-start;"
					>
						{busy ? 'Saving…' : 'Update'}
					</button>
				</div>
			{/if}
		</div>
	</section>
</div>
