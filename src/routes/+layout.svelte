<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import { ensureSession, sessionState } from '$lib/session/session.svelte';

	let { children } = $props();

	// Establish a session (anonymous sign-in) once, app-wide, so RLS-backed data loads work.
	$effect(() => {
		void ensureSession();
	});

	// Per design/web-*.html: full nav skeleton; unbuilt surfaces render muted (readme:
	// "Other surfaces are scaffolded in the nav but not yet designed").
	const NAV = [
		{ label: 'Today', icon: 'ph-house', href: resolve('/today') },
		{ label: 'Plan', icon: 'ph-calendar-dots', href: resolve('/plan') },
		{ label: 'Recipes', icon: 'ph-book-open', href: resolve('/recipes') },
		{ label: 'Pantry', icon: 'ph-jar', href: resolve('/pantry') },
		{ label: 'Shopping', icon: 'ph-shopping-cart-simple', href: resolve('/shopping') },
		{ label: 'Meal prep', icon: 'ph-cooking-pot', href: null }
	] as const;

	// Bottom tabs (mobile) — five slots per design/mobile-*.html. Shopping is live now,
	// so it takes the fifth slot from the still-unbuilt Meal prep surface.
	const TABS = NAV.filter((n) => n.label !== 'Meal prep');

	function tabLabel(label: string): string {
		return label === 'Meal prep' ? 'Prep' : label;
	}

	const isActive = $derived(
		(href: string | null) => href !== null && page.url.pathname.startsWith(href)
	);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="app">
	<!-- Sidebar (desktop) — per design/screens/web-calendar.html -->
	<aside class="side">
		<a class="side__logo" href={resolve('/today')}>
			<span class="side__mark" aria-hidden="true"><i class="ph-fill ph-cooking-pot"></i></span>
			<span class="side__name">Nexus <span>Kitchen</span></span>
		</a>
		<nav class="nav" aria-label="Primary">
			{#each NAV as item (item.label)}
				{#if item.href}
					<a
						class="nav__item"
						class:nav__item--active={isActive(item.href)}
						href={item.href}
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						<i class="ph {item.icon}" aria-hidden="true"></i>
						{item.label}
					</a>
				{:else}
					<span class="nav__item nav__item--soon" aria-disabled="true">
						<i class="ph {item.icon}" aria-hidden="true"></i>
						{item.label}
						<em>soon</em>
					</span>
				{/if}
			{/each}
		</nav>
	</aside>

	<div class="main">
		{#if sessionState.error}
			<div class="session-error" role="alert">{sessionState.error}</div>
		{/if}
		<div class="content">
			{@render children()}
		</div>
	</div>

	<!-- Bottom tabs (mobile) — per design/screens/mobile-calendar.html -->
	<nav class="tabs" aria-label="Primary">
		{#each TABS as item (item.label)}
			{#if item.href}
				<a
					class="tab"
					class:tab--active={isActive(item.href)}
					href={item.href}
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					<i class="ph {isActive(item.href) ? 'ph-fill' : ''} {item.icon}" aria-hidden="true"></i>
					{tabLabel(item.label)}
				</a>
			{:else}
				<span class="tab tab--soon" aria-disabled="true">
					<i class="ph {item.icon}" aria-hidden="true"></i>
					{tabLabel(item.label)}
				</span>
			{/if}
		{/each}
	</nav>
</div>

<style>
	.app {
		min-height: 100vh;
		min-height: 100dvh;
		display: grid;
		grid-template-columns: 248px 1fr;
		grid-template-rows: 1fr auto;
		background: var(--bg);
	}

	/* ---------- Sidebar ---------- */
	.side {
		grid-row: 1 / -1;
		background: var(--surface);
		border-right: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: var(--space-5) var(--space-4);
		position: sticky;
		top: 0;
		height: 100vh;
		height: 100dvh;
	}
	.side__logo {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-2) var(--space-6);
		text-decoration: none;
		color: var(--text);
	}
	.side__logo:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}
	.side__mark {
		width: 38px;
		height: 38px;
		border-radius: 11px;
		background: var(--primary);
		color: var(--text-on-accent);
		display: grid;
		place-items: center;
		font-size: 21px;
	}
	.side__name {
		font-family: var(--font-display);
		font-weight: var(--weight-bold);
		font-size: var(--text-lg);
		letter-spacing: -0.02em;
	}
	.side__name span {
		color: var(--primary-text);
	}
	.nav {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.nav__item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: 46px;
		padding: 0 var(--space-3);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
		text-decoration: none;
		transition:
			background var(--transition),
			color var(--transition);
	}
	.nav__item i {
		font-size: 1.32em;
	}
	.nav__item:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.nav__item:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.nav__item--active {
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.nav__item--soon {
		color: var(--text-muted);
		cursor: default;
	}
	.nav__item--soon:hover {
		background: transparent;
		color: var(--text-muted);
	}
	.nav__item--soon em {
		margin-left: auto;
		font-style: normal;
		font-size: var(--text-2xs);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-muted);
		background: var(--surface-2);
		padding: 2px 8px;
		border-radius: var(--radius-pill);
	}

	/* ---------- Main ---------- */
	.main {
		min-width: 0;
		display: flex;
		flex-direction: column;
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
		min-height: 0;
	}

	/* ---------- Bottom tabs (mobile) ---------- */
	.tabs {
		display: none;
		grid-column: 1 / -1;
		padding: var(--space-2) var(--space-4) max(var(--space-3), env(safe-area-inset-bottom));
		border-top: 1px solid var(--border);
		background: var(--surface);
		position: sticky;
		bottom: 0;
		z-index: 10;
	}
	.tab {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		min-height: var(--tap-min);
		justify-content: center;
		color: var(--text-muted);
		font-size: var(--text-2xs);
		font-weight: var(--weight-semibold);
		text-decoration: none;
	}
	.tab i {
		font-size: 24px;
	}
	.tab:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}
	.tab--active {
		color: var(--primary-text);
	}
	.tab--soon {
		opacity: 0.55;
	}

	@media (max-width: 760px) {
		.app {
			grid-template-columns: 1fr;
		}
		.side {
			display: none;
		}
		.tabs {
			display: flex;
		}
	}
</style>
