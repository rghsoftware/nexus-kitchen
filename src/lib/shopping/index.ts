// Public surface of the shopping feature (the buy-gap operation).

export * from './types';
export { categorize } from './categorize';
export {
	computeBuyGaps,
	type GapResult,
	type IngredientGap,
	type StoreBoughtGap
} from './generation';
export {
	carryOverItems,
	completeTrip,
	defaultAdditions,
	planReplenishment,
	type CompletionReport,
	type PantryAddition,
	type PortionAddition,
	type ReplenishmentPlan
} from './replenishment';
export { ShoppingError } from './shoppingService';
