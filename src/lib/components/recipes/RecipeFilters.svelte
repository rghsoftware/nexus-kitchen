<script lang="ts">
	export type LibraryFilter = 'all' | 'favorites' | 'quick';

	let {
		mode = $bindable(),
		activeTags = $bindable(),
		availableTags = []
	}: {
		mode: LibraryFilter;
		activeTags: string[];
		availableTags?: string[];
	} = $props();

	const MODES: { id: LibraryFilter; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'favorites', label: 'Favorites' },
		{ id: 'quick', label: 'Quick · under 30 min' }
	];

	function toggleTag(tag: string) {
		activeTags = activeTags.includes(tag)
			? activeTags.filter((t) => t !== tag)
			: [...activeTags, tag];
	}
</script>

<div class="filters nk-scroll" role="group" aria-label="Filter recipes">
	{#each MODES as m (m.id)}
		<button
			type="button"
			class="nk-chip filter"
			class:selected={mode === m.id}
			aria-pressed={mode === m.id}
			onclick={() => (mode = m.id)}>{m.label}</button
		>
	{/each}

	{#if availableTags.length > 0}
		<span class="divider" aria-hidden="true"></span>
		{#each availableTags as tag (tag)}
			<button
				type="button"
				class="nk-chip filter"
				class:selected={activeTags.includes(tag)}
				aria-pressed={activeTags.includes(tag)}
				onclick={() => toggleTag(tag)}>{tag}</button
			>
		{/each}
	{/if}
</div>

<style>
	.filters {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		overflow-x: auto;
		padding-bottom: var(--space-2);
	}
	.filter {
		cursor: pointer;
		white-space: nowrap;
		flex: 0 0 auto;
		min-height: var(--tap-min); /* accessibility tap floor (REQ-AC-002) */
	}
	.filter.selected {
		background: var(--primary-soft);
		color: var(--primary-text);
		border-color: var(--primary);
	}
	.filter:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
	}
	.divider {
		width: 1px;
		align-self: stretch;
		background: var(--border);
		margin: 0 var(--space-1);
		flex: 0 0 auto;
	}
</style>
