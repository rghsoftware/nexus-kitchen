// Public surface of the planning feature.

export {
	MEAL_SLOTS,
	mealSlotLabel,
	plannedMealName,
	type ISODate,
	type MealPlan,
	type MealSlot,
	type PlannedMeal,
	type PlannedMealDraft,
	type PlannedMealPatch,
	type PlannedMealPlacement,
	type PlannedMealSource,
	type PlannedMealStatus
} from './types';

export { PlanningError } from './planningService';

export {
	buildPantryNameIndex,
	deriveFulfillment,
	inputsFromSnapshot,
	normalizeName,
	type FulfillmentInputs,
	type FulfillmentResult,
	type FulfillmentState,
	type IngredientForMatch
} from './fulfillment';

export {
	addMeal,
	clearPlanError,
	fulfillmentFor,
	loadFulfillmentInputs,
	loadRange,
	loadedRange,
	mealsInGroup,
	mealsOn,
	moveMeal,
	planError,
	planLoading,
	plannedMeals,
	removeMeal,
	updateMeal
} from './planStore.svelte';

// Meal-prep batch sessions (feature 006).
export {
	toMealPrepSession,
	toMealPrepSessionRecipe,
	type MealPrepSession,
	type MealPrepSessionRecipe,
	type MealPrepSessionStatus,
	type NewMealPrepSession,
	type NewSessionRecipe,
	type YieldChoice,
	type PrepShoppingGapItem
} from './mealPrep/types';

export { MealPrepServiceError } from './mealPrep/mealPrepService';

export { isNotPast, isWeekend, suggestPrepDay } from './mealPrep/prepDay';

export {
	computePrepShoppingGap,
	type PrepRecipeIngredient,
	type RecipeForPrep
} from './mealPrep/prepShoppingList';

export {
	addRecipeAction,
	buildPrepShoppingListAction,
	cancelSessionAction,
	completeSessionAction,
	createSessionAction,
	loadSessions,
	plannedSessions,
	removeRecipeAction,
	sessions,
	sessionsError,
	sessionsLoaded,
	sessionsLoading
} from './mealPrep/mealPrepStore.svelte';

export {
	addDays,
	dayFullLabel,
	dayLabel,
	dayOfMonth,
	isSameMonth,
	mondayOf,
	monthEndOf,
	monthGridDates,
	monthGridRange,
	monthLabel,
	monthStartOf,
	todayLocalISO,
	weekDatesOf,
	weekLabel,
	weekRangeOf,
	weekdayLabel
} from './weekMath';
