<script lang="ts">
	import type { DayCoverage } from '$lib/log';

	interface Props {
		coverage: DayCoverage;
	}

	let { coverage }: Props = $props();

	// Per-state icon + chip class. Icon + word always together (never color alone).
	const CHIP = {
		EATEN: { icon: 'ph-fill ph-check-circle', cls: 'cv--eaten', suffix: 'eaten' },
		HAVE_IT: { icon: 'ph ph-check-circle', cls: 'cv--have', suffix: 'have it' },
		CAN_MAKE_IT: { icon: 'ph ph-list-checks', cls: 'cv--make', suffix: 'can make' },
		MUST_ACQUIRE: { icon: 'ph ph-shopping-cart-simple', cls: 'cv--acquire', suffix: 'to get' }
	} as const;

	const allSettled = $derived(
		coverage.slots.length > 0 &&
			coverage.slots.every((s) => s.state === 'EATEN' || s.state === 'HAVE_IT')
	);
</script>

<!--
	DayCoverageCard — per-slot fulfillment rollup + one supportive sentence
	(FR-TL-005), per design/screens/web-today.html (.coverage).
-->
<section class="coverage" aria-label="Day coverage">
	<div class="coverage__ic" class:coverage__ic--attention={!allSettled} aria-hidden="true">
		<i class="ph {allSettled ? 'ph-check-circle' : 'ph-hand-waving'}"></i>
	</div>
	<div class="coverage__txt">
		<b>{coverage.headline}</b>
		<p>{coverage.detail}</p>
	</div>
	{#if coverage.slots.length > 0}
		<div class="coverage__meals">
			{#each coverage.slots as slot (slot.label)}
				<span class="cv {CHIP[slot.state].cls}">
					<i class="ph {CHIP[slot.state].icon}" aria-hidden="true"></i>
					{slot.label} · {CHIP[slot.state].suffix}
				</span>
			{/each}
		</div>
	{/if}
</section>

<style>
	.coverage {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		margin-top: var(--space-6);
		padding: var(--space-4) var(--space-5);
		border-radius: var(--radius-lg);
		background: var(--surface);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-sm);
		flex-wrap: wrap;
	}
	.coverage__ic {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--have-soft);
		color: var(--have);
		display: grid;
		place-items: center;
		font-size: 24px;
		flex: none;
	}
	.coverage__ic--attention {
		background: var(--surface-2);
		color: var(--text-secondary);
	}
	.coverage__txt {
		flex: 1 1 300px;
		min-width: 0;
	}
	.coverage__txt b {
		font-size: var(--text-lg);
		font-family: var(--font-display);
	}
	.coverage__txt p {
		color: var(--text-secondary);
		font-size: var(--text-sm);
		margin-top: 2px;
	}
	.coverage__meals {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.cv {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		padding: 6px 11px;
		border-radius: var(--radius-pill);
	}
	.cv--eaten {
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.cv--have {
		background: var(--have-soft);
		color: var(--have-text);
	}
	.cv--make {
		background: var(--make-soft);
		color: var(--make-text);
	}
	.cv--acquire {
		background: var(--acquire-soft);
		color: var(--acquire-text);
	}
	:global([data-theme='dark']) .cv {
		filter: brightness(1.06);
	}
</style>
