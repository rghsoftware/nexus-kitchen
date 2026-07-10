<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	// Today is the app's home surface (feature 006, FR-TL-001).
	$effect(() => {
		void goto(resolve('/today'), { replaceState: true });
	});
</script>

<p class="redirect">Opening your day…</p>

<style>
	.redirect {
		padding: var(--space-6);
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
</style>
