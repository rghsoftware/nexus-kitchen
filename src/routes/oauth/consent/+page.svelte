<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { OAuthAuthorizationDetails } from '@supabase/auth-js';
	import { supabase } from '$lib/supabaseClient';

	let authorization = $state<OAuthAuthorizationDetails | null>(null);
	let errorMessage = $state<string | null>(null);
	let loading = $state(true);
	let deciding = $state(false);

	const scopes = $derived(
		authorization?.scope
			?.split(' ')
			.map((scope) => scope.trim())
			.filter(Boolean) ?? []
	);

	function errorText(error: unknown): string {
		return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
	}

	onMount(() => {
		const authorizationId = page.url.searchParams.get('authorization_id');
		if (!authorizationId) {
			errorMessage =
				'This link is missing an authorization request. Start again from Claude or ChatGPT.';
			loading = false;
			return;
		}

		let active = true;
		void supabase.auth.oauth
			.getAuthorizationDetails(authorizationId)
			.then(({ data, error }) => {
				if (!active) return;
				if (error) {
					errorMessage = error.message;
					return;
				}
				if ('authorization_id' in data) {
					authorization = data;
					return;
				}
				window.location.href = data.redirect_url;
			})
			.catch((error: unknown) => {
				if (active) errorMessage = errorText(error);
			})
			.finally(() => {
				if (active) loading = false;
			});

		return () => {
			active = false;
		};
	});

	async function decide(approve: boolean) {
		if (!authorization || deciding) return;
		deciding = true;
		errorMessage = null;

		try {
			const { data, error } = approve
				? await supabase.auth.oauth.approveAuthorization(authorization.authorization_id, {
						skipBrowserRedirect: true
					})
				: await supabase.auth.oauth.denyAuthorization(authorization.authorization_id, {
						skipBrowserRedirect: true
					});
			if (error) {
				errorMessage = error.message;
				return;
			}
			window.location.href = data.redirect_url;
		} catch (error) {
			errorMessage = errorText(error);
		} finally {
			deciding = false;
		}
	}
</script>

<svelte:head>
	<title>Connect to Nexus Kitchen</title>
</svelte:head>

<main class="consent-page">
	{#if loading}
		<section class="nk-card consent-card" aria-live="polite">
			<p class="eyebrow">Connecting</p>
			<h1>Checking this request…</h1>
		</section>
	{:else if authorization}
		<section class="nk-card consent-card">
			<header>
				<p class="eyebrow">Connector access</p>
				<h1>Connect {authorization.client.name}?</h1>
				<p class="intro">
					It will be able to read and write your recipes, shopping lists and pantry.
				</p>
			</header>

			<div class="details">
				<div>
					<p class="detail-label">Return address</p>
					<p class="detail-value breakable">{authorization.redirect_uri}</p>
				</div>
				<div>
					<p class="detail-label">Requested access</p>
					{#if scopes.length > 0}
						<ul>
							{#each scopes as scope (scope)}
								<li>{scope}</li>
							{/each}
						</ul>
					{:else}
						<p class="detail-value">No additional scopes requested.</p>
					{/if}
				</div>
			</div>

			{#if errorMessage}
				<p class="error" role="alert">{errorMessage}</p>
			{/if}

			<div class="actions">
				<button
					type="button"
					class="nk-btn nk-btn--secondary"
					disabled={deciding}
					onclick={() => decide(false)}
				>
					Deny
				</button>
				<button
					type="button"
					class="nk-btn nk-btn--primary"
					disabled={deciding}
					onclick={() => decide(true)}
				>
					{deciding ? 'Connecting…' : 'Approve'}
				</button>
			</div>
		</section>
	{:else}
		<section class="nk-card consent-card" role="alert">
			<p class="eyebrow">Unable to connect</p>
			<h1>We couldn’t open this request</h1>
			<p class="error-copy">{errorMessage}</p>
		</section>
	{/if}
</main>

<style>
	.consent-page {
		display: grid;
		min-height: 100%;
		place-items: center;
		padding: var(--space-6) var(--space-4);
	}

	.consent-card {
		display: flex;
		width: min(100%, 36rem);
		flex-direction: column;
		gap: var(--space-6);
		padding: var(--space-6);
	}

	header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	h1,
	p {
		margin: 0;
	}

	h1 {
		color: var(--text);
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		line-height: var(--leading-tight);
	}

	.eyebrow,
	.detail-label {
		color: var(--text-muted);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
	}

	.eyebrow {
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}

	.intro,
	.detail-value,
	li,
	.error-copy {
		color: var(--text-secondary);
	}

	.details {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-2);
	}

	.detail-label {
		margin-bottom: var(--space-1);
	}

	.breakable {
		overflow-wrap: anywhere;
	}

	ul {
		margin: 0;
		padding-left: var(--space-5);
	}

	.error {
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-2);
		color: var(--attention);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-3);
	}

	@media (max-width: 30rem) {
		.actions {
			flex-direction: column-reverse;
		}

		.actions :global(.nk-btn) {
			width: 100%;
		}
	}
</style>
