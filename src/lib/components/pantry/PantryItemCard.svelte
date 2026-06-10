<script lang="ts">
	import type { PantryItem } from '$lib/pantry/types';

	interface Props {
		item: PantryItem;
		onclick?: () => void;
	}

	let { item, onclick }: Props = $props();

	function formatDate(isoDate: string): string {
		// Use UTC to avoid off-by-one from timezone offsets on bare date strings
		const d = new Date(isoDate + 'T00:00:00Z');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
	}

	function locationLabel(loc: PantryItem['storage_location']): string {
		return loc.charAt(0) + loc.slice(1).toLowerCase();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick?.();
		}
	}
</script>

<!--
	PantryItemCard — displays a single pantry item.
	Touch target: min 44px via min-h-[44px] on wrapper.
	Color is never the sole indicator — badges always pair text + color.
-->
<div
	role="button"
	tabindex="0"
	aria-label="{item.name}, {item.quantity} {item.unit}"
	class="nk-card flex min-h-[44px] cursor-pointer items-start gap-3 p-3 transition-shadow duration-[var(--transition)] hover:shadow-[var(--shadow-md)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] active:scale-[0.99]"
	{onclick}
	onkeydown={handleKeydown}
>
	<!-- Photo or placeholder -->
	<div class="relative shrink-0">
		{#if item.photo_url}
			<img
				src={item.photo_url}
				alt={item.name}
				class="h-16 w-16 rounded-[var(--radius-md)] object-cover"
				loading="lazy"
			/>
		{:else}
			<div class="nk-tile h-16 w-16" aria-hidden="true">
				<span style="font-size: 1.5rem;">🥫</span>
			</div>
		{/if}

		<!-- Running low badge — corner overlay -->
		{#if item.isRunningLow}
			<span class="nk-badge nk-badge--low absolute -top-1 -right-1" aria-label="Running low">
				Low
			</span>
		{/if}
	</div>

	<!-- Content -->
	<div class="nk-stack min-w-0 flex-1 gap-1">
		<!-- Name -->
		<p
			class="truncate leading-[var(--leading-snug)] font-[var(--font-sans)] [font-weight:var(--weight-semibold)] text-[var(--text)] text-[var(--text-base)]"
		>
			{item.name}
		</p>

		<!-- Quantity + unit -->
		<p class="tabular text-[var(--text-secondary)] text-[var(--text-sm)]">
			{item.quantity}
			{item.unit}
		</p>

		<!-- Storage location badge -->
		<span
			class="nk-chip w-fit text-[var(--text-xs)]"
			aria-label="Stored in {locationLabel(item.storage_location)}"
		>
			{locationLabel(item.storage_location)}
		</span>

		<!-- Expiry badge -->
		{#if item.expiration_date}
			{#if item.isExpired}
				<span
					class="nk-badge nk-badge--error"
					aria-label="Expired on {formatDate(item.expiration_date)}"
				>
					Expired {formatDate(item.expiration_date)}
				</span>
			{:else if item.isExpiringSoon}
				<span
					class="nk-badge nk-badge--warning"
					aria-label="Expires soon on {formatDate(item.expiration_date)}"
				>
					Use by {formatDate(item.expiration_date)}
				</span>
			{:else}
				<span
					class="nk-badge nk-badge--muted"
					aria-label="Expires {formatDate(item.expiration_date)}"
				>
					{formatDate(item.expiration_date)}
				</span>
			{/if}
		{/if}
	</div>
</div>
