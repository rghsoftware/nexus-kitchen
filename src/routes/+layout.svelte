<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import { restoreSession, sessionState } from '$lib/session/session.svelte';

	let { children } = $props();

	const SIGNIN = resolve('/signin');
	const HOME = resolve('/today');
	const ACCOUNT = resolve('/account');

	// Restore any persisted session once, app-wide, before the guard decides anything.
	$effect(() => {
		void restoreSession();
	});

	// Routes reachable without a session. Everything else is RLS-backed and pointless
	// signed out, so the guard sends you to /signin rather than rendering empty states.
	const isPublic = $derived(page.url.pathname.startsWith(SIGNIN));
	const signedIn = $derived(sessionState.user !== null);
	// Gate rendering on `ready` so a returning user with a valid stored session never
	// sees a flash of the sign-in wall while getSession() settles.
	const showApp = $derived(sessionState.ready && signedIn && !isPublic);

	/**
	 * Resolve a `?next=` value to a same-origin path, falling back to the home surface.
	 *
	 * Parsed rather than prefix-matched: string checks like `startsWith('/')` miss the
	 * shapes the URL parser normalises away — `/\evil.com` and a tab-prefixed `/<TAB>/evil.com`
	 * both resolve to a foreign origin while looking relative. SvelteKit refuses to
	 * navigate off-origin anyway, but that rejection would strand a signed-in user on the
	 * sign-in wall, so the value is rejected here instead of failing later.
	 */
	function safeNext(next: string | null): string {
		if (!next) return HOME;
		try {
			const target = new URL(next, page.url.origin);
			if (target.origin !== page.url.origin) return HOME;
			return target.pathname + target.search;
		} catch {
			return HOME;
		}
	}

	function reportFailedRedirect(err: unknown) {
		// A swallowed rejection here leaves the user staring at the wrong surface with no
		// clue why, and the effect won't re-run to try again.
		console.error('[guard] redirect failed', err);
	}

	$effect(() => {
		if (!sessionState.ready) return;

		if (!signedIn && !isPublic) {
			// Remember where they were headed so sign-in can hand them back to it. /today is
			// the default landing spot, so carrying a ?next= for it would just be noise.
			const intended = page.url.pathname + page.url.search;
			const next = intended === HOME ? '' : `?next=${encodeURIComponent(intended)}`;
			// SIGNIN is already resolve('/signin'); resolve() takes a route id, not a
			// query string, so the concatenation below can't be expressed through it.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(`${SIGNIN}${next}`, { replaceState: true }).catch(reportFailedRedirect);
			return;
		}

		if (signedIn && isPublic) {
			// `safe` is a runtime path (validated below) or the already-resolved HOME;
			// neither is a static route id that resolve() can accept.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(safeNext(page.url.searchParams.get('next')), { replaceState: true }).catch(
				reportFailedRedirect
			);
		}
	});

	// Per design/web-*.html: full nav skeleton; unbuilt surfaces render muted (readme:
	// "Other surfaces are scaffolded in the nav but not yet designed").
	const NAV = [
		{ label: 'Today', icon: 'ph-house', href: resolve('/today') },
		{ label: 'Plan', icon: 'ph-calendar-dots', href: resolve('/plan') },
		{ label: 'Recipes', icon: 'ph-book-open', href: resolve('/recipes') },
		{ label: 'Pantry', icon: 'ph-jar', href: resolve('/pantry') },
		{ label: 'Shopping', icon: 'ph-shopping-cart-simple', href: resolve('/shopping') },
		{ label: 'Nudges', icon: 'ph-bell-simple-ringing', href: resolve('/reminders') },
		{ label: 'Meal prep', icon: 'ph-cooking-pot', href: null }
	] as const;

	// Bottom tabs (mobile) — five slots per design/mobile-*.html. Shopping is live now,
	// so it takes the fifth slot from the still-unbuilt Meal prep surface. Nudges is
	// reachable on mobile from the Today header bell instead of a tab.
	const TABS = NAV.filter((n) => n.label !== 'Meal prep' && n.label !== 'Nudges');

	function tabLabel(label: string): string {
		return label === 'Meal prep' ? 'Prep' : label;
	}

	const isActive = $derived(
		(href: string | null) => href !== null && page.url.pathname.startsWith(href)
	);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if isPublic}
	<!-- Sign-in wall: no app chrome, since none of it is reachable yet. -->
	{@render children()}
{:else if showApp}
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

			<!-- Account sits at the foot of the sidebar; mobile reaches it from the
			     Today header, since the five tab slots are already spoken for. -->
			<a
				class="side__account"
				class:side__account--active={isActive(ACCOUNT)}
				href={ACCOUNT}
				aria-current={isActive(ACCOUNT) ? 'page' : undefined}
			>
				<i class="ph ph-user-circle" aria-hidden="true"></i>
				<span class="side__account__txt">
					<span class="side__account__label">Account</span>
					{#if sessionState.user?.email}
						<span class="side__account__email">{sessionState.user.email}</span>
					{/if}
				</span>
			</a>
		</aside>

		<div class="main">
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
{:else}
	<!-- Session still resolving, or a redirect to /signin is in flight. Deliberately
	     quiet: no chrome, no flash of protected content. -->
	<div class="boot" role="status">
		<span class="boot__dot" aria-hidden="true"></span>
		<span class="boot__txt">Warming up the kitchen…</span>
	</div>
{/if}

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
	.side__account {
		margin-top: auto;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--tap-min);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		border-top: 1px solid var(--border);
		color: var(--text-secondary);
		text-decoration: none;
		transition:
			background var(--transition),
			color var(--transition);
	}
	.side__account i {
		font-size: 1.5em;
		flex-shrink: 0;
	}
	.side__account:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.side__account:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.side__account--active {
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.side__account__txt {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.side__account__label {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
	}
	.side__account__email {
		font-size: var(--text-2xs);
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
	.content {
		flex: 1;
		min-height: 0;
	}

	/* ---------- Boot / redirect-in-flight ---------- */
	.boot {
		min-height: 100vh;
		min-height: 100dvh;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: var(--space-4);
		background: var(--bg);
	}
	.boot__dot {
		width: 12px;
		height: 12px;
		border-radius: var(--radius-pill);
		background: var(--primary);
		animation: boot-pulse 1.4s ease-in-out infinite;
	}
	.boot__txt {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	@keyframes boot-pulse {
		0%,
		100% {
			opacity: 0.35;
			transform: scale(0.85);
		}
		50% {
			opacity: 1;
			transform: scale(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.boot__dot {
			animation: none;
			opacity: 0.7;
		}
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
