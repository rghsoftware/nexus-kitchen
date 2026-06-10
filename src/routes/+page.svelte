<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	// The Today dashboard isn't built yet; Plan is the app's home surface for now
	// (per the differentiator: planning is how demand is expressed).
	$effect(() => {
		void goto(resolve('/plan'), { replaceState: true });
	});
</script>

<p class="redirect">Opening your plan…</p>

<style>
	.redirect {
		padding: var(--space-6);
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
</style>
