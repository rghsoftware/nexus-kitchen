<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PreppedMeal, PantryItem } from '$lib/pantry/types';

	interface Props {
		expiringPrepped: PreppedMeal[];
		lowStock: PantryItem[];
	}

	let { expiringPrepped, lowStock }: Props = $props();

	function bestBy(dateISO: string): string {
		return new Date(`${dateISO}T00:00:00`).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<!--
	AttentionList — "when you have a moment" (FR-TL-008), per
	design/screens/web-today.html (.attention). Surfaces what's about to turn
	(differentiator) as invitations, never as chores or failures.
-->
<div class="attention">
	<div class="attention__h">
		<i class="ph ph-hand-waving" aria-hidden="true"></i> When you have a moment
	</div>
	{#each expiringPrepped as meal (meal.id)}
		<div class="att-item">
			<i class="ph ph-snowflake" aria-hidden="true"></i>
			<span>
				<b>{meal.name}</b> — {meal.portions_remaining}
				portion{meal.portions_remaining === 1 ? '' : 's'}, best by {bestBy(meal.expiration_date)}
			</span>
			<a href={resolve('/plan')}>Plan it in</a>
		</div>
	{/each}
	{#each lowStock as item (item.id)}
		<div class="att-item">
			<i class="ph ph-package" aria-hidden="true"></i>
			<span><b>{item.name}</b> is running low</span>
			<a href={resolve('/shopping')}>Add to list</a>
		</div>
	{/each}
</div>

<style>
	.attention {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
	}
	.attention__h {
		padding: var(--space-4) var(--space-4) var(--space-3);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: var(--weight-bold);
		font-size: var(--text-base);
	}
	.attention__h i {
		color: var(--attention);
	}
	.att-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-top: 1px solid var(--border);
		font-size: var(--text-sm);
	}
	.att-item i {
		color: var(--attention);
		font-size: 1.2em;
		flex: none;
	}
	.att-item span {
		flex: 1;
		min-width: 0;
	}
	.att-item span b {
		font-weight: var(--weight-bold);
	}
	.att-item a {
		margin-left: auto;
		color: var(--primary-text);
		font-weight: var(--weight-bold);
		text-decoration: none;
		font-size: var(--text-sm);
		flex: none;
	}
	.att-item a:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}
</style>
