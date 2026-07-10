<script lang="ts">
	import {
		logError,
		slotForTime,
		verdictLabel,
		type LoggedSource,
		type MealVerdict
	} from '$lib/log';
	import { MEAL_SLOTS, mealSlotLabel, type MealSlot } from '$lib/planning';
	import type { PreppedMeal } from '$lib/pantry/types';
	import VerdictControl from '$lib/components/shared/VerdictControl.svelte';

	interface Props {
		preppedReady: PreppedMeal[];
		recents: LoggedSource[];
		keepers: LoggedSource[];
		busy?: boolean;
		onClose: () => void;
		onLogSomething: (slot: MealSlot, verdict: MealVerdict | null) => void;
		onLogPrepped: (
			meal: Pick<PreppedMeal, 'id' | 'name'>,
			slot: MealSlot,
			verdict: MealVerdict | null
		) => void;
		onLogSource: (source: LoggedSource, slot: MealSlot, verdict: MealVerdict | null) => void;
	}

	let {
		preppedReady,
		recents,
		keepers,
		busy = false,
		onClose,
		onLogSomething,
		onLogPrepped,
		onLogSource
	}: Props = $props();

	let slot = $state<MealSlot>(slotForTime(new Date()));
	let verdict = $state<MealVerdict | null>(null);

	let panel = $state<HTMLElement | null>(null);

	// Focus management (research R9): focus moves into the sheet on open and back
	// to the invoking control on close. Parent marks the page shell `inert`.
	$effect(() => {
		const opener = document.activeElement as HTMLElement | null;
		panel?.querySelector<HTMLElement>('button')?.focus();
		return () => opener?.focus();
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
		}
	}

	function verdictMark(source: LoggedSource): { cls: string; icon: string; label: string } | null {
		if (source.latestVerdict === 'KEEP') {
			return { cls: 'nk-verdict-mark--keep', icon: 'ph-fill ph-heart', label: 'Keeper' };
		}
		if (source.latestVerdict === 'REST') {
			return { cls: 'nk-verdict-mark--rest', icon: 'ph ph-moon', label: 'You set this aside' };
		}
		return null;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!--
	QuickLogSheet — "Log a meal" (FR-TL-011), per design/screens/mobile-log.html.
	Slot picker defaults to the current mealtime; every path is a tap or two, the
	verdict footer is optional, and nothing requires typing (REQ-MR-008/009).
-->
<div
	class="overlay"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="Log a meal" bind:this={panel}>
		<div class="sheet__grip" aria-hidden="true"></div>
		<div class="sheet__head">
			<h2>Log a meal</h2>
			<button type="button" class="close" aria-label="Close" onclick={onClose}>
				<i class="ph ph-x" aria-hidden="true"></i>
			</button>
		</div>

		<div class="sheet__body">
			{#if logError()}
				<div class="sheet__error" role="alert">{logError()}</div>
			{/if}
			<div class="slotpick" role="group" aria-label="Meal slot">
				{#each MEAL_SLOTS as option (option)}
					<button type="button" aria-pressed={slot === option} onclick={() => (slot = option)}>
						{mealSlotLabel(option)}
					</button>
				{/each}
			</div>

			<button
				type="button"
				class="something"
				disabled={busy}
				onclick={() => onLogSomething(slot, verdict)}
			>
				<span class="something__ic" aria-hidden="true"><i class="ph ph-check-fat"></i></span>
				<span>
					<b>I ate something</b>
					<span class="something__sub">No details needed — just marking it done.</span>
				</span>
			</button>

			{#if preppedReady.length > 0}
				<div class="grp-label">
					<i class="ph ph-snowflake grp-label__info" aria-hidden="true"></i> From your prepped meals
				</div>
				{#each preppedReady as meal (meal.id)}
					<button
						type="button"
						class="opt"
						disabled={busy}
						onclick={() => onLogPrepped(meal, slot, verdict)}
					>
						<span class="opt__tile" aria-hidden="true"><i class="ph ph-cooking-pot"></i></span>
						<span class="opt__body">
							<span class="opt__name">{meal.name}</span>
							<span class="opt__meta">
								<span class="tag"><i class="ph ph-snowflake" aria-hidden="true"></i> Prepped</span>
								{meal.portions_remaining} portion{meal.portions_remaining === 1 ? '' : 's'} left
							</span>
						</span>
						<span class="opt__add" aria-hidden="true"><i class="ph ph-plus"></i></span>
					</button>
				{/each}
			{/if}

			{#if recents.length > 0}
				<div class="grp-label">
					<i class="ph ph-clock-counter-clockwise" aria-hidden="true"></i> Recent
				</div>
				{#each recents as source (source.key)}
					{@const mark = verdictMark(source)}
					<button
						type="button"
						class="opt"
						disabled={busy}
						onclick={() => onLogSource(source, slot, verdict)}
					>
						<span class="opt__tile opt__tile--recent" aria-hidden="true">
							<i class="ph ph-fork-knife"></i>
						</span>
						<span class="opt__body">
							<span class="opt__name">{source.name}</span>
							<span class="opt__meta">
								{#if mark}
									<span class="nk-verdict-mark {mark.cls}">
										<i class={mark.icon} aria-hidden="true"></i>
										{mark.label}
									</span>
								{/if}
								{source.lastSlot ? mealSlotLabel(source.lastSlot).toLowerCase() : 'meal'}
							</span>
						</span>
						<span class="opt__add" aria-hidden="true"><i class="ph ph-plus"></i></span>
					</button>
				{/each}
			{/if}

			{#if keepers.length > 0}
				<div class="grp-label">
					<i class="ph-fill ph-heart grp-label__keep" aria-hidden="true"></i> Keepers · meals you'd make
					again
				</div>
				{#each keepers as source (source.key)}
					<button
						type="button"
						class="opt"
						disabled={busy}
						onclick={() => onLogSource(source, slot, verdict)}
					>
						<span class="opt__tile opt__tile--keeper" aria-hidden="true">
							<i class="ph ph-fork-knife"></i>
						</span>
						<span class="opt__body">
							<span class="opt__name">{source.name}</span>
							<span class="opt__meta">
								<span class="nk-verdict-mark nk-verdict-mark--keep">
									<i class="ph-fill ph-heart" aria-hidden="true"></i> Keeper
								</span>
								made {source.timesMade} time{source.timesMade === 1 ? '' : 's'}
							</span>
						</span>
						<span class="opt__add" aria-hidden="true"><i class="ph ph-plus"></i></span>
					</button>
				{/each}
			{/if}
		</div>

		<div class="efoot">
			<div class="efoot__q">
				How was it? <span>— optional, so you remember next time</span>
			</div>
			<VerdictControl compact value={verdict} onChange={(v) => (verdict = v)} />
			<div class="efoot__skip">
				{verdict
					? `Saving as “${verdictLabel(verdict)}”.`
					: 'No rush — you can set this anytime later too.'}
			</div>
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: oklch(0.2 0.02 70 / 0.42);
		backdrop-filter: blur(2px);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.sheet {
		width: 100%;
		max-width: 560px;
		max-height: 88dvh;
		background: var(--surface);
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		box-shadow: var(--shadow-xl);
		display: flex;
		flex-direction: column;
	}
	@media (min-width: 761px) {
		.overlay {
			align-items: center;
			padding: var(--space-6);
		}
		.sheet {
			border-radius: var(--radius-xl);
			max-height: 82dvh;
		}
	}
	.sheet__grip {
		width: 44px;
		height: 5px;
		background: var(--border-strong);
		border-radius: 3px;
		margin: var(--space-3) auto var(--space-2);
		flex: none;
	}
	.sheet__head {
		padding: var(--space-2) var(--space-5) var(--space-3);
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex: none;
	}
	.sheet__head h2 {
		font-size: var(--text-xl);
		font-family: var(--font-display);
		margin: 0;
	}
	.close {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--surface-2);
		border: none;
		color: var(--text-secondary);
		display: grid;
		place-items: center;
		font-size: 1.2em;
		cursor: pointer;
	}
	.close:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.sheet__body {
		overflow-y: auto;
		padding: 0 var(--space-5) var(--space-4);
	}
	.sheet__error {
		margin-bottom: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		background: var(--attention-soft);
		color: var(--attention);
		font-size: var(--text-sm);
	}

	.slotpick {
		display: flex;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
	}
	.slotpick button {
		flex: 1;
		min-height: 40px;
		border-radius: var(--radius-pill);
		border: 1.5px solid var(--border);
		background: var(--surface);
		color: var(--text-secondary);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
		font-family: var(--font-sans);
		cursor: pointer;
	}
	.slotpick button[aria-pressed='true'] {
		background: var(--primary-soft);
		border-color: var(--primary);
		color: var(--primary-text);
	}
	.slotpick button:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.grp-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-muted);
		margin: var(--space-4) 0 var(--space-3);
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.grp-label i {
		font-size: 1.1em;
	}
	.grp-label__info {
		color: var(--info);
	}
	.grp-label__keep {
		color: var(--verdict-keep);
	}

	.opt {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		margin-bottom: var(--space-2);
		text-align: left;
		font-family: var(--font-sans);
		cursor: pointer;
	}
	.opt:hover {
		border-color: var(--border-strong);
	}
	.opt:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.opt__tile {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-sm);
		display: grid;
		place-items: center;
		font-size: 22px;
		flex: none;
		background: var(--have-soft);
		color: var(--have-text);
	}
	.opt__tile--recent {
		background: var(--surface-2);
		color: var(--text-secondary);
	}
	.opt__tile--keeper {
		background: var(--make-soft);
		color: var(--make-text);
	}
	.opt__body {
		flex: 1;
		min-width: 0;
	}
	.opt__name {
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
		display: block;
	}
	.opt__meta {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-top: 1px;
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.opt__add {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--primary-soft);
		color: var(--primary-text);
		display: grid;
		place-items: center;
		flex: none;
		font-size: 1.1em;
	}
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: var(--text-2xs);
		font-weight: var(--weight-bold);
		padding: 2px 6px;
		border-radius: var(--radius-pill);
		background: var(--info-soft);
		color: var(--info);
	}

	.something {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-4);
		border: 1.5px dashed var(--border-strong);
		border-radius: var(--radius-md);
		background: var(--surface-2);
		font-family: var(--font-sans);
		margin-top: var(--space-1);
		text-align: left;
		cursor: pointer;
	}
	.something:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.something__ic {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--surface);
		color: var(--text-secondary);
		display: grid;
		place-items: center;
		font-size: 22px;
		flex: none;
	}
	.something b {
		font-size: var(--text-base);
	}
	.something__sub {
		display: block;
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin-top: 1px;
		font-weight: var(--weight-regular);
	}

	.efoot {
		flex: none;
		border-top: 1px solid var(--border);
		padding: var(--space-4) var(--space-5) var(--space-4);
		background: var(--surface);
		border-radius: 0 0 var(--radius-xl) var(--radius-xl);
	}
	.efoot__q {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		font-weight: var(--weight-semibold);
		margin-bottom: var(--space-3);
	}
	.efoot__q span {
		color: var(--text-muted);
		font-weight: var(--weight-medium);
	}
	.efoot__skip {
		font-size: var(--text-2xs);
		color: var(--text-muted);
		text-align: center;
		margin-top: var(--space-3);
	}
</style>
