// Keyword categorizer for shopping items (FR-SH-019). Pure, no I/O. A miss lands in
// OTHER — calm and user-correctable, never wrong-looking. Matching is on whole words
// of the normalized name so "butter" doesn't fire inside "butternut squash" (which
// has its own PRODUCE keyword).

import { normalizeName } from '$lib/planning/fulfillment';
import type { ShoppingCategory } from './types';

// The longest matching keyword wins across all categories; KEYWORDS order only
// breaks equal-length ties (see categorize()). Keep entries lowercase, singular
// where the plural contains the singular.
const KEYWORDS: readonly [ShoppingCategory, readonly string[]][] = [
	['FROZEN', ['frozen', 'ice cream', 'popsicle', 'frozen peas', 'frozen corn', 'frozen berries']],
	[
		'CANNED',
		[
			'canned',
			'can of',
			'crushed tomatoes',
			'tomato paste',
			'tomato sauce',
			'black beans',
			'kidney beans',
			'chickpeas',
			'garbanzo',
			'coconut milk',
			'broth',
			// Cross-category names: longer than 'chicken'/'beef', so the canned
			// good wins over MEAT_SEAFOOD.
			'chicken broth',
			'beef broth',
			'chicken stock',
			'beef stock',
			'stock',
			'soup'
		]
	],
	[
		'DAIRY',
		[
			'milk',
			'butter',
			'cheese',
			'cheddar',
			'mozzarella',
			'parmesan',
			'yogurt',
			'cream',
			'sour cream',
			'half and half',
			'egg',
			'eggs'
		]
	],
	[
		'MEAT_SEAFOOD',
		[
			'chicken',
			'beef',
			'pork',
			'turkey',
			'lamb',
			'bacon',
			'sausage',
			'ham',
			'ground beef',
			'steak',
			'fish',
			'salmon',
			'tuna',
			'shrimp',
			'cod',
			'tilapia'
		]
	],
	[
		'BAKERY',
		['bread', 'bagel', 'bun', 'buns', 'roll', 'rolls', 'tortilla', 'pita', 'croissant', 'baguette']
	],
	[
		'PRODUCE',
		[
			'apple',
			'banana',
			'orange',
			'lemon',
			'lime',
			'berries',
			'strawberry',
			'blueberry',
			'grape',
			'avocado',
			'tomato',
			'potato',
			'onion',
			'garlic',
			'carrot',
			'celery',
			'lettuce',
			'spinach',
			'kale',
			'broccoli',
			'cauliflower',
			'pepper',
			'bell pepper',
			'cucumber',
			'zucchini',
			'squash',
			'butternut squash',
			'mushroom',
			'cilantro',
			'parsley',
			'basil',
			'ginger',
			'scallion',
			'green onion',
			'cabbage',
			'corn'
		]
	],
	[
		'PANTRY_STAPLES',
		[
			'flour',
			'sugar',
			'salt',
			'pepper flakes',
			'black pepper',
			'rice',
			'pasta',
			'spaghetti',
			'noodle',
			'oil',
			'olive oil',
			'vinegar',
			'soy sauce',
			'honey',
			'peanut butter',
			'cereal',
			'oats',
			'oatmeal',
			'spice',
			'cumin',
			'paprika',
			'cinnamon',
			'vanilla',
			'baking powder',
			'baking soda',
			'lentil',
			'quinoa',
			'dried'
		]
	]
];

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * True when `phrase` appears in `name` on whole-word boundaries; the phrase's last
 * word may carry a simple plural suffix ("onion" matches "onions", "tomato" matches
 * "tomatoes") so keyword lists stay singular.
 */
function hasPhrase(name: string, phrase: string): boolean {
	return new RegExp(`(^|[^a-z0-9])${escapeRegExp(phrase)}(s|es)?($|[^a-z0-9])`).test(name);
}

/**
 * Suggest a built-in category for an item name. Longer (more specific) keyword
 * matches win over shorter ones across all categories; ties go to earlier
 * categories in KEYWORDS order. Unknown names → OTHER.
 */
export function categorize(name: string): ShoppingCategory {
	const normalized = normalizeName(name);
	if (normalized.length === 0) return 'OTHER';

	let best: { category: ShoppingCategory; length: number } | null = null;
	for (const [category, phrases] of KEYWORDS) {
		for (const phrase of phrases) {
			if (phrase.length > (best?.length ?? 0) && hasPhrase(normalized, phrase)) {
				best = { category, length: phrase.length };
			}
		}
	}
	return best?.category ?? 'OTHER';
}
