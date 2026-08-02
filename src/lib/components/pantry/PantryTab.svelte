<script lang="ts">
	import ExpiryAlertShelf from './ExpiryAlertShelf.svelte';
	import PantryItemForm from './PantryItemForm.svelte';
	import PantryOverview from './PantryOverview.svelte';
	import PreppedMealForm from './PreppedMealForm.svelte';
	import PreppedMealOverview from './PreppedMealOverview.svelte';
	import PortionEditor from './PortionEditor.svelte';
	import MealPrepOverview from '$lib/components/planning/mealPrep/MealPrepOverview.svelte';
	import MealPrepSessionForm from '$lib/components/planning/mealPrep/MealPrepSessionForm.svelte';
	import {
		buildPrepShoppingListAction,
		loadSessions
	} from '$lib/planning/mealPrep/mealPrepStore.svelte';
	import type { MealPrepSession } from '$lib/planning/mealPrep/types';
	import type { PantryItem, PreppedMeal, StorageLocation } from '$lib/pantry/types';

	type Tab = 'ALL' | StorageLocation | 'PREPPED';

	let activeTab = $state<Tab>('ALL');
	let showAddItem = $state(false);
	let editingItem = $state<PantryItem | undefined>(undefined);
	let showAddPrepped = $state(false);
	let editingMeal = $state<PreppedMeal | undefined>(undefined);
	let portionMeal = $state<PreppedMeal | undefined>(undefined);

	const tabs: { id: Tab; label: string }[] = [
		{ id: 'ALL', label: 'All' },
		{ id: 'FRIDGE', label: 'Fridge' },
		{ id: 'FREEZER', label: 'Freezer' },
		{ id: 'PANTRY', label: 'Pantry' },
		{ id: 'PREPPED', label: 'Prepped' }
	];

	function openAddItem() {
		editingItem = undefined;
		showAddItem = true;
	}
	function openEditItem(item: PantryItem) {
		editingItem = item;
		showAddItem = true;
	}
	function closeItemForm() {
		showAddItem = false;
		editingItem = undefined;
	}
	function openAddPrepped() {
		editingMeal = undefined;
		showAddPrepped = true;
	}
	function closeMealForm() {
		showAddPrepped = false;
		editingMeal = undefined;
	}
	function openPortionEditor(meal: PreppedMeal) {
		portionMeal = meal;
	}

	let showSessionForm = $state(false);
	let buildNotice = $state<string | null>(null);

	function openSessionForm() {
		showSessionForm = true;
	}
	function closeSessionForm() {
		showSessionForm = false;
		void loadSessions();
	}
	async function handleBuildShoppingList(session: MealPrepSession) {
		buildNotice = null;
		const { itemCount } = await buildPrepShoppingListAction(session.id);
		buildNotice =
			itemCount > 0
				? `Added ${itemCount} item${itemCount === 1 ? '' : 's'} to a prep shopping list.`
				: 'Everything for this session is already in your pantry.';
	}
</script>

<div class="flex h-full flex-col">
	<!-- Tab bar -->
	<div
		class="flex gap-1 overflow-x-auto border-b border-[var(--border)] bg-[var(--surface)] px-4 pt-2"
		role="tablist"
		aria-label="Pantry sections"
	>
		{#each tabs as tab (tab.id)}
			<button
				role="tab"
				aria-selected={activeTab === tab.id}
				class="min-h-[44px] min-w-[56px] rounded-t-md px-4 py-2 text-sm font-medium transition-colors
					{activeTab === tab.id
					? 'border-b-2 border-[var(--primary)] text-[var(--primary)]'
					: 'text-[var(--text-muted)] hover:text-[var(--text)]'}"
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
			</button>
		{/each}
	</div>

	<!-- Alert shelf (always visible) -->
	<ExpiryAlertShelf />

	<!-- Main content area -->
	<div class="min-h-0 flex-1 overflow-y-auto p-4">
		{#if activeTab === 'PREPPED'}
			<div class="flex flex-col" style="gap: var(--space-8);">
				<PreppedMealOverview
					onAddPrepped={openAddPrepped}
					onEditMeal={openPortionEditor}
					onStartSession={openSessionForm}
				/>
				{#if buildNotice}
					<p class="nk-card text-[var(--text-secondary)] text-[var(--text-sm)]" role="status">
						{buildNotice}
					</p>
				{/if}
				<MealPrepOverview
					onNewSession={openSessionForm}
					onBuildShoppingList={handleBuildShoppingList}
				/>
			</div>
		{:else}
			<PantryOverview
				storageFilter={activeTab === 'ALL' ? 'ALL' : (activeTab as StorageLocation)}
				onAddItem={openAddItem}
				onEditItem={openEditItem}
			/>
		{/if}
	</div>

	<!-- FAB: Add button (shown for pantry tabs) -->
	{#if activeTab !== 'PREPPED'}
		<button
			class="fixed right-4 bottom-20 flex min-h-[56px] min-w-[56px] items-center justify-center
				rounded-full bg-[var(--primary)] text-white shadow-lg hover:opacity-90"
			aria-label="Add pantry item"
			onclick={openAddItem}
		>
			<span class="text-2xl leading-none">+</span>
		</button>
	{/if}

	<!-- Modals -->
	{#if showAddItem}
		<div
			class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
			role="dialog"
			aria-modal="true"
			aria-label="Add or edit pantry item"
		>
			<div
				class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-4 sm:rounded-2xl"
			>
				<PantryItemForm item={editingItem} onSave={closeItemForm} onCancel={closeItemForm} />
			</div>
		</div>
	{/if}

	{#if showAddPrepped}
		<div
			class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
			role="dialog"
			aria-modal="true"
			aria-label="Add or edit prepped meal"
		>
			<div
				class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-4 sm:rounded-2xl"
			>
				<PreppedMealForm meal={editingMeal} onSave={closeMealForm} onCancel={closeMealForm} />
			</div>
		</div>
	{/if}

	{#if showSessionForm}
		<div
			class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
			role="dialog"
			aria-modal="true"
			aria-label="Start a meal prep session"
		>
			<div
				class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-4 sm:rounded-2xl"
			>
				<MealPrepSessionForm onClose={closeSessionForm} onCreated={closeSessionForm} />
			</div>
		</div>
	{/if}

	{#if portionMeal}
		<div
			class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
			role="dialog"
			aria-modal="true"
			aria-label="Manage portions"
		>
			<div
				class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--surface)] p-4 sm:rounded-2xl"
			>
				<PortionEditor meal={portionMeal} onClose={() => (portionMeal = undefined)} />
			</div>
		</div>
	{/if}
</div>
