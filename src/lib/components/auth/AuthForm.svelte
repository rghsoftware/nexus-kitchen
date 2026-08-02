<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		AuthFailure,
		MIN_PASSWORD_LENGTH,
		requestPasswordReset,
		resendConfirmation,
		signIn,
		signInWithAuthentik,
		signUp,
		validateEmail,
		validateSignIn,
		validateSignUp
	} from '$lib/auth';

	type Mode = 'signin' | 'signup' | 'reset';

	// No props: where the user lands after signing in is the layout guard's decision,
	// driven by the session change rather than by this component navigating.

	let mode = $state<Mode>('signin');
	let email = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	/** Set once we're waiting on the user to act in their email client. */
	let pending = $state<{ kind: 'confirm' | 'reset'; email: string } | null>(null);
	/** A successful resend is otherwise indistinguishable from nothing happening. */
	let resent = $state(false);

	// Supabase appends `error`/`error_description` to the URL fragment when the Authentik
	// round trip itself fails (denied consent, misconfigured provider, etc.) — there's no
	// onAuthStateChange event for that case, so the fragment is the only signal. Runs once
	// on mount; the fragment is stripped right after so a refresh doesn't re-show it.
	$effect(() => {
		const params = new URLSearchParams(window.location.hash.slice(1));
		const description = params.get('error_description');
		if (!description) return;
		console.error(
			'[auth] Authentik redirect returned an error:',
			params.get('error_code'),
			description.replace(/\+/g, ' ')
		);
		error = 'Something went wrong signing you in. Please try again.';
		history.replaceState(null, '', window.location.pathname + window.location.search);
	});

	const COPY = {
		signin: { title: 'Welcome back', action: 'Sign in', busy: 'Signing in…' },
		signup: { title: 'Set up your kitchen', action: 'Create account', busy: 'Creating…' },
		reset: { title: 'Reset your password', action: 'Send reset link', busy: 'Sending…' }
	} as const;

	const copy = $derived(COPY[mode]);

	function switchTo(next: Mode) {
		mode = next;
		error = null;
		pending = null;
		resent = false;
		if (next !== 'signin') password = '';
	}

	function validate(): string | null {
		if (mode === 'signin') return validateSignIn(email, password);
		if (mode === 'signup') return validateSignUp(email, password);
		return validateEmail(email);
	}

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;

		const invalid = validate();
		if (invalid) {
			error = invalid;
			return;
		}

		busy = true;
		error = null;
		try {
			if (mode === 'signin') {
				await signIn(email, password);
				// The layout guard reacts to the session change and leaves /signin;
				// a full navigation here would race that, so we let it drive.
				return;
			}

			if (mode === 'signup') {
				const outcome = await signUp(email, password);
				// `active` means the project auto-confirms — the guard takes it from here.
				// Everything else shows the same screen: `already-registered` must be
				// indistinguishable from `confirmation-required`, or sign-up would answer
				// the "does this address have an account?" question that reset refuses to.
				if (outcome.status !== 'active') {
					pending = { kind: 'confirm', email: outcome.email };
					password = '';
				}
				return;
			}

			// Supabase sends the recovery link back to the app; supabase-js parses the
			// tokens from the fragment on arrival and fires PASSWORD_RECOVERY.
			await requestPasswordReset(email, `${window.location.origin}${resolve('/account')}`);
			pending = { kind: 'reset', email: email.trim() };
		} catch (err) {
			// The banner carries product copy only; keep the underlying failure in the
			// console or a production report is unreproducible.
			console.error('[auth] submit failed:', err instanceof AuthFailure ? (err.cause ?? err) : err);
			error = err instanceof AuthFailure ? err.message : 'Something went wrong. Please try again.';
		} finally {
			busy = false;
		}
	}

	async function onAuthentikSignIn() {
		if (busy) return;
		busy = true;
		error = null;
		try {
			// Carries the current `?next=` (if any) through the redirect so the layout
			// guard can hand the user back to where they started once the session lands.
			await signInWithAuthentik(window.location.href);
			// A successful call has already navigated the browser to Authentik, so this
			// normally never runs — `finally` below still resets `busy` for the case where
			// it resolves without an actual navigation (blocked popup, bfcache restore).
		} catch (err) {
			console.error(
				'[auth] Authentik sign-in failed:',
				err instanceof AuthFailure ? (err.cause ?? err) : err
			);
			error = err instanceof AuthFailure ? err.message : 'Something went wrong. Please try again.';
		} finally {
			busy = false;
		}
	}

	async function onResend() {
		if (!pending || busy) return;
		busy = true;
		error = null;
		resent = false;
		try {
			await resendConfirmation(pending.email);
		} catch (err) {
			// Not shown to the user on purpose: a resend only succeeds for an address that
			// is registered and still unconfirmed, so reporting the failure would answer
			// the question the copy above deliberately leaves open. Logged so it stays
			// diagnosable — the console is the channel for that, not the banner.
			console.error('[auth] resend failed:', err instanceof AuthFailure ? (err.cause ?? err) : err);
		} finally {
			// Same acknowledgement either way, for the same reason.
			resent = true;
			busy = false;
		}
	}
</script>

<!--
	AuthForm — the sign-in wall (feature 008). Every credential operation is a Supabase
	Auth call; this component only collects input and reports outcomes in the product's
	calm voice. There is no email-confirmation callback route because supabase-js reads
	the session straight out of the redirect URL fragment.
-->
<div class="auth">
	<div class="card">
		<div class="brand">
			<span class="brand__mark" aria-hidden="true"><i class="ph-fill ph-cooking-pot"></i></span>
			<span class="brand__name">Nexus <span>Kitchen</span></span>
		</div>

		{#if pending}
			<div class="sent">
				<div class="sent__ic" aria-hidden="true"><i class="ph ph-envelope-simple-open"></i></div>
				<h1 class="title">Check your inbox</h1>
				<p class="lede">
					{#if pending.kind === 'confirm'}
						If <strong>{pending.email}</strong> is new here, a confirmation link is on its way — open
						it and you're in. If you already have an account, sign back in instead.
					{:else}
						If an account exists for <strong>{pending.email}</strong>, a reset link is on its way.
					{/if}
				</p>

				{#if error}
					<p class="banner" role="alert">{error}</p>
				{/if}
				{#if resent}
					<p class="banner banner--ok" role="status">
						If that address needs a link, another one's on its way.
					</p>
				{/if}

				<div class="sent__actions">
					{#if pending.kind === 'confirm'}
						<button
							type="button"
							class="nk-btn nk-btn--secondary"
							disabled={busy}
							onclick={onResend}
						>
							{busy ? 'Sending…' : 'Resend the link'}
						</button>
					{/if}
					<button type="button" class="nk-btn nk-btn--ghost" onclick={() => switchTo('signin')}>
						Back to sign in
					</button>
				</div>
			</div>
		{:else}
			<h1 class="title">{copy.title}</h1>
			<p class="lede">
				{#if mode === 'signin'}
					Your recipes, plans and pantry are waiting.
				{:else if mode === 'signup'}
					One account keeps everything in sync across your devices.
				{:else}
					We'll email you a link to set a new one.
				{/if}
			</p>

			{#if mode !== 'reset'}
				<button
					type="button"
					class="nk-btn nk-btn--secondary nk-btn--lg nk-btn--block"
					disabled={busy}
					onclick={onAuthentikSignIn}
				>
					<i class="ph ph-key" aria-hidden="true"></i>
					Continue with Authentik
				</button>
				<div class="divider" role="separator"><span>or</span></div>
			{/if}

			<form onsubmit={onSubmit} novalidate>
				<div class="field">
					<label class="field__label" for="auth-email">Email</label>
					<input
						id="auth-email"
						class="field__input"
						type="email"
						autocomplete="email"
						inputmode="email"
						autocapitalize="none"
						spellcheck="false"
						disabled={busy}
						bind:value={email}
					/>
				</div>

				{#if mode !== 'reset'}
					<div class="field">
						<div class="field__head">
							<label class="field__label" for="auth-password">Password</label>
							{#if mode === 'signin'}
								<button type="button" class="linkish" onclick={() => switchTo('reset')}>
									Forgot it?
								</button>
							{/if}
						</div>
						<input
							id="auth-password"
							class="field__input"
							type="password"
							autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
							disabled={busy}
							aria-describedby={mode === 'signup' ? 'auth-password-hint' : undefined}
							bind:value={password}
						/>
						{#if mode === 'signup'}
							<p class="field__hint" id="auth-password-hint">
								At least {MIN_PASSWORD_LENGTH} characters.
							</p>
						{/if}
					</div>
				{/if}

				{#if error}
					<p class="banner" role="alert">{error}</p>
				{/if}

				<button
					type="submit"
					class="nk-btn nk-btn--primary nk-btn--lg nk-btn--block"
					disabled={busy}
				>
					{busy ? copy.busy : copy.action}
				</button>
			</form>

			<p class="alt">
				{#if mode === 'signin'}
					New here?
					<button type="button" class="linkish" onclick={() => switchTo('signup')}>
						Create an account
					</button>
				{:else}
					Already have an account?
					<button type="button" class="linkish" onclick={() => switchTo('signin')}>
						Sign in
					</button>
				{/if}
			</p>
		{/if}
	</div>
</div>

<style>
	.auth {
		min-height: 100vh;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: var(--space-5);
		background: var(--bg);
	}
	.card {
		width: 100%;
		max-width: 400px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-md);
		padding: var(--space-7) var(--space-6);
	}

	/* ---------- Brand ---------- */
	.brand {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}
	.brand__mark {
		width: 38px;
		height: 38px;
		border-radius: 11px;
		background: var(--primary);
		color: var(--text-on-accent);
		display: grid;
		place-items: center;
		font-size: 21px;
	}
	.brand__name {
		font-family: var(--font-display);
		font-weight: var(--weight-bold);
		font-size: var(--text-lg);
		letter-spacing: var(--tracking-tight);
		color: var(--text);
	}
	.brand__name span {
		color: var(--primary-text);
	}

	/* ---------- Heading ---------- */
	.title {
		font-family: var(--font-display);
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-tight);
		color: var(--text);
		margin: 0 0 var(--space-2);
	}
	.lede {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: var(--leading-relaxed);
		margin: 0 0 var(--space-6);
	}

	/* ---------- SSO divider ---------- */
	.divider {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin: var(--space-4) 0;
		color: var(--text-muted);
		font-size: var(--text-xs);
	}
	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--border);
	}

	/* ---------- Fields ---------- */
	.field {
		margin-bottom: var(--space-4);
	}
	.field__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
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
		transition:
			border-color var(--transition),
			box-shadow var(--transition);
	}
	.field__input:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--primary);
	}
	.field__input:disabled {
		background: var(--surface-2);
		color: var(--text-muted);
	}
	.field__hint {
		font-size: var(--text-xs);
		color: var(--text-muted);
		margin: var(--space-2) 0 0;
	}

	/* ---------- Messages ---------- */
	.banner {
		background: var(--attention-soft);
		color: var(--color-warning-text);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
		margin: 0 0 var(--space-4);
	}
	.banner--ok {
		background: var(--primary-soft);
		color: var(--primary-text);
	}

	/* ---------- Confirmation state ---------- */
	.sent {
		text-align: center;
	}
	.sent__ic {
		width: 56px;
		height: 56px;
		margin: 0 auto var(--space-4);
		border-radius: var(--radius-pill);
		background: var(--primary-soft);
		color: var(--primary-text);
		display: grid;
		place-items: center;
		font-size: 27px;
	}
	.sent__actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	/* ---------- Inline link-style buttons ---------- */
	.alt {
		text-align: center;
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin: var(--space-5) 0 0;
	}
	.linkish {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		font-weight: var(--weight-semibold);
		color: var(--primary-text);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.linkish:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
		border-radius: var(--radius-xs);
	}
</style>
