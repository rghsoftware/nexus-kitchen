<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		clearRemindersError,
		loadReminders,
		reminderDrafts,
		remindersError,
		remindersLoading,
		remindersSaved,
		remindersSaving,
		saveAll,
		updateDraft,
		type ReminderDraft
	} from '$lib/reminders';

	const SLOT_ICON: Record<ReminderDraft['mealSlot'], string> = {
		BREAKFAST: 'ph-coffee',
		LUNCH: 'ph-bowl-food',
		DINNER: 'ph-fork-knife',
		SNACK: 'ph-cookie'
	};

	const PRE_ALERT_OPTIONS = [
		{ value: 0, label: 'No pre-alert' },
		{ value: 15, label: '15 min pre-alert' },
		{ value: 30, label: '30 min pre-alert' },
		{ value: 60, label: '1 hr pre-alert' }
	];

	$effect(() => {
		void loadReminders();
	});

	async function onSave() {
		clearRemindersError();
		await saveAll();
	}
</script>

<!--
	ReminderSetup — the "Gentle nudges" screen, per
	design/screens/mobile-reminder-setup.html. One row per meal slot: time,
	optional pre-alert (REQ-MR-002/003), and an on/off toggle. Delivery happens
	server-side (Cron → Pushover); this screen only edits preferences, and every
	exit ramp stays easy (REQ-UX-009).
-->
<svelte:head>
	<title>Gentle nudges · Nexus Kitchen</title>
</svelte:head>

<div class="setup nk-scroll">
	<div class="wrap">
		<header class="navbar">
			<a class="navbar__back" href={resolve('/today')} aria-label="Back to Today">
				<i class="ph ph-arrow-left" aria-hidden="true"></i>
			</a>
			<h1 class="navbar__title">Gentle nudges</h1>
		</header>

		<div class="intro">
			<div class="intro__ic" aria-hidden="true"><i class="ph ph-bell-simple-ringing"></i></div>
			<h2>When would you like a nudge?</h2>
			<p>Soft reminders to eat — never naggy, always easy to dismiss.</p>
		</div>

		{#if remindersError()}
			<div class="banner" role="alert">{remindersError()}</div>
		{/if}

		{#each reminderDrafts() as draft (draft.mealSlot)}
			<div class="row" class:row--on={draft.isEnabled}>
				<div class="row__ic" aria-hidden="true">
					<i class="ph {SLOT_ICON[draft.mealSlot]}"></i>
				</div>
				<div class="row__body">
					<label class="row__name" for="time-{draft.mealSlot}">{draft.name}</label>
					<div class="row__controls">
						<input
							id="time-{draft.mealSlot}"
							class="row__time"
							type="time"
							value={draft.reminderTime}
							disabled={remindersLoading()}
							onchange={(e) => updateDraft(draft.mealSlot, { reminderTime: e.currentTarget.value })}
						/>
						<select
							class="row__prealert"
							aria-label="{draft.name} pre-alert"
							value={draft.preAlertMinutes ?? 0}
							disabled={remindersLoading()}
							onchange={(e) =>
								updateDraft(draft.mealSlot, {
									preAlertMinutes: Number(e.currentTarget.value) || null
								})}
						>
							{#each PRE_ALERT_OPTIONS as opt (opt.value)}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>
				<button
					type="button"
					class="toggle"
					aria-pressed={draft.isEnabled}
					aria-label="{draft.name} reminder"
					disabled={remindersLoading()}
					onclick={() => updateDraft(draft.mealSlot, { isEnabled: !draft.isEnabled })}
				></button>
			</div>
		{/each}

		<p class="reassure">
			<i class="ph ph-info" aria-hidden="true"></i> Change any of this anytime — nudges are always easy
			to dismiss.
		</p>

		<div class="foot">
			{#if remindersSaved()}
				<p class="foot__saved" role="status">
					<i class="ph-fill ph-check-circle" aria-hidden="true"></i> Saved. Nudges will follow these times.
				</p>
			{/if}
			<button
				type="button"
				class="nk-btn nk-btn--primary nk-btn--block nk-btn--lg"
				disabled={remindersSaving() || remindersLoading()}
				onclick={onSave}
			>
				{remindersSaving() ? 'Saving…' : 'Set reminders'}
			</button>
			<button
				type="button"
				class="nk-btn nk-btn--ghost nk-btn--block"
				onclick={() => goto(resolve('/today'))}
			>
				Maybe later
			</button>
		</div>
	</div>
</div>

<style>
	.setup {
		height: 100%;
		overflow-y: auto;
	}
	.wrap {
		max-width: 560px;
		margin: 0 auto;
		padding: var(--space-4) var(--space-5) var(--space-8);
	}

	.navbar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0 var(--space-3);
	}
	.navbar__back {
		width: 42px;
		height: 42px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text);
		display: grid;
		place-items: center;
		font-size: 1.2em;
		flex: none;
		text-decoration: none;
	}
	.navbar__back:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}
	.navbar__title {
		font-weight: var(--weight-bold);
		font-size: var(--text-base);
	}

	.intro {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: var(--space-4) var(--space-4) var(--space-6);
	}
	.intro__ic {
		width: 64px;
		height: 64px;
		border-radius: 20px;
		background: var(--primary-soft);
		color: var(--primary-text);
		display: grid;
		place-items: center;
		font-size: 32px;
		margin-bottom: var(--space-4);
	}
	.intro h2 {
		font-size: var(--text-2xl);
		font-family: var(--font-display);
	}
	.intro p {
		color: var(--text-secondary);
		font-size: var(--text-base);
		margin-top: var(--space-2);
		max-width: 30ch;
	}

	.banner {
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-md);
		background: var(--attention-soft);
		color: var(--attention);
		font-size: var(--text-sm);
		margin-bottom: var(--space-3);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
		margin-bottom: var(--space-3);
		box-shadow: var(--shadow-sm);
	}
	.row__ic {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-sm);
		display: grid;
		place-items: center;
		font-size: 20px;
		flex: none;
		background: var(--surface-2);
		color: var(--text-secondary);
	}
	.row--on .row__ic {
		background: var(--primary-soft);
		color: var(--primary-text);
	}
	.row__body {
		flex: 1;
		min-width: 0;
	}
	.row__name {
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
		display: block;
	}
	.row__controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: 2px;
		flex-wrap: wrap;
	}
	.row__time,
	.row__prealert {
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		color: var(--text-secondary);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 2px var(--space-2);
		min-height: 32px;
	}
	.row__time:focus-visible,
	.row__prealert:focus-visible,
	.toggle:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.toggle {
		position: relative;
		width: 50px;
		height: 30px;
		border-radius: var(--radius-pill);
		background: var(--border-strong);
		border: none;
		flex: none;
		padding: 0;
		cursor: pointer;
	}
	.toggle[aria-pressed='true'] {
		background: var(--primary);
	}
	.toggle::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--text-on-accent);
		box-shadow: var(--shadow-sm);
		transition: transform var(--transition);
	}
	.toggle[aria-pressed='true']::after {
		transform: translateX(20px);
	}

	.reassure {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		justify-content: center;
		margin-top: var(--space-4);
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	.reassure i {
		color: var(--primary-text);
	}

	.foot {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-6);
	}
	.foot__saved {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--primary-text);
	}
</style>
