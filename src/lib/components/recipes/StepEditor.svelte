<script lang="ts">
	import type { RecipeStepInput } from '$lib/recipes/types';

	let { steps = $bindable() }: { steps: RecipeStepInput[] } = $props();

	function resequence() {
		steps = steps.map((step, i) => ({ ...step, sortOrder: i }));
	}

	function addStep() {
		steps = [...steps, { uid: crypto.randomUUID(), instruction: '', sortOrder: steps.length }];
	}

	function removeStep(index: number) {
		steps = steps.filter((_, i) => i !== index);
		resequence();
	}

	function move(index: number, delta: number) {
		const target = index + delta;
		if (target < 0 || target >= steps.length) return;
		const next = [...steps];
		[next[index], next[target]] = [next[target], next[index]];
		steps = next;
		resequence();
	}
</script>

<fieldset class="editor">
	<legend class="nk-eyebrow">Steps</legend>

	{#each steps as step, i (step.uid ?? i)}
		<div class="row nk-card">
			<div class="head">
				<span class="num" aria-hidden="true">{i + 1}</span>
				<div class="nk-row reorder">
					<button
						type="button"
						class="nk-btn nk-btn--ghost nk-btn--sm"
						onclick={() => move(i, -1)}
						disabled={i === 0}
						aria-label="Move step {i + 1} up">↑</button
					>
					<button
						type="button"
						class="nk-btn nk-btn--ghost nk-btn--sm"
						onclick={() => move(i, 1)}
						disabled={i === steps.length - 1}
						aria-label="Move step {i + 1} down">↓</button
					>
					<button
						type="button"
						class="nk-btn nk-btn--ghost nk-btn--sm remove"
						onclick={() => removeStep(i)}
						aria-label="Remove step {i + 1}">Remove</button
					>
				</div>
			</div>

			<label class="field">
				<span class="lbl">Instruction</span>
				<textarea
					rows="2"
					placeholder="What happens in this step?"
					bind:value={step.instruction}
					aria-label="Instruction for step {i + 1}"
				></textarea>
			</label>

			<div class="timing">
				<label class="field">
					<span class="lbl">Timer (min, optional)</span>
					<input
						type="number"
						min="0"
						inputmode="numeric"
						bind:value={step.timerMinutes}
						aria-label="Timer minutes for step {i + 1}"
					/>
				</label>
				<label class="field">
					<span class="lbl">Timer label (optional)</span>
					<input
						type="text"
						placeholder="Simmer sauce"
						bind:value={step.timerLabel}
						aria-label="Timer label for step {i + 1}"
					/>
				</label>
			</div>
		</div>
	{/each}

	<button type="button" class="nk-btn nk-btn--secondary" onclick={addStep}>+ Add step</button>
</fieldset>

<style>
	.editor {
		border: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	legend {
		margin-bottom: var(--space-2);
		padding: 0;
	}
	.row {
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.num {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-pill);
		background: var(--primary-soft);
		color: var(--primary-text);
		font-weight: var(--weight-bold);
		font-size: var(--text-sm);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
	}
	.lbl {
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
	.timing {
		display: grid;
		grid-template-columns: 160px 1fr;
		gap: var(--space-2);
	}
	input,
	textarea {
		min-height: var(--tap-min);
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-base);
		font-family: var(--font-sans);
		color: var(--text);
		background: var(--surface);
		border: 1.5px solid var(--border);
		border-radius: var(--radius-sm);
		resize: vertical;
	}
	input:focus-visible,
	textarea:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--primary);
	}
	.reorder {
		gap: var(--space-1);
	}
	.remove {
		color: var(--attention);
	}
	@media (max-width: 560px) {
		.timing {
			grid-template-columns: 1fr;
		}
	}
</style>
