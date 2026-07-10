<script lang="ts">
	import { verdictLabel, type MealVerdict } from '$lib/log';

	interface Props {
		value: MealVerdict | null;
		onChange: (verdict: MealVerdict | null) => void;
		/** Tighter paddings for inline rows (recap card, meal card footers). */
		compact?: boolean;
		disabled?: boolean;
	}

	let { value, onChange, compact = false, disabled = false }: Props = $props();

	// Icon + word always together — never color alone (design voice rules).
	const OPTIONS = [
		{ verdict: 'KEEP', data: 'keep', icon: 'ph-fill ph-heart' },
		{ verdict: 'FINE', data: 'fine', icon: 'ph ph-equals' },
		{ verdict: 'REST', data: 'rest', icon: 'ph ph-moon' }
	] as const;
</script>

<!--
	VerdictControl — the calm three-way "How was it?" (FR-TL-015), wrapping the
	.nk-verdict primitive from base.css per design/screens/mobile-log.html.
	Single-select and de-selectable: tapping the current verdict clears it.
-->
<div class="nk-verdict" class:verdict--compact={compact} role="group" aria-label="How was it?">
	{#each OPTIONS as opt (opt.verdict)}
		<button
			type="button"
			class="nk-verdict__opt"
			data-v={opt.data}
			aria-pressed={value === opt.verdict}
			{disabled}
			onclick={() => onChange(value === opt.verdict ? null : opt.verdict)}
		>
			<i class={opt.icon} aria-hidden="true"></i>
			{verdictLabel(opt.verdict)}
		</button>
	{/each}
</div>

<style>
	.verdict--compact :global(.nk-verdict__opt) {
		flex: 1;
		justify-content: center;
		min-height: 38px;
		padding: 0 var(--space-2);
		gap: 5px;
		font-size: var(--text-2xs);
	}
	.verdict--compact {
		display: flex;
		width: 100%;
	}
</style>
