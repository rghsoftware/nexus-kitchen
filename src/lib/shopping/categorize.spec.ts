import { describe, expect, it } from 'vitest';
import { categorize } from './categorize';

describe('categorize', () => {
	it('maps common produce names', () => {
		expect(categorize('Onions')).toBe('PRODUCE');
		expect(categorize('bell pepper')).toBe('PRODUCE');
		expect(categorize('  Baby   Spinach ')).toBe('PRODUCE');
	});

	it('maps dairy and meat', () => {
		expect(categorize('Whole milk')).toBe('DAIRY');
		expect(categorize('Chicken thighs')).toBe('MEAT_SEAFOOD');
	});

	it('prefers the more specific (longer) keyword across categories', () => {
		// "butternut squash" (PRODUCE) must win over "butter" (DAIRY)
		expect(categorize('butternut squash')).toBe('PRODUCE');
		// "coconut milk" (CANNED) must win over "milk" (DAIRY)
		expect(categorize('Coconut milk')).toBe('CANNED');
		// "chicken broth"/"beef stock" (CANNED) must win over "chicken"/"beef" (MEAT_SEAFOOD)
		expect(categorize('Chicken broth')).toBe('CANNED');
		expect(categorize('beef stock')).toBe('CANNED');
	});

	it('matches whole words only', () => {
		// "ham" must not fire inside "graham crackers"
		expect(categorize('graham crackers')).toBe('OTHER');
	});

	it('defaults unknown and empty names to OTHER', () => {
		expect(categorize('mystery thing')).toBe('OTHER');
		expect(categorize('   ')).toBe('OTHER');
	});

	it('maps pantry staples and bakery', () => {
		expect(categorize('olive oil')).toBe('PANTRY_STAPLES');
		expect(categorize('sourdough bread')).toBe('BAKERY');
	});
});
