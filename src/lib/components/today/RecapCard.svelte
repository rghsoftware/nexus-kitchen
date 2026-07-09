<script lang="ts">
	import { mealLogName, type MealLog, type MealVerdict } from '$lib/log';
	import { mealSlotLabel } from '$lib/planning';
	import VerdictControl from '$lib/components/shared/VerdictControl.svelte';

	interface Props {
		logs: MealLog[];
		onRate: (logId: string, verdict: MealVerdict | null) => void;
	}

	let { logs, onRate }: Props = $props();

	function whenLabel(loggedAt: string): string {
		const logged = new Date(loggedAt);
		const today = new Date();
		const sameDay =
			logged.getFullYear() === today.getFullYear() &&
			logged.getMonth() === today.getMonth() &&
			logged.getDate() === today.getDate();
		return sameDay ? 'Earlier today' : 'Yesterday';
	}
</script>

<!--
	RecapCard — "How were these?" (FR-TL-017), per design/screens/web-today.html
	(.recap). Passive: appears only while recent meals are unrated; never a chore.
-->
<div class="recap nk-card">
	{#each logs as log (log.id)}
		<div class="recap__item">
			<div class="recap__row">
				<div class="recap__tile" aria-hidden="true"><i class="ph ph-bowl-steam"></i></div>
				<div class="recap__body">
					<b>{mealLogName(log)}</b>
					<span>
						{whenLabel(log.loggedAt)}{log.mealSlot
							? ` · ${mealSlotLabel(log.mealSlot).toLowerCase()}`
							: ''} · not yet rated
					</span>
				</div>
			</div>
			<VerdictControl compact value={log.verdict} onChange={(v) => onRate(log.id, v)} />
		</div>
	{/each}
</div>

<style>
	.recap {
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.recap__item {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.recap__item + .recap__item {
		padding-top: var(--space-4);
		border-top: 1px solid var(--border);
	}
	.recap__row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.recap__tile {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		font-size: 22px;
		background: var(--clay-100);
		color: var(--clay-600);
		flex: none;
	}
	.recap__body b {
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
		display: block;
	}
	.recap__body span {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
