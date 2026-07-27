<script lang="ts">
	import { resolve } from '$app/paths';
	import { AuthFailure, MIN_PASSWORD_LENGTH, signOut, updatePassword } from '$lib/auth';
	import { clearRecovering, sessionState } from '$lib/session/session.svelte';

	let password = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let saved = $state(false);

	const email = $derived(sessionState.user?.email ?? '');
	// Set when the user arrived via a password-reset link: supabase-js turns the tokens
	// in the URL fragment into a session and fires PASSWORD_RECOVERY, so by the time we
	// render they are authenticated and simply need to choose a new password.
	const recovering = $derived(sessionState.recovering);

	async function onSetPassword(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		// Cleared before the validation check too, or a rejected retry after one success
		// renders "Password updated." alongside the error.
		saved = false;
		if (password.length < MIN_PASSWORD_LENGTH) {
			error = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
			return;
		}

		busy = true;
		error = null;
		try {
			await updatePassword(password);
			password = '';
			saved = true;
			clearRecovering();
		} catch (err) {
			console.error(
				'[auth] password update failed:',
				err instanceof AuthFailure ? (err.cause ?? err) : err
			);
			error = err instanceof AuthFailure ? err.message : 'Something went wrong. Please try again.';
		} finally {
			busy = false;
		}
	}

	async function onSignOut() {
		if (busy) return;
		busy = true;
		error = null;
		try {
			// The layout guard sees the cleared session and routes to /signin.
			await signOut();
		} catch (err) {
			console.error(
				'[auth] sign-out failed:',
				err instanceof AuthFailure ? (err.cause ?? err) : err
			);
			error = err instanceof AuthFailure ? err.message : "We couldn't sign you out. Try again?";
			busy = false;
		}
	}
</script>

<!--
	AccountPanel — the signed-in user's account surface (feature 008): who you are, how to
	change your password, and how to leave. Doubles as the landing spot for password
	recovery links, which is why the "set a new password" form leads when recovering.
-->
<svelte:head><title>Account · Nexus Kitchen</title></svelte:head>

<div class="account nk-scroll">
	<div class="wrap">
		<header class="navbar">
			<a class="navbar__back" href={resolve('/today')} aria-label="Back to Today">
				<i class="ph ph-arrow-left" aria-hidden="true"></i>
			</a>
			<h1 class="navbar__title">Account</h1>
		</header>

		<section class="nk-card who">
			<div class="who__ic" aria-hidden="true"><i class="ph ph-user-circle"></i></div>
			<div>
				<p class="who__label">Signed in as</p>
				<p class="who__email">{email}</p>
			</div>
		</section>

		<section class="nk-card">
			<h2 class="section__title">
				{recovering ? 'Choose a new password' : 'Change your password'}
			</h2>
			{#if recovering}
				<p class="section__lede">Your reset link worked. Pick something new and you're set.</p>
			{/if}

			<form onsubmit={onSetPassword} novalidate>
				<label class="field__label" for="account-password">New password</label>
				<input
					id="account-password"
					class="field__input"
					type="password"
					autocomplete="new-password"
					aria-describedby="account-password-hint"
					disabled={busy}
					bind:value={password}
				/>
				<p class="field__hint" id="account-password-hint">
					At least {MIN_PASSWORD_LENGTH} characters.
				</p>

				{#if error}
					<p class="banner" role="alert">{error}</p>
				{/if}
				{#if saved}
					<p class="banner banner--ok" role="status">Password updated.</p>
				{/if}

				<button type="submit" class="nk-btn nk-btn--primary" disabled={busy}>
					{busy ? 'Saving…' : 'Update password'}
				</button>
			</form>
		</section>

		<section class="nk-card">
			<h2 class="section__title">Sign out</h2>
			<p class="section__lede">
				Your recipes, plans and pantry stay put — sign back in anytime to pick up where you left
				off.
			</p>
			<button type="button" class="nk-btn nk-btn--secondary" disabled={busy} onclick={onSignOut}>
				Sign out
			</button>
		</section>
	</div>
</div>

<style>
	.account {
		height: 100%;
		overflow-y: auto;
		background: var(--bg);
	}
	.wrap {
		max-width: 560px;
		margin: 0 auto;
		padding: var(--space-5) var(--space-5) var(--space-10);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.navbar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}
	.navbar__back {
		width: var(--tap-min);
		height: var(--tap-min);
		display: grid;
		place-items: center;
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		text-decoration: none;
		font-size: var(--text-xl);
	}
	.navbar__back:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.navbar__back:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.navbar__title {
		font-family: var(--font-display);
		font-size: var(--text-xl);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-tight);
		color: var(--text);
		margin: 0;
	}

	.who {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.who__ic {
		font-size: 34px;
		color: var(--primary-text);
		line-height: 1;
	}
	.who__label {
		font-size: var(--text-2xs);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: var(--text-muted);
		margin: 0 0 2px;
	}
	.who__email {
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
		color: var(--text);
		margin: 0;
		overflow-wrap: anywhere;
	}

	.section__title {
		font-family: var(--font-display);
		font-size: var(--text-md);
		font-weight: var(--weight-bold);
		color: var(--text);
		margin: 0 0 var(--space-2);
	}
	.section__lede {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-relaxed);
		margin: 0 0 var(--space-4);
	}

	.field__label {
		display: block;
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--text);
		margin-bottom: var(--space-2);
	}
	.field__input {
		width: 100%;
		min-height: var(--tap-min);
		padding: 0 var(--space-3);
		font-size: var(--text-base);
		font-family: var(--font-sans);
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-md);
	}
	.field__input:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--primary);
	}
	.field__hint {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin: var(--space-2) 0 var(--space-4);
	}

	.banner {
		background: var(--attention-soft);
		color: var(--color-warning-text);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		font-size: var(--text-sm);
		margin: 0 0 var(--space-4);
	}
	.banner--ok {
		background: var(--primary-soft);
		color: var(--primary-text);
	}
</style>
