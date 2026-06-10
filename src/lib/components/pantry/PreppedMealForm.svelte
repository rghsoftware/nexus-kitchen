<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import {
		optimisticAddPreppedMeal,
		optimisticUpdatePreppedMeal
	} from '$lib/pantry/preppedMealStore.svelte';
	import { untrack } from 'svelte';
	import {
		PREPPED_SHELF_LIFE_DAYS,
		type PreppedMeal,
		type PreppedMealOrigin,
		type StorageLocation
	} from '$lib/pantry/types';

	interface Props {
		meal?: PreppedMeal;
		onSave: (meal: PreppedMeal) => void;
		onCancel: () => void;
	}

	let { meal, onSave, onCancel }: Props = $props();

	const STORAGE_LOCATIONS: { value: StorageLocation; label: string }[] = [
		{ value: 'FRIDGE', label: 'Fridge' },
		{ value: 'FREEZER', label: 'Freezer' }
	];

	const today = new Date().toISOString().split('T')[0];

	// untrack: we intentionally seed local form state from the initial prop value only.
	// The form is not a controlled component — parent prop changes after mount are ignored.
	let name = $state(untrack(() => meal?.name ?? ''));
	let origin = $state<PreppedMealOrigin>(untrack(() => meal?.origin ?? 'DIRECT_ENTRY'));
	let portions = $state(untrack(() => meal?.original_portions ?? 1));
	let storageLocation = $state<StorageLocation>(untrack(() => meal?.storage_location ?? 'FRIDGE'));
	let preparedDate = $state(untrack(() => meal?.prepared_date ?? today));
	// null = no user override; use location default. Non-null = user-edited value.
	let shelfLifeOverride = $state<number | null>(null);
	let containerLabel = $state(untrack(() => meal?.container_label ?? ''));
	let busy = $state(false);
	let errors = $state<Record<string, string>>({});

	// shelfLifeDays: derived from location default, overridable by user input.
	// When storageLocation changes, override is cleared so the new default applies.
	const shelfLifeDays = $derived.by(
		() => shelfLifeOverride ?? PREPPED_SHELF_LIFE_DAYS[storageLocation] ?? 4
	);

	// Computed expiration date from prepared date + effective shelf life
	const expirationDate = $derived.by(() => {
		const baseMs = new Date(preparedDate).getTime();
		const d = new Date(baseMs + shelfLifeDays * 86_400_000);
		return d.toISOString().split('T')[0];
	});

	// Formatted expiration for display: e.g. "Dec 28".
	// timeZone: 'UTC' prevents an off-by-one for negative-UTC-offset users:
	// 'YYYY-MM-DD' strings parse as UTC midnight, so rendering in local time would shift the day.
	const expirationFormatted = $derived.by(() => {
		const d = new Date(expirationDate);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
	});

	function validate(): boolean {
		const next: Record<string, string> = {};
		if (!name.trim()) {
			next.name = 'Name is required.';
		}
		if (portions < 1 || isNaN(portions) || !Number.isFinite(portions)) {
			next.portions = 'Portions must be 1 or more.';
		}
		// INV-INV-009: expiration must be after prepared date
		if (expirationDate <= preparedDate) {
			next.shelfLife = 'Expiration date must be after the date made.';
		}
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function handleSave() {
		if (!validate() || busy) return;
		busy = true;
		errors = {};

		try {
			const {
				data: { user }
			} = await supabase.auth.getUser();
			if (!user) {
				errors = { form: 'You must be signed in to save.' };
				return;
			}

			if (meal?.id) {
				// Edit mode: portions_remaining and original_portions are ledger-managed;
				// excluded from PreppedMealUpdate per types.ts. Portions field is display-only here.
				const saved = await optimisticUpdatePreppedMeal(meal.id, {
					name: name.trim(),
					origin,
					storage_location: storageLocation,
					prepared_date: preparedDate,
					expiration_date: expirationDate,
					container_label: containerLabel || null
				});
				onSave(saved);
			} else {
				// Add mode: both portions_remaining and original_portions set to portions
				const saved = await optimisticAddPreppedMeal({
					owner_id: user.id,
					name: name.trim(),
					origin,
					storage_location: storageLocation,
					prepared_date: preparedDate,
					expiration_date: expirationDate,
					original_portions: portions,
					portions_remaining: portions,
					container_label: containerLabel || null
				});
				onSave(saved);
			}
		} catch (err) {
			errors = {
				form: err instanceof Error ? err.message : 'Something went wrong. Please try again.'
			};
		} finally {
			busy = false;
		}
	}

	function handleStorageChange(e: Event) {
		storageLocation = (e.currentTarget as HTMLInputElement).value as StorageLocation;
		// Clear user override so the new location's default applies automatically.
		shelfLifeOverride = null;
	}

	function handleShelfLifeChange(e: Event) {
		const val = Number((e.currentTarget as HTMLInputElement).value);
		shelfLifeOverride = isNaN(val) || val < 1 ? 1 : val;
	}
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleSave();
	}}
	novalidate
	aria-label={meal ? 'Edit prepped meal' : 'Add prepped meal'}
	style="
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		padding: var(--space-6);
		background: var(--surface);
		border-radius: var(--radius-lg);
	"
>
	<h2
		style="font-family: var(--font-display); font-size: var(--text-xl); font-weight: var(--weight-bold); color: var(--text); margin: 0;"
	>
		{meal ? 'Edit meal' : 'Log prepped meal'}
	</h2>

	<!-- Form-level error -->
	{#if errors.form}
		<p
			role="alert"
			style="color: var(--attention); font-size: var(--text-sm); font-family: var(--font-sans);"
		>
			{errors.form}
		</p>
	{/if}

	<!-- Name -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<label
			for="meal-name"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			Meal name <span aria-hidden="true" style="color: var(--attention);">*</span>
		</label>
		<input
			id="meal-name"
			type="text"
			required
			bind:value={name}
			aria-required="true"
			aria-describedby={errors.name ? 'meal-name-error' : undefined}
			aria-invalid={!!errors.name}
			style="
				min-height: var(--tap-min);
				padding: 0 var(--space-4);
				border: 1.5px solid {errors.name ? 'var(--attention)' : 'var(--border-strong)'};
				border-radius: var(--radius-pill);
				background: var(--bg);
				color: var(--text);
				font-family: var(--font-sans);
				font-size: var(--text-base);
				width: 100%;
			"
		/>
		{#if errors.name}
			<p
				id="meal-name-error"
				role="alert"
				style="color: var(--attention); font-size: var(--text-sm);"
			>
				{errors.name}
			</p>
		{/if}
	</div>

	<!-- Origin toggle: "I made it" / "I bought it" -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<span
			id="origin-label"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			How did you get it?
		</span>
		<div
			role="radiogroup"
			aria-labelledby="origin-label"
			style="display: flex; gap: var(--space-2);"
		>
			<button
				type="button"
				role="radio"
				aria-checked={origin === 'DIRECT_ENTRY'}
				onclick={() => (origin = 'DIRECT_ENTRY')}
				style="
					min-height: var(--tap-min);
					padding: 0 var(--space-5);
					border-radius: var(--radius-pill);
					border: 1.5px solid {origin === 'DIRECT_ENTRY' ? 'var(--primary)' : 'var(--border-strong)'};
					background: {origin === 'DIRECT_ENTRY' ? 'var(--primary)' : 'var(--surface)'};
					color: {origin === 'DIRECT_ENTRY' ? 'var(--text-on-accent)' : 'var(--text-secondary)'};
					font-family: var(--font-sans);
					font-size: var(--text-sm);
					font-weight: var(--weight-semibold);
					cursor: pointer;
					transition: background var(--transition), border-color var(--transition), color var(--transition);
					display: inline-flex;
					align-items: center;
					gap: var(--space-2);
				"
			>
				{#if origin === 'DIRECT_ENTRY'}
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
						<path
							d="M2 7l4 4 6-6"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{/if}
				I made it
			</button>
			<button
				type="button"
				role="radio"
				aria-checked={origin === 'STORE_BOUGHT'}
				onclick={() => (origin = 'STORE_BOUGHT')}
				style="
					min-height: var(--tap-min);
					padding: 0 var(--space-5);
					border-radius: var(--radius-pill);
					border: 1.5px solid {origin === 'STORE_BOUGHT' ? 'var(--primary)' : 'var(--border-strong)'};
					background: {origin === 'STORE_BOUGHT' ? 'var(--primary)' : 'var(--surface)'};
					color: {origin === 'STORE_BOUGHT' ? 'var(--text-on-accent)' : 'var(--text-secondary)'};
					font-family: var(--font-sans);
					font-size: var(--text-sm);
					font-weight: var(--weight-semibold);
					cursor: pointer;
					transition: background var(--transition), border-color var(--transition), color var(--transition);
					display: inline-flex;
					align-items: center;
					gap: var(--space-2);
				"
			>
				{#if origin === 'STORE_BOUGHT'}
					<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
						<path
							d="M2 7l4 4 6-6"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{/if}
				I bought it
			</button>
		</div>
	</div>

	<!-- Portions (add mode only; read-only in edit mode since ledger manages them) -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<label
			for="meal-portions"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			{meal ? 'Original portions' : 'Portions'}
			<span aria-hidden="true" style="color: var(--attention);">*</span>
		</label>
		<input
			id="meal-portions"
			type="number"
			min="1"
			step="1"
			bind:value={portions}
			readonly={!!meal}
			aria-required="true"
			aria-describedby={errors.portions
				? 'meal-portions-error'
				: meal
					? 'meal-portions-hint'
					: undefined}
			aria-invalid={!!errors.portions}
			style="
				min-height: var(--tap-min);
				padding: 0 var(--space-4);
				border: 1.5px solid {errors.portions ? 'var(--attention)' : 'var(--border-strong)'};
				border-radius: var(--radius-pill);
				background: {meal ? 'var(--surface-2)' : 'var(--bg)'};
				color: var(--text);
				font-family: var(--font-sans);
				font-size: var(--text-base);
				width: 100%;
			"
		/>
		{#if meal}
			<p id="meal-portions-hint" style="font-size: var(--text-xs); color: var(--text-muted);">
				Portions remaining are tracked separately. Use the portion controls on the pantry card.
			</p>
		{/if}
		{#if errors.portions}
			<p
				id="meal-portions-error"
				role="alert"
				style="color: var(--attention); font-size: var(--text-sm);"
			>
				{errors.portions}
			</p>
		{/if}
	</div>

	<!-- Date made / bought -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<label
			for="meal-prepared-date"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			{origin === 'STORE_BOUGHT' ? 'Date bought' : 'Date made'}
		</label>
		<input
			id="meal-prepared-date"
			type="date"
			bind:value={preparedDate}
			style="
				min-height: var(--tap-min);
				padding: 0 var(--space-4);
				border: 1.5px solid var(--border-strong);
				border-radius: var(--radius-pill);
				background: var(--bg);
				color: var(--text);
				font-family: var(--font-sans);
				font-size: var(--text-base);
				width: 100%;
			"
		/>
	</div>

	<!-- Storage location -->
	<fieldset
		style="border: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2);"
	>
		<legend
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary); padding: 0; margin-bottom: var(--space-2);"
		>
			Where is it stored?
		</legend>
		<div style="display: flex; flex-wrap: wrap; gap: var(--space-2);">
			{#each STORAGE_LOCATIONS as loc (loc.value)}
				<label
					style="
						display: flex;
						align-items: center;
						gap: var(--space-2);
						min-height: var(--tap-min);
						padding: 0 var(--space-4);
						border: 1.5px solid {storageLocation === loc.value ? 'var(--primary)' : 'var(--border-strong)'};
						border-radius: var(--radius-pill);
						background: {storageLocation === loc.value ? 'var(--primary-soft)' : 'var(--surface)'};
						cursor: pointer;
						font-family: var(--font-sans);
						font-size: var(--text-sm);
						font-weight: var(--weight-semibold);
						color: {storageLocation === loc.value ? 'var(--primary-text)' : 'var(--text-secondary)'};
						transition: background var(--transition), border-color var(--transition), color var(--transition);
					"
				>
					<input
						type="radio"
						name="meal-storage-location"
						value={loc.value}
						checked={storageLocation === loc.value}
						onchange={handleStorageChange}
						class="sr-only"
					/>
					{#if storageLocation === loc.value}
						<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
							<path
								d="M2 7l4 4 6-6"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
					{loc.label}
				</label>
			{/each}
		</div>
	</fieldset>

	<!-- Shelf life override + computed expiration -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<label
			for="meal-shelf-life"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			Good for (days)
		</label>
		<input
			id="meal-shelf-life"
			type="number"
			min="1"
			step="1"
			value={shelfLifeDays}
			oninput={handleShelfLifeChange}
			aria-describedby="meal-expiration-preview meal-shelf-life-error"
			aria-invalid={!!errors.shelfLife}
			style="
				min-height: var(--tap-min);
				padding: 0 var(--space-4);
				border: 1.5px solid {errors.shelfLife ? 'var(--attention)' : 'var(--border-strong)'};
				border-radius: var(--radius-pill);
				background: var(--bg);
				color: var(--text);
				font-family: var(--font-sans);
				font-size: var(--text-base);
				width: 100%;
			"
		/>
		<p
			id="meal-expiration-preview"
			style="font-size: var(--text-sm); color: var(--text-secondary); font-family: var(--font-sans);"
		>
			Expires: <strong style="color: var(--text);">{expirationFormatted}</strong>
		</p>
		{#if errors.shelfLife}
			<p
				id="meal-shelf-life-error"
				role="alert"
				style="color: var(--attention); font-size: var(--text-sm);"
			>
				{errors.shelfLife}
			</p>
		{/if}
	</div>

	<!-- Container label -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<label
			for="meal-container-label"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			Container label <span style="color: var(--text-muted); font-weight: var(--weight-regular);"
				>(optional)</span
			>
		</label>
		<input
			id="meal-container-label"
			type="text"
			bind:value={containerLabel}
			placeholder="e.g. blue lid, top shelf"
			style="
				min-height: var(--tap-min);
				padding: 0 var(--space-4);
				border: 1.5px solid var(--border-strong);
				border-radius: var(--radius-pill);
				background: var(--bg);
				color: var(--text);
				font-family: var(--font-sans);
				font-size: var(--text-base);
				width: 100%;
			"
		/>
	</div>

	<!-- Actions -->
	<div style="display: flex; gap: var(--space-3); margin-top: var(--space-2);">
		<button
			type="submit"
			class="nk-btn nk-btn--primary"
			disabled={busy}
			aria-busy={busy}
			style="flex: 1;"
		>
			{busy ? 'Saving…' : meal ? 'Save changes' : 'Log meal'}
		</button>
		<button
			type="button"
			class="nk-btn nk-btn--secondary"
			onclick={onCancel}
			disabled={busy}
			style="flex: 1;"
		>
			Cancel
		</button>
	</div>
</form>
