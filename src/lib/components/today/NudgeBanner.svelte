<script lang="ts">
	import type { NudgeState } from '$lib/log';
	import { mealSlotLabel } from '$lib/planning/types';

	interface Props {
		nudge: NudgeState;
		busy?: boolean;
		onLog: () => void;
		onDismiss: () => void;
	}

	let { nudge, busy = false, onLog, onDismiss }: Props = $props();

	const slotWord = $derived(mealSlotLabel(nudge.slot).toLowerCase());
</script>

<!--
	NudgeBanner — the gentle, client-side mealtime cue (FR-TL-019), per
	design/screens/web-today.html (.reminder). A visual courtesy, not a push:
	"Not now" dismisses this slot for the rest of the day, and no copy pressures.
-->
<section class="reminder" aria-label="Mealtime reminder">
	<div class="reminder__ic" aria-hidden="true"><i class="ph ph-bell-simple-ringing"></i></div>
	<div class="reminder__txt">
		<b>It's around {slotWord}time.</b>
		<p>Your {nudge.name} is ready whenever you are. No rush.</p>
	</div>
	<div class="reminder__btns">
		<button type="button" class="nk-btn nk-btn--ghost nk-btn--sm" onclick={onDismiss}>
			Not now
		</button>
		<button type="button" class="nk-btn nk-btn--primary nk-btn--sm" disabled={busy} onclick={onLog}>
			<i class="ph ph-check" aria-hidden="true"></i> Log {slotWord}
		</button>
	</div>
</section>

<style>
	.reminder {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		margin-top: var(--space-4);
		padding: var(--space-4) var(--space-5);
		border-radius: var(--radius-lg);
		background: var(--surface);
		border: 1px solid color-mix(in oklab, var(--primary) 30%, transparent);
		box-shadow: var(--shadow-sm);
		flex-wrap: wrap;
	}
	.reminder__ic {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--primary-soft);
		color: var(--primary-text);
		display: grid;
		place-items: center;
		font-size: 24px;
		flex: none;
	}
	.reminder__txt {
		flex: 1 1 240px;
		min-width: 0;
	}
	.reminder__txt b {
		font-size: var(--text-lg);
		font-family: var(--font-display);
	}
	.reminder__txt p {
		color: var(--text-secondary);
		font-size: var(--text-sm);
		margin-top: 2px;
	}
	.reminder__btns {
		margin-left: auto;
		display: flex;
		gap: var(--space-2);
	}
	@media (max-width: 760px) {
		.reminder__btns {
			margin-left: 0;
			width: 100%;
		}
	}
</style>
