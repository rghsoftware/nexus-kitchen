<script lang="ts">
	import type { RecipeIngredientInput } from '$lib/recipes/types';

	let { ingredients = $bindable() }: { ingredients: RecipeIngredientInput[] } = $props();

	function resequence() {
		ingredients = ingredients.map((ing, i) => ({ ...ing, sortOrder: i }));
	}

	function addIngredient() {
		ingredients = [
			...ingredients,
			{
				uid: crypto.randomUUID(),
				name: '',
				quantity: 1,
				unit: '',
				preparation: '',
				isOptional: false,
				sortOrder: ingredients.length
			}
		];
	}

	function removeIngredient(index: number) {
		ingredients = ingredients.filter((_, i) => i !== index);
		// Drop now-dangling substitute references, then resequence.
		ingredients = ingredients.map((ing) => ({
			...ing,
			substituteForIndex:
				ing.substituteForIndex != null && ing.substituteForIndex === index
					? null
					: ing.substituteForIndex
		}));
		resequence();
	}

	function move(index: number, delta: number) {
		const target = index + delta;
		if (target < 0 || target >= ingredients.length) return;
		const next = [...ingredients];
		[next[index], next[target]] = [next[target], next[index]];
		ingredients = next;
		resequence();
	}
</script>

<fieldset class="editor">
	<legend class="nk-eyebrow">Ingredients</legend>

	{#each ingredients as ingredient, i (ingredient.uid ?? i)}
		<div class="row nk-card">
			<div class="grid">
				<label class="field qty">
					<span class="lbl">Amount</span>
					<input
						type="number"
						min="0"
						step="any"
						inputmode="decimal"
						bind:value={ingredient.quantity}
						aria-label="Quantity for ingredient {i + 1}"
					/>
				</label>
				<label class="field unit">
					<span class="lbl">Unit</span>
					<input
						type="text"
						placeholder="cup"
						bind:value={ingredient.unit}
						aria-label="Unit for ingredient {i + 1}"
					/>
				</label>
				<label class="field name">
					<span class="lbl">Ingredient</span>
					<input
						type="text"
						placeholder="e.g. chicken thighs"
						bind:value={ingredient.name}
						aria-label="Name for ingredient {i + 1}"
					/>
				</label>
				<label class="field prep">
					<span class="lbl">Prep (optional)</span>
					<input
						type="text"
						placeholder="diced"
						bind:value={ingredient.preparation}
						aria-label="Preparation for ingredient {i + 1}"
					/>
				</label>
			</div>

			<div class="controls">
				<label class="optional">
					<input type="checkbox" bind:checked={ingredient.isOptional} />
					<span>Optional</span>
				</label>
				<div class="nk-row reorder">
					<button
						type="button"
						class="nk-btn nk-btn--ghost nk-btn--sm"
						onclick={() => move(i, -1)}
						disabled={i === 0}
						aria-label="Move ingredient {i + 1} up">↑</button
					>
					<button
						type="button"
						class="nk-btn nk-btn--ghost nk-btn--sm"
						onclick={() => move(i, 1)}
						disabled={i === ingredients.length - 1}
						aria-label="Move ingredient {i + 1} down">↓</button
					>
					<button
						type="button"
						class="nk-btn nk-btn--ghost nk-btn--sm remove"
						onclick={() => removeIngredient(i)}
						aria-label="Remove ingredient {i + 1}">Remove</button
					>
				</div>
			</div>
		</div>
	{/each}

	<button type="button" class="nk-btn nk-btn--secondary" onclick={addIngredient}
		>+ Add ingredient</button
	>
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
	.grid {
		display: grid;
		grid-template-columns: 90px 90px 1fr 1fr;
		gap: var(--space-2);
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
	input[type='text'],
	input[type='number'] {
		min-height: var(--tap-min);
		padding: 0 var(--space-3);
		font-size: var(--text-base);
		font-family: var(--font-sans);
		color: var(--text);
		background: var(--surface);
		border: 1.5px solid var(--border);
		border-radius: var(--radius-sm);
	}
	input:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--primary);
	}
	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.optional {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}
	.reorder {
		gap: var(--space-1);
	}
	.remove {
		color: var(--attention);
	}
	@media (max-width: 560px) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
		.name,
		.prep {
			grid-column: 1 / -1;
		}
	}
</style>
