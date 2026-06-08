<script lang="ts">
	import { untrack } from 'svelte';
	import IngredientEditor from './IngredientEditor.svelte';
	import StepEditor from './StepEditor.svelte';
	import { signImageUrl } from '$lib/recipes/recipesRepository';
	import { validateRecipeInput, type ValidationError } from '$lib/recipes/recipeValidation';
	import type {
		RecipeWithDetail,
		RecipeInput,
		RecipeIngredientInput,
		RecipeStepInput,
		RecipeTagInput,
		TagCategory
	} from '$lib/recipes/types';

	let {
		initial = null,
		submitLabel = 'Save recipe',
		onSubmit
	}: {
		initial?: RecipeWithDetail | null;
		submitLabel?: string;
		onSubmit: (input: RecipeInput, imageFile: File | null) => Promise<void>;
	} = $props();

	const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'side', 'drink'];
	const TAG_CATEGORIES: TagCategory[] = [
		'DIETARY',
		'CUISINE',
		'MEAL_TYPE',
		'COOKING_METHOD',
		'CUSTOM'
	];

	// Capture the prop once (this form is remounted per recipe) so the $state seeds below don't
	// reactively track `initial` — they intentionally seed once.
	const seed = untrack(() => initial);

	// --- Form state (seeded from `initial` for edit) ---
	let title = $state(seed?.title ?? '');
	let description = $state(seed?.description ?? '');
	let servings = $state(seed?.servings ?? 4);
	let prepTimeMinutes = $state<number | null>(seed?.prepTimeMinutes ?? null);
	let cookTimeMinutes = $state<number | null>(seed?.cookTimeMinutes ?? null);
	let activeTimeMinutes = $state<number | null>(seed?.activeTimeMinutes ?? null);
	let cuisineType = $state(seed?.cuisineType ?? '');
	let notes = $state(seed?.notes ?? '');
	let mealTypes = $state<string[]>(seed?.mealTypes ?? []);

	let ingredients = $state<RecipeIngredientInput[]>(
		seed?.ingredients.map((ing, i) => ({
			uid: crypto.randomUUID(),
			ingredientId: ing.ingredientId,
			name: ing.name,
			quantity: ing.quantity,
			unit: ing.unit,
			preparation: ing.preparation,
			isOptional: ing.isOptional,
			substituteForIndex: null,
			sortOrder: i
		})) ?? [
			{
				uid: crypto.randomUUID(),
				name: '',
				quantity: 1,
				unit: '',
				preparation: '',
				isOptional: false,
				sortOrder: 0
			}
		]
	);

	let steps = $state<RecipeStepInput[]>(
		seed?.steps.map((s, i) => ({
			uid: crypto.randomUUID(),
			instruction: s.instruction,
			durationMinutes: s.durationMinutes,
			timerMinutes: s.timerMinutes,
			timerLabel: s.timerLabel,
			imageUrl: s.imageUrl,
			sortOrder: i
		})) ?? [{ uid: crypto.randomUUID(), instruction: '', sortOrder: 0 }]
	);

	let tags = $state<RecipeTagInput[]>(
		seed?.tags.map((t) => ({ name: t.name, category: t.category })) ?? []
	);
	let newTagName = $state('');
	let newTagCategory = $state<TagCategory>('CUSTOM');

	let imageFile = $state<File | null>(null);
	let imagePreview = $state<string | null>(null);

	// Resolve the existing image (a private-bucket path) to a signed URL for preview, unless the
	// user has already picked a new file (whose blob preview takes precedence).
	$effect(() => {
		if (imageFile) return;
		const path = seed?.imageUrl ?? null;
		if (!path) return;
		let active = true;
		signImageUrl(path).then((url) => {
			if (active && !imageFile) imagePreview = url;
		});
		return () => {
			active = false;
		};
	});

	let errors = $state<ValidationError[]>([]);
	let submitting = $state(false);
	let submitError = $state<string | null>(null);

	function fieldError(field: string): string | null {
		return errors.find((e) => e.field === field)?.message ?? null;
	}

	function toggleMealType(mt: string) {
		mealTypes = mealTypes.includes(mt) ? mealTypes.filter((m) => m !== mt) : [...mealTypes, mt];
	}

	function addTag() {
		const name = newTagName.trim().toLowerCase();
		if (!name) return;
		if (!tags.some((t) => t.name === name && t.category === newTagCategory)) {
			tags = [...tags, { name, category: newTagCategory }];
		}
		newTagName = '';
	}

	function removeTag(index: number) {
		tags = tags.filter((_, i) => i !== index);
	}

	function onImageChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		imageFile = file;
		// Revoke the previous object URL before replacing it (no blob leak).
		if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
		if (file) imagePreview = URL.createObjectURL(file);
	}

	function buildInput(): RecipeInput {
		return {
			title: title.trim(),
			description: description.trim() || null,
			servings,
			prepTimeMinutes,
			cookTimeMinutes,
			activeTimeMinutes,
			cuisineType: cuisineType.trim() || null,
			notes: notes.trim() || null,
			mealTypes,
			imageUrl: initial?.imageUrl ?? null,
			ingredients: ingredients.map((ing, i) => ({ ...ing, sortOrder: i })),
			steps: steps.map((s, i) => ({ ...s, sortOrder: i })),
			tags
		};
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitError = null;
		const input = buildInput();
		errors = validateRecipeInput(input);
		if (errors.length > 0) return;

		submitting = true;
		try {
			await onSubmit(input, imageFile);
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Something went wrong saving your recipe.';
		} finally {
			submitting = false;
		}
	}
</script>

<form class="form nk-stack" onsubmit={handleSubmit} novalidate>
	<label class="field">
		<span class="lbl">Title</span>
		<input
			type="text"
			bind:value={title}
			placeholder="What are you making?"
			aria-invalid={!!fieldError('title')}
		/>
		{#if fieldError('title')}<span class="err">{fieldError('title')}</span>{/if}
	</label>

	<label class="field">
		<span class="lbl">Description (optional)</span>
		<textarea rows="2" bind:value={description} placeholder="A short note about this dish"
		></textarea>
	</label>

	<div class="numbers">
		<label class="field">
			<span class="lbl">Servings</span>
			<input
				type="number"
				min="1"
				max="100"
				bind:value={servings}
				aria-invalid={!!fieldError('servings')}
			/>
			{#if fieldError('servings')}<span class="err">{fieldError('servings')}</span>{/if}
		</label>
		<label class="field">
			<span class="lbl">Prep (min)</span>
			<input type="number" min="0" bind:value={prepTimeMinutes} />
		</label>
		<label class="field">
			<span class="lbl">Cook (min)</span>
			<input type="number" min="0" bind:value={cookTimeMinutes} />
		</label>
		<label class="field">
			<span class="lbl">Hands-on (min)</span>
			<input
				type="number"
				min="0"
				bind:value={activeTimeMinutes}
				aria-invalid={!!fieldError('activeTimeMinutes')}
			/>
		</label>
	</div>
	{#if fieldError('activeTimeMinutes')}<span class="err">{fieldError('activeTimeMinutes')}</span
		>{/if}

	<label class="field">
		<span class="lbl">Cuisine (optional)</span>
		<input type="text" bind:value={cuisineType} placeholder="e.g. Indian" />
	</label>

	<div class="field">
		<span class="lbl">Meal types</span>
		<div class="chips">
			{#each MEAL_TYPES as mt (mt)}
				<button
					type="button"
					class="nk-chip toggle"
					class:selected={mealTypes.includes(mt)}
					aria-pressed={mealTypes.includes(mt)}
					onclick={() => toggleMealType(mt)}>{mt}</button
				>
			{/each}
		</div>
	</div>

	<div class="field">
		<span class="lbl">Photo (optional)</span>
		{#if imagePreview}
			<img class="preview" src={imagePreview} alt="Recipe preview" />
		{/if}
		<input type="file" accept="image/*" onchange={onImageChange} aria-label="Recipe photo" />
	</div>

	<IngredientEditor bind:ingredients />
	{#if fieldError('ingredients')}<span class="err">{fieldError('ingredients')}</span>{/if}

	<StepEditor bind:steps />
	{#if fieldError('steps')}<span class="err">{fieldError('steps')}</span>{/if}

	<div class="field">
		<span class="lbl">Tags</span>
		<div class="chips">
			{#each tags as tag, i (tag.category + tag.name)}
				<span class="nk-chip">
					{tag.name}
					<button
						type="button"
						class="tag-x"
						onclick={() => removeTag(i)}
						aria-label="Remove tag {tag.name}">×</button
					>
				</span>
			{/each}
		</div>
		<div class="add-tag">
			<input
				type="text"
				bind:value={newTagName}
				placeholder="add a tag"
				aria-label="New tag name"
			/>
			<select bind:value={newTagCategory} aria-label="Tag category">
				{#each TAG_CATEGORIES as c (c)}
					<option value={c}>{c.toLowerCase().replace('_', ' ')}</option>
				{/each}
			</select>
			<button type="button" class="nk-btn nk-btn--secondary nk-btn--sm" onclick={addTag}>Add</button
			>
		</div>
	</div>

	{#if submitError}
		<p class="nk-note" role="alert">{submitError}</p>
	{/if}

	<div class="actions">
		<button type="submit" class="nk-btn nk-btn--primary nk-btn--lg" disabled={submitting}>
			{submitting ? 'Saving…' : submitLabel}
		</button>
	</div>
</form>

<style>
	.form {
		gap: var(--space-5);
		max-width: 720px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.lbl {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--text-secondary);
	}
	.numbers {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-3);
	}
	input[type='text'],
	input[type='number'],
	input[type='file'],
	textarea,
	select {
		min-height: var(--tap-min);
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-base);
		font-family: var(--font-sans);
		color: var(--text);
		background: var(--surface);
		border: 1.5px solid var(--border);
		border-radius: var(--radius-sm);
	}
	textarea {
		resize: vertical;
	}
	input:focus-visible,
	textarea:focus-visible,
	select:focus-visible {
		outline: 3px solid var(--focus-ring);
		outline-offset: 1px;
		border-color: var(--primary);
	}
	input[aria-invalid='true'] {
		border-color: var(--attention);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.toggle {
		cursor: pointer;
		border-color: var(--border);
		min-height: var(--tap-min); /* accessibility tap floor (REQ-AC-002) */
	}
	.toggle.selected {
		background: var(--primary-soft);
		color: var(--primary-text);
		border-color: var(--primary);
	}
	.tag-x {
		display: inline-grid;
		place-items: center;
		min-width: var(--tap-min);
		min-height: var(--tap-min);
		margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: var(--text-md);
		line-height: 1;
	}
	.add-tag {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-2);
		flex-wrap: wrap;
	}
	.add-tag input {
		flex: 1 1 160px;
	}
	.preview {
		width: 100%;
		max-width: 280px;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: var(--radius-md);
		border: 1px solid var(--border);
		margin-bottom: var(--space-2);
	}
	.err {
		color: var(--attention);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
	}
	.actions {
		margin-top: var(--space-2);
	}
	@media (max-width: 560px) {
		.numbers {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>
