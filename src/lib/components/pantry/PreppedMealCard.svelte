<script lang="ts">
	import type { PreppedMeal } from '$lib/pantry/types';

	interface Props {
		meal: PreppedMeal;
		onConsume?: (id: string, count: number) => void;
		onStartDefrost?: (id: string) => void;
		onMarkReady?: (id: string) => void;
		onEdit?: (meal: PreppedMeal) => void;
	}

	let { meal, onConsume, onStartDefrost, onMarkReady, onEdit }: Props = $props();

	function formatDate(isoDate: string): string {
		// expiration_date is a bare date string — parse as UTC to avoid TZ off-by-one
		const d = new Date(isoDate + 'T00:00:00Z');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
	}

	function formatDatetime(isoDatetime: string): string {
		const d = new Date(isoDatetime);
		return d.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function originLabel(origin: PreppedMeal['origin']): string {
		switch (origin) {
			case 'DIRECT_ENTRY':
				return 'Made';
			case 'STORE_BOUGHT':
				return 'Bought';
			case 'PREP_SESSION':
				return 'Prepped';
		}
	}

	function handleCardKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onEdit?.(meal);
		}
	}

	function handleEat(e: MouseEvent) {
		e.stopPropagation();
		onConsume?.(meal.id, 1);
	}

	function handleEatKeydown(e: KeyboardEvent) {
		e.stopPropagation();
	}

	function handleDefrost(e: MouseEvent) {
		e.stopPropagation();
		onStartDefrost?.(meal.id);
	}

	function handleDefrostKeydown(e: KeyboardEvent) {
		e.stopPropagation();
	}

	function handleReady(e: MouseEvent) {
		e.stopPropagation();
		onMarkReady?.(meal.id);
	}

	function handleReadyKeydown(e: KeyboardEvent) {
		e.stopPropagation();
	}
</script>

<!--
	PreppedMealCard — displays a single prepped meal with defrost + consume actions.
	Card body is a div[role=button] to allow inner <button> elements without nesting.
	Touch targets: all buttons min-h-[44px] via .nk-btn.
	Color is never the sole indicator — all states use text labels alongside color.
-->
<div
	role="button"
	tabindex="0"
	aria-label="Edit {meal.name}"
	class="nk-card flex min-h-[44px] cursor-pointer flex-col gap-3 p-3 transition-shadow duration-[var(--transition)] hover:shadow-[var(--shadow-md)] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] active:scale-[0.99]"
	onclick={() => onEdit?.(meal)}
	onkeydown={handleCardKeydown}
>
	<!-- Top row: photo + meta -->
	<div class="flex items-start gap-3">
		<!-- Photo or placeholder -->
		<div class="shrink-0">
			{#if meal.photo_url}
				<img
					src={meal.photo_url}
					alt={meal.name}
					class="h-16 w-16 rounded-[var(--radius-md)] object-cover"
					loading="lazy"
				/>
			{:else}
				<div class="nk-tile h-16 w-16" aria-hidden="true">
					<span style="font-size: 1.5rem;">🍱</span>
				</div>
			{/if}
		</div>

		<!-- Name + badges -->
		<div class="nk-stack min-w-0 flex-1 gap-1">
			<p
				class="truncate leading-[var(--leading-snug)] font-[var(--font-sans)] font-[var(--weight-semibold)] text-[var(--text)] text-[var(--text-base)]"
			>
				{meal.name}
			</p>

			<!-- Origin + portions row -->
			<div class="nk-row flex-wrap gap-1.5">
				<span class="nk-chip text-[var(--text-xs)]">
					{originLabel(meal.origin)}
				</span>
				<span
					class="nk-chip text-[var(--text-xs)]"
					aria-label="{meal.portions_remaining} portion{meal.portions_remaining === 1
						? ''
						: 's'} remaining"
				>
					{meal.portions_remaining} portion{meal.portions_remaining === 1 ? '' : 's'}
				</span>
			</div>

			<!-- Expiry badge -->
			{#if meal.isExpired}
				<span
					class="nk-badge nk-badge--error"
					aria-label="Expired on {formatDate(meal.expiration_date)}"
				>
					Expired {formatDate(meal.expiration_date)}
				</span>
			{:else if meal.isExpiringSoon}
				<span
					class="nk-badge nk-badge--warning"
					aria-label="Expires soon — eat by {formatDate(meal.expiration_date)}"
				>
					Eat by {formatDate(meal.expiration_date)}
				</span>
			{:else}
				<span
					class="nk-badge nk-badge--muted"
					aria-label="Good until {formatDate(meal.expiration_date)}"
				>
					{formatDate(meal.expiration_date)}
				</span>
			{/if}
		</div>
	</div>

	<!-- Defrost status + actions row -->
	{#if meal.defrost_state === 'FROZEN' || meal.defrost_state === 'DEFROSTING'}
		<div
			class="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2"
			role="group"
			aria-label="Defrost controls"
		>
			{#if meal.defrost_state === 'FROZEN'}
				<span class="nk-chip" aria-label="Currently frozen"> Frozen </span>
				<button
					class="nk-btn nk-btn--secondary nk-btn--sm"
					onclick={handleDefrost}
					onkeydown={handleDefrostKeydown}
					aria-label="Start defrosting {meal.name}"
				>
					Defrost
				</button>
			{:else if meal.defrost_state === 'DEFROSTING'}
				<span
					class="nk-chip"
					style="color: var(--info); border-color: var(--info);"
					aria-label="Defrosting"
				>
					Defrosting
				</span>
				{#if meal.estimated_ready_at}
					<p class="text-[var(--text-muted)] text-[var(--text-sm)]">
						Ready around {formatDatetime(meal.estimated_ready_at)}
					</p>
				{/if}
				<button
					class="nk-btn nk-btn--secondary nk-btn--sm"
					onclick={handleReady}
					onkeydown={handleReadyKeydown}
					aria-label="Mark {meal.name} as ready to eat"
				>
					Ready
				</button>
			{/if}
		</div>
	{/if}

	<!-- Quick eat action -->
	<div class="border-t border-[var(--border)] pt-2">
		<button
			class="nk-btn nk-btn--primary nk-btn--sm"
			disabled={meal.portions_remaining === 0}
			onclick={handleEat}
			onkeydown={handleEatKeydown}
			aria-label="Eat 1 portion of {meal.name}"
		>
			Eat 1
		</button>
	</div>
</div>
