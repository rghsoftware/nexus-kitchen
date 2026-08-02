<script lang="ts">
	import {
		cancelSessionAction,
		loadSessions,
		sessions,
		sessionsError,
		sessionsLoaded,
		sessionsLoading
	} from '$lib/planning/mealPrep/mealPrepStore.svelte';
	import type { MealPrepSession } from '$lib/planning/mealPrep/types';
	import MealPrepSessionCard from './MealPrepSessionCard.svelte';
	import CompleteSessionDialog from './CompleteSessionDialog.svelte';

	interface Props {
		onNewSession?: () => void;
		onBuildShoppingList?: (session: MealPrepSession) => void;
	}

	let { onNewSession, onBuildShoppingList }: Props = $props();

	// Session currently being marked prepped (drives the completion dialog).
	let completing = $state<MealPrepSession | null>(null);

	$effect(() => {
		if (!sessionsLoaded() && !sessionsLoading()) {
			void loadSessions();
		}
	});

	// PLANNED sessions first (most actionable), then the rest in their existing order.
	const ordered = $derived([
		...sessions().filter((s) => s.status === 'PLANNED'),
		...sessions().filter((s) => s.status !== 'PLANNED')
	]);

	async function handleCancel(session: MealPrepSession) {
		try {
			await cancelSessionAction(session.id);
		} catch {
			// Store surfaces load errors; a failed cancel leaves the session in place.
		}
	}
</script>

{#if sessionsLoading() && !sessionsLoaded()}
	<!-- Loading skeleton -->
	<div
		class="nk-stack"
		style="gap: var(--space-3);"
		aria-busy="true"
		aria-label="Loading prep sessions"
	>
		{#each [0, 1] as skeletonIdx (skeletonIdx)}
			<div
				class="nk-card animate-pulse"
				style="min-height: 120px; padding: var(--space-5);"
				aria-hidden="true"
			>
				<div
					style="height: 1rem; width: 50%; border-radius: var(--radius-sm); background: var(--surface-3); margin-bottom: var(--space-3);"
				></div>
				<div
					style="height: 0.75rem; width: 70%; border-radius: var(--radius-sm); background: var(--surface-2);"
				></div>
			</div>
		{/each}
	</div>
{:else if sessionsError()}
	<div
		class="nk-stack"
		style="align-items: center; padding: var(--space-8) var(--space-6); gap: var(--space-4); text-align: center;"
	>
		<p role="alert" style="margin: 0; color: var(--attention); font-size: var(--text-sm);">
			{sessionsError()}
		</p>
		<button type="button" class="nk-btn nk-btn--secondary" onclick={() => loadSessions()}>
			Try again
		</button>
	</div>
{:else if sessions().length === 0}
	<!-- Empty state -->
	<div
		class="nk-stack"
		style="align-items: center; justify-content: center; padding: var(--space-10) var(--space-6); gap: var(--space-5); text-align: center;"
	>
		<p style="margin: 0; font-size: var(--text-lg); color: var(--text-secondary);">
			No prep sessions yet
		</p>
		<p style="margin: 0; font-size: var(--text-sm); color: var(--text-muted); max-width: 32ch;">
			Plan a batch-cook session to make a few meals at once and stock your week.
		</p>
		{#if onNewSession}
			<button type="button" class="nk-btn nk-btn--primary" onclick={onNewSession}>
				+ New prep session
			</button>
		{/if}
	</div>
{:else}
	<div class="nk-stack" style="gap: var(--space-4);">
		{#if onNewSession}
			<div class="nk-row" style="justify-content: flex-end;">
				<button type="button" class="nk-btn nk-btn--primary" onclick={onNewSession}>
					+ New prep session
				</button>
			</div>
		{/if}
		<div class="nk-stack" style="gap: var(--space-3);">
			{#each ordered as session (session.id)}
				<MealPrepSessionCard
					{session}
					onComplete={(s) => (completing = s)}
					onCancel={handleCancel}
					{onBuildShoppingList}
				/>
			{/each}
		</div>
	</div>
{/if}

{#if completing}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-label="Mark prep session as prepped"
	>
		<div
			class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--surface)] sm:rounded-2xl"
		>
			<CompleteSessionDialog
				session={completing}
				onClose={() => (completing = null)}
				onCompleted={() => (completing = null)}
			/>
		</div>
	</div>
{/if}
