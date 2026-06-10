<script lang="ts">
	import { supabase } from '$lib/supabaseClient';
	import {
		optimisticAddPantryItem,
		optimisticDeletePantryItem,
		optimisticUpdatePantryItem
	} from '$lib/pantry/pantryStore.svelte';
	import {
		DEFAULT_SHELF_LIFE_DAYS,
		type PantryItem,
		type StorageLocation
	} from '$lib/pantry/types';
	import { uploadPantryPhoto } from '$lib/pantry/pantryService';
	import { untrack } from 'svelte';
	import BarcodeScanner from './BarcodeScanner.svelte';

	interface Props {
		item?: PantryItem;
		onSave: (item: PantryItem) => void;
		onCancel: () => void;
	}

	let { item, onSave, onCancel }: Props = $props();

	const UNITS = ['pieces', 'g', 'kg', 'ml', 'L', 'cups', 'oz', 'lb', 'tbsp', 'tsp', 'slices'];
	const STORAGE_LOCATIONS: { value: StorageLocation; label: string }[] = [
		{ value: 'FRIDGE', label: 'Fridge' },
		{ value: 'FREEZER', label: 'Freezer' },
		{ value: 'PANTRY', label: 'Pantry' },
		{ value: 'OTHER', label: 'Other' }
	];

	// untrack: we intentionally seed local form state from the initial prop value only.
	// The form is not a controlled component — parent prop changes after mount are ignored.
	let name = $state(untrack(() => item?.name ?? ''));
	let quantity = $state(untrack(() => item?.quantity ?? 0));
	let unit = $state(untrack(() => item?.unit ?? 'pieces'));
	let storageLocation = $state<StorageLocation>(untrack(() => item?.storage_location ?? 'PANTRY'));
	let expirationDate = $state(untrack(() => item?.expiration_date ?? ''));
	let purchaseDate = $state(untrack(() => item?.purchase_date ?? ''));
	let minimumQuantity = $state<number | null>(untrack(() => item?.minimum_quantity ?? null));
	let photoUrl = $state(untrack(() => item?.photo_url ?? ''));
	let busy = $state(false);
	let showScanner = $state(false);
	let errors = $state<Record<string, string>>({});
	let pendingPhotoFile = $state<File | null>(null);

	/** Convert epoch ms to an ISO date string (YYYY-MM-DD) without constructing a Date object. */
	function msToDateString(ms: number): string {
		return new Date(ms).toISOString().split('T')[0];
	}

	// FR-PI-009: auto-suggest expiry date when storage location changes (add mode only).
	// Pure ms arithmetic avoids constructing a mutable Date instance (svelte/prefer-svelte-reactivity).
	$effect(() => {
		if (!item && !expirationDate) {
			const days = DEFAULT_SHELF_LIFE_DAYS[storageLocation];
			expirationDate = msToDateString(Date.now() + days * 86_400_000);
		}
	});

	function validate(): boolean {
		const next: Record<string, string> = {};
		const trimmedName = name.trim();
		if (!trimmedName || trimmedName.length > 200) {
			next.name = 'Name is required and must be 200 characters or fewer.';
		}
		if (quantity < 0 || isNaN(quantity)) {
			next.quantity = 'Quantity must be 0 or more.';
		}
		if (minimumQuantity !== null && (minimumQuantity < 0 || isNaN(minimumQuantity))) {
			next.minimumQuantity = 'Alert quantity must be 0 or more.';
		}
		if (expirationDate) {
			// Truncate to midnight UTC for consistent day-diff arithmetic (no mutable Date instances).
			const todayMidnightMs = Math.floor(Date.now() / 86_400_000) * 86_400_000;
			const expMs = Date.parse(expirationDate);
			const diffDays = Math.floor((expMs - todayMidnightMs) / 86_400_000);
			if (diffDays < -30) {
				next.expirationDate = 'Expiration date cannot be more than 30 days in the past.';
			}
		}
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function handlePhotoChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (item?.id) {
			// Edit mode: upload immediately
			try {
				photoUrl = await uploadPantryPhoto(item.id, file);
			} catch {
				errors = { ...errors, photo: 'Photo upload failed. Try again.' };
			}
		} else {
			// Add mode: hold file until save
			pendingPhotoFile = file;
		}
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
				errors = { form: 'You must be signed in to save items.' };
				return;
			}

			if (item?.id) {
				// Edit mode
				const saved = await optimisticUpdatePantryItem(item.id, {
					name: name.trim(),
					quantity,
					unit,
					storage_location: storageLocation,
					expiration_date: expirationDate || null,
					purchase_date: purchaseDate || null,
					minimum_quantity: minimumQuantity,
					photo_url: photoUrl || null
				});
				onSave(saved);
			} else {
				// Add mode: create item, then upload photo if pending
				const newItem = await optimisticAddPantryItem({
					owner_id: user.id,
					name: name.trim(),
					quantity,
					unit,
					storage_location: storageLocation,
					expiration_date: expirationDate || null,
					purchase_date: purchaseDate || null,
					minimum_quantity: minimumQuantity,
					photo_url: null
				});
				if (pendingPhotoFile && newItem.id) {
					try {
						const url = await uploadPantryPhoto(newItem.id, pendingPhotoFile);
						const withPhoto = await optimisticUpdatePantryItem(newItem.id, { photo_url: url });
						onSave(withPhoto);
					} catch {
						// Photo upload failure is non-fatal; still save the item
						onSave(newItem);
					}
				} else {
					onSave(newItem);
				}
			}
		} catch (err) {
			errors = {
				form: err instanceof Error ? err.message : 'Something went wrong. Please try again.'
			};
		} finally {
			busy = false;
		}
	}

	async function handleDelete() {
		if (!item?.id) return;
		const confirmed = window.confirm('Remove this item from your pantry?');
		if (!confirmed) return;
		busy = true;
		try {
			await optimisticDeletePantryItem(item.id);
			onCancel();
		} catch (err) {
			errors = {
				form: err instanceof Error ? err.message : 'Could not remove item. Please try again.'
			};
			busy = false;
		}
	}

	function handleBarcodeDetect(barcode: string) {
		// Placeholder: a real lookup would call an Edge Function.
		// For now, populate the name field with the raw barcode value.
		name = barcode;
		showScanner = false;
	}

	function handleStorageChange(e: Event) {
		storageLocation = (e.currentTarget as HTMLInputElement).value as StorageLocation;
	}

	function handleMinQtyChange(e: Event) {
		const val = (e.currentTarget as HTMLInputElement).value;
		minimumQuantity = val === '' ? null : Number(val);
	}
</script>

{#if showScanner}
	<BarcodeScanner onDetect={handleBarcodeDetect} onClose={() => (showScanner = false)} />
{/if}

<form
	onsubmit={(e) => {
		e.preventDefault();
		handleSave();
	}}
	novalidate
	aria-label={item ? 'Edit pantry item' : 'Add pantry item'}
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
		{item ? 'Edit item' : 'Add to pantry'}
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

	<!-- Scan barcode button -->
	<div>
		<button
			type="button"
			class="nk-btn nk-btn--secondary"
			onclick={() => (showScanner = true)}
			aria-label="Open barcode scanner to fill item name"
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<rect x="3" y="3" width="4" height="18" rx="1" fill="currentColor" />
				<rect x="9" y="3" width="2" height="18" rx="1" fill="currentColor" />
				<rect x="13" y="3" width="4" height="18" rx="1" fill="currentColor" />
				<rect x="19" y="3" width="2" height="18" rx="1" fill="currentColor" />
			</svg>
			Scan barcode
		</button>
	</div>

	<!-- Name -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<label
			for="item-name"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			Item name <span aria-hidden="true" style="color: var(--attention);">*</span>
		</label>
		<input
			id="item-name"
			type="text"
			required
			maxlength="200"
			bind:value={name}
			aria-required="true"
			aria-describedby={errors.name ? 'item-name-error' : undefined}
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
				id="item-name-error"
				role="alert"
				style="color: var(--attention); font-size: var(--text-sm);"
			>
				{errors.name}
			</p>
		{/if}
	</div>

	<!-- Quantity + Unit -->
	<div style="display: flex; gap: var(--space-3); align-items: flex-end;">
		<div style="flex: 1; display: flex; flex-direction: column; gap: var(--space-2);">
			<label
				for="item-quantity"
				style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
			>
				Quantity <span aria-hidden="true" style="color: var(--attention);">*</span>
			</label>
			<input
				id="item-quantity"
				type="number"
				min="0"
				step="any"
				bind:value={quantity}
				aria-required="true"
				aria-describedby={errors.quantity ? 'item-quantity-error' : undefined}
				aria-invalid={!!errors.quantity}
				style="
					min-height: var(--tap-min);
					padding: 0 var(--space-4);
					border: 1.5px solid {errors.quantity ? 'var(--attention)' : 'var(--border-strong)'};
					border-radius: var(--radius-pill);
					background: var(--bg);
					color: var(--text);
					font-family: var(--font-sans);
					font-size: var(--text-base);
					width: 100%;
				"
			/>
			{#if errors.quantity}
				<p
					id="item-quantity-error"
					role="alert"
					style="color: var(--attention); font-size: var(--text-sm);"
				>
					{errors.quantity}
				</p>
			{/if}
		</div>

		<div style="display: flex; flex-direction: column; gap: var(--space-2);">
			<label
				for="item-unit"
				style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
			>
				Unit
			</label>
			<select
				id="item-unit"
				bind:value={unit}
				style="
					min-height: var(--tap-min);
					padding: 0 var(--space-4);
					border: 1.5px solid var(--border-strong);
					border-radius: var(--radius-pill);
					background: var(--bg);
					color: var(--text);
					font-family: var(--font-sans);
					font-size: var(--text-base);
					cursor: pointer;
				"
			>
				{#each UNITS as u (u)}
					<option value={u}>{u}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Storage location -->
	<fieldset
		style="border: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2);"
	>
		<legend
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary); padding: 0; margin-bottom: var(--space-2);"
		>
			Storage location
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
						name="storage-location"
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

	<!-- Expiration date -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<label
			for="item-expiration"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			Expiration date
		</label>
		<input
			id="item-expiration"
			type="date"
			bind:value={expirationDate}
			aria-describedby={errors.expirationDate ? 'item-expiration-error' : undefined}
			aria-invalid={!!errors.expirationDate}
			style="
				min-height: var(--tap-min);
				padding: 0 var(--space-4);
				border: 1.5px solid {errors.expirationDate ? 'var(--attention)' : 'var(--border-strong)'};
				border-radius: var(--radius-pill);
				background: var(--bg);
				color: var(--text);
				font-family: var(--font-sans);
				font-size: var(--text-base);
				width: 100%;
			"
		/>
		{#if errors.expirationDate}
			<p
				id="item-expiration-error"
				role="alert"
				style="color: var(--attention); font-size: var(--text-sm);"
			>
				{errors.expirationDate}
			</p>
		{/if}
	</div>

	<!-- Purchase date -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<label
			for="item-purchase"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			Purchase date <span style="color: var(--text-muted); font-weight: var(--weight-regular);"
				>(optional)</span
			>
		</label>
		<input
			id="item-purchase"
			type="date"
			bind:value={purchaseDate}
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

	<!-- Minimum quantity alert -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<label
			for="item-min-qty"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			Alert when below <span style="color: var(--text-muted); font-weight: var(--weight-regular);"
				>(optional)</span
			>
		</label>
		<input
			id="item-min-qty"
			type="number"
			min="0"
			step="any"
			value={minimumQuantity ?? ''}
			oninput={handleMinQtyChange}
			aria-describedby={errors.minimumQuantity ? 'item-min-qty-error' : 'item-min-qty-hint'}
			aria-invalid={!!errors.minimumQuantity}
			style="
				min-height: var(--tap-min);
				padding: 0 var(--space-4);
				border: 1.5px solid {errors.minimumQuantity ? 'var(--attention)' : 'var(--border-strong)'};
				border-radius: var(--radius-pill);
				background: var(--bg);
				color: var(--text);
				font-family: var(--font-sans);
				font-size: var(--text-base);
				width: 100%;
			"
		/>
		<p id="item-min-qty-hint" style="font-size: var(--text-xs); color: var(--text-muted);">
			Get a nudge when stock drops to this level.
		</p>
		{#if errors.minimumQuantity}
			<p
				id="item-min-qty-error"
				role="alert"
				style="color: var(--attention); font-size: var(--text-sm);"
			>
				{errors.minimumQuantity}
			</p>
		{/if}
	</div>

	<!-- Photo -->
	<div style="display: flex; flex-direction: column; gap: var(--space-2);">
		<label
			for="item-photo"
			style="font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--weight-semibold); color: var(--text-secondary);"
		>
			Photo <span style="color: var(--text-muted); font-weight: var(--weight-regular);"
				>(optional)</span
			>
		</label>
		<input
			id="item-photo"
			type="file"
			accept="image/*"
			capture="environment"
			onchange={handlePhotoChange}
			style="
				min-height: var(--tap-min);
				font-family: var(--font-sans);
				font-size: var(--text-sm);
				color: var(--text);
			"
		/>
		{#if errors.photo}
			<p role="alert" style="color: var(--attention); font-size: var(--text-sm);">{errors.photo}</p>
		{/if}
		{#if photoUrl}
			<img
				src={photoUrl}
				alt="Current item"
				style="width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--border);"
			/>
		{/if}
	</div>

	<!-- Actions -->
	<div style="display: flex; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-2);">
		<button
			type="submit"
			class="nk-btn nk-btn--primary"
			disabled={busy}
			aria-busy={busy}
			style="flex: 1;"
		>
			{busy ? 'Saving…' : item ? 'Save changes' : 'Add to pantry'}
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
		{#if item?.id}
			<button
				type="button"
				onclick={handleDelete}
				disabled={busy}
				style="
					min-height: var(--tap-min);
					padding: 0 var(--space-5);
					border-radius: var(--radius-pill);
					border: 1.5px solid var(--attention);
					background: transparent;
					color: var(--attention);
					font-family: var(--font-sans);
					font-size: var(--text-base);
					font-weight: var(--weight-semibold);
					cursor: pointer;
					transition: background var(--transition);
					width: 100%;
				"
			>
				Remove from pantry
			</button>
		{/if}
	</div>
</form>
