<script lang="ts">
	import './layout.css';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import { ensureSession, sessionState } from '$lib/session/session.svelte';

	let { children } = $props();

	// Establish a session (anonymous sign-in) once, app-wide, so RLS-backed data loads work.
	$effect(() => {
		void ensureSession();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="app">
	<header class="topbar">
		<a class="brand" href={resolve('/')}>Nexus Kitchen</a>
		<nav class="nav" aria-label="Primary">
			<a class="nk-btn nk-btn--ghost nk-btn--sm" href={resolve('/plan')}>Plan</a>
			<a class="nk-btn nk-btn--ghost nk-btn--sm" href={resolve('/recipes')}>Recipes</a>
		</nav>
	</header>
	{#if sessionState.error}
		<div class="session-error" role="alert">{sessionState.error}</div>
	{/if}
	<div class="content">
		{@render children()}
	</div>
</div>

<style>
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-5);
		border-bottom: 1px solid var(--border);
		background: var(--surface);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.brand {
		font-family: var(--font-display);
		font-weight: var(--weight-bold);
		font-size: var(--text-lg);
		color: var(--text);
		text-decoration: none;
	}
	.brand:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}
	.session-error {
		padding: var(--space-3) var(--space-5);
		background: var(--attention-soft);
		color: var(--attention);
		font-size: var(--text-sm);
		text-align: center;
	}
	.content {
		flex: 1;
	}
</style>
