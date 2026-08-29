import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { generatePrepShoppingList } from './mealPrepService';

vi.mock('$lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
vi.mock('$lib/session/session.svelte', () => ({
	currentUser: vi.fn().mockResolvedValue({ id: 'user-1' })
}));
vi.mock('$lib/pantry/preppedMealService', () => ({ addPreppedMeal: vi.fn() }));
vi.mock('$lib/pantry/pantryService', () => ({ getPantryItems: vi.fn().mockResolvedValue([]) }));
vi.mock('$lib/recipes', () => ({ recipesRepository: { getRecipe: vi.fn() } }));
vi.mock('$lib/shopping/shoppingService', () => ({ addItems: vi.fn().mockResolvedValue([]) }));

import { supabase } from '$lib/supabaseClient';
import { getPantryItems } from '$lib/pantry/pantryService';
import { recipesRepository } from '$lib/recipes';
import { addItems } from '$lib/shopping/shoppingService';

type Result = { data: unknown; error: unknown };

function chainFor(result: Result) {
	const chain: Record<string, unknown> = {};
	for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit']) {
		chain[m] = vi.fn().mockReturnValue(chain);
	}
	chain.single = vi.fn().mockResolvedValue(result);
	chain.maybeSingle = vi.fn().mockResolvedValue(result);
	chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
	return chain;
}

const sessionRow = {
	id: 'sess-1',
	status: 'PLANNED',
	prep_day: '2026-06-20',
	completed_at: null,
	meal_prep_session_recipes: [
		{ id: 'sr-1', recipe_id: 'r-1', recipe_name: 'Chili', servings_to_prep: 8 }
	]
};

let shoppingInsert: Mock;

beforeEach(() => {
	vi.clearAllMocks();
	(getPantryItems as Mock).mockResolvedValue([{ name: 'Onion', quantity: 5 }]); // onion on hand
	(recipesRepository.getRecipe as Mock).mockResolvedValue({
		id: 'r-1',
		servings: 4,
		ingredients: [
			{ name: 'Kidney beans', unit: 'g', quantity: 400, isOptional: false },
			{ name: 'Onion', unit: 'whole', quantity: 1, isOptional: false }, // on hand → dropped
			{ name: 'Coriander', unit: 'g', quantity: 10, isOptional: true } // optional → dropped
		]
	});

	(supabase.from as Mock).mockImplementation((table: string) => {
		if (table === 'meal_prep_sessions') return chainFor({ data: sessionRow, error: null });
		if (table === 'shopping_lists') {
			const chain = chainFor({ data: { id: 'list-1' }, error: null });
			shoppingInsert = chain.insert as Mock;
			return chain;
		}
		return chainFor({ data: null, error: null });
	});
});

describe('generatePrepShoppingList (REQ-PP-019..022, INV-XD-004)', () => {
	it('creates a FROM_PREP list referencing the session', async () => {
		const result = await generatePrepShoppingList('sess-1');

		expect(result.shoppingListId).toBe('list-1');
		expect(shoppingInsert).toHaveBeenCalledWith(
			expect.objectContaining({ source_type: 'FROM_PREP', meal_prep_session_id: 'sess-1' })
		);
	});

	it('adds only the gap items (on-hand + optional dropped), scaled, with recipe attribution', async () => {
		const result = await generatePrepShoppingList('sess-1');

		expect(result.itemCount).toBe(1);
		expect(addItems).toHaveBeenCalledWith('list-1', [
			expect.objectContaining({
				name: 'Kidney beans',
				quantity: 800, // 400 × (8/4)
				unit: 'g',
				neededFor: [{ recipeId: 'r-1', title: 'Chili' }]
			})
		]);
	});
});
