<script lang="ts">
	import type { PreppedMeal } from '$lib/pantry/types';

	interface Props {
		/** Prepped portions to surface as a gentle suggestion (caller passes the placeable set). */
		portions: PreppedMeal[];
		heading?: string;
	}

	let { portions, heading = 'Already prepped' }: Props = $props();

	// Nearest-expiry first ("eat this first"); spread so we never mutate caller state.
	const sorted = $derived(
		[...portions].sort((a, b) => a.expiration_date.localeCompare(b.expiration_date))
	);

	// expiration_date is a bare date — parse as UTC to avoid a TZ off-by-one.
	function formatDate(iso: string): string {
		return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}
</script>

<!--
	Passive, non-forcing suggestion (REQ-PP-025/026): shows what's already prepped with
	expiry indicators so the user can choose to lean on it. It never selects anything.
-->
{#if sorted.length > 0}
	<section aria-labelledby="prepped-suggestion-heading" class="flex flex-col gap-2">
		<h3 id="prepped-suggestion-heading" class="nk-eyebrow text-[var(--text-secondary)]">
			{heading}
		</h3>
		<ul
			class="nk-scroll flex list-none gap-2 overflow-x-auto p-0 pb-1"
			aria-label="Prepped portions you already have"
		>
			{#each sorted as portion (portion.id)}
				<li class="nk-card flex min-w-[10rem] flex-col gap-1 p-3">
					<span
						class="truncate font-[var(--font-sans)] [font-weight:var(--weight-semibold)] text-[var(--text)] text-[var(--text-sm)]"
					>
						{portion.name}
					</span>
					<span class="text-[var(--text-muted)] text-[var(--text-xs)]">
						{portion.portions_remaining}
						portion{portion.portions_remaining === 1 ? '' : 's'}
					</span>
					{#if portion.isExpired}
						<span class="nk-badge nk-badge--error text-[var(--text-xs)]">
							Expired {formatDate(portion.expiration_date)}
						</span>
					{:else if portion.isExpiringSoon}
						<span class="nk-badge nk-badge--warning text-[var(--text-xs)]">
							Eat by {formatDate(portion.expiration_date)}
						</span>
					{:else}
						<span class="text-[var(--text-muted)] text-[var(--text-xs)]">
							Good until {formatDate(portion.expiration_date)}
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}
