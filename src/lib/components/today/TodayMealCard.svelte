<script lang="ts">
	import { resolve } from '$app/paths';
	import { fulfillmentFor, plannedMealName, mealSlotLabel } from '$lib/planning';
	import type { PlannedMeal } from '$lib/planning';
	import type { MealLog, MealVerdict } from '$lib/log';
	import VerdictControl from '$lib/components/shared/VerdictControl.svelte';

	interface Props {
		meal: PlannedMeal;
		/** Today's log for this planned meal, when it has been eaten. */
		log: MealLog | null;
		/** Portions left when the meal points at a prepped portion. */
		preppedPortionsLeft?: number | null;
		busy?: boolean;
		onLog: () => void;
		onRate: (logId: string, verdict: MealVerdict | null) => void;
	}

	let { meal, log, preppedPortionsLeft = null, busy = false, onLog, onRate }: Props = $props();

	const name = $derived(plannedMealName(meal));
	const eaten = $derived(log !== null || meal.status === 'LOGGED');

	const SLOT_ICON = {
		BREAKFAST: 'ph-coffee',
		LUNCH: 'ph-bowl-food',
		DINNER: 'ph-fork-knife',
		SNACK: 'ph-orange-slice'
	} as const;
	const slotIcon = $derived(meal.mealSlot ? SLOT_ICON[meal.mealSlot] : 'ph-sun-horizon');

	const SOURCE_ICON = {
		RECIPE: 'ph-cooking-pot',
		STORE_BOUGHT: 'ph-shopping-bag',
		QUICK: 'ph-lightning',
		PREPPED: 'ph-snowflake'
	} as const;

	const fulfillment = $derived(fulfillmentFor(meal));
	const FULFILLMENT = {
		HAVE_IT: { label: 'Have it', icon: 'ph-check-circle', cls: 'req--have', tile: 'tile--have' },
		CAN_MAKE_IT: {
			label: 'Can make it',
			icon: 'ph-list-checks',
			cls: 'req--make',
			tile: 'tile--make'
		},
		MUST_ACQUIRE: {
			label: 'Need to get',
			icon: 'ph-shopping-cart-simple',
			cls: 'req--acquire',
			tile: 'tile--acquire'
		}
	} as const;
	const req = $derived(fulfillment === null ? null : FULFILLMENT[fulfillment.state]);
	const tileCls = $derived(eaten ? 'tile--eaten' : (req?.tile ?? 'tile--plain'));

	const eatenTime = $derived(
		log
			? new Date(log.loggedAt).toLocaleTimeString(undefined, {
					hour: 'numeric',
					minute: '2-digit'
				})
			: null
	);
</script>

<!--
	TodayMealCard — one slot card (FR-TL-003/004), per design/screens/web-today.html
	(.meal). Exactly one primary action: Log it (coverable) or Add to list
	(MUST_ACQUIRE). Once eaten: state line + optional inline verdict (FR-TL-015).
-->
<article class="meal" aria-label="{mealSlotLabel(meal.mealSlot)}: {name}">
	<div class="meal__slot">
		<i class="ph {slotIcon}" aria-hidden="true"></i>
		{mealSlotLabel(meal.mealSlot)}
	</div>
	<div class="meal__tile {tileCls}" aria-hidden="true">
		<i class="ph {SOURCE_ICON[meal.source]}"></i>
	</div>
	<div class="meal__name">{name}</div>
	<div class="meal__foot">
		{#if eaten}
			<span class="state state--eaten">
				<i class="ph-fill ph-check-circle" aria-hidden="true"></i>
				Eaten{eatenTime ? ` · ${eatenTime}` : ''}
			</span>
			{#if log && log.verdict === 'KEEP'}
				<span class="nk-verdict-mark nk-verdict-mark--keep">
					<i class="ph-fill ph-heart" aria-hidden="true"></i> Keeper
				</span>
			{:else if log && log.verdict === 'REST'}
				<span class="nk-verdict-mark nk-verdict-mark--rest">
					<i class="ph ph-moon" aria-hidden="true"></i> Set aside
				</span>
			{:else if log && log.verdict === null}
				<div class="meal__rate">
					<span class="meal__rate-q">How was it?</span>
					<VerdictControl compact value={log.verdict} onChange={(v) => onRate(log.id, v)} />
				</div>
			{/if}
		{:else}
			<div class="meal__meta">
				{#if req}
					<span class="req {req.cls}">
						<i class="ph {req.icon}" aria-hidden="true"></i>
						{req.label}
					</span>
				{/if}
				{#if meal.source === 'PREPPED' && preppedPortionsLeft !== null}
					<span class="tag tag--prepped">
						<i class="ph ph-snowflake" aria-hidden="true"></i>
						Prepped · {preppedPortionsLeft} left
					</span>
				{/if}
			</div>
			<div class="meal__log">
				{#if fulfillment?.state === 'MUST_ACQUIRE'}
					<a class="nk-btn nk-btn--secondary nk-btn--sm nk-btn--block" href={resolve('/shopping')}>
						<i class="ph ph-plus" aria-hidden="true"></i> Add to list
					</a>
				{:else}
					<button
						type="button"
						class="nk-btn nk-btn--secondary nk-btn--sm nk-btn--block"
						disabled={busy}
						onclick={onLog}
					>
						<i class="ph ph-check" aria-hidden="true"></i> Log it
					</button>
				{/if}
			</div>
		{/if}
	</div>
</article>

<style>
	.meal {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
		box-shadow: var(--shadow-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		min-height: 168px;
	}
	.meal__slot {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.meal__tile {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		font-size: 24px;
	}
	.tile--have,
	.tile--eaten {
		background: var(--have-soft);
		color: var(--have-text);
	}
	.tile--make {
		background: var(--make-soft);
		color: var(--make-text);
	}
	.tile--acquire {
		background: var(--acquire-soft);
		color: var(--acquire-text);
	}
	.tile--plain {
		background: var(--surface-2);
		color: var(--text-secondary);
	}
	.meal__name {
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
	}
	.meal__foot {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.state {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
	}
	.state--eaten {
		color: var(--primary-text);
	}
	.meal__meta {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.req {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
	}
	.req--have {
		color: var(--have-text);
	}
	.req--make {
		color: var(--make-text);
	}
	.req--acquire {
		color: var(--acquire-text);
	}
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--text-2xs);
		font-weight: var(--weight-bold);
		padding: 3px 8px;
		border-radius: var(--radius-pill);
	}
	.tag--prepped {
		background: var(--info-soft);
		color: var(--info);
	}
	.meal__rate {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--border);
	}
	.meal__rate-q {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--text-secondary);
	}
	:global([data-theme='dark']) .req {
		filter: brightness(1.06);
	}
</style>
