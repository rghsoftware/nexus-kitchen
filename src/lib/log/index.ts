// Public surface of the log module (feature 006). UI imports from here; the
// generated database types never leak past types.ts.

export {
	mealLogName,
	toMealLog,
	verdictLabel,
	type MealLog,
	type MealLogDraft,
	type MealLogType,
	type MealVerdict
} from './types';

export {
	LogError,
	createLog,
	fetchLogsBetween,
	fetchRecentLogs,
	markPlannedMealLogged,
	setVerdict
} from './logService';

export {
	deriveNudge,
	localDateISO,
	localDayBounds,
	nudgeDismissKey,
	slotForTime,
	type NudgeState
} from './slots';

export {
	deriveDayCoverage,
	groupLogSources,
	isDayCovered,
	keepers,
	recents,
	unratedRecent,
	type CoverageState,
	type DayCoverage,
	type LoggedSource,
	type MealWithFulfillment,
	type SlotCoverage
} from './derive';

export {
	clearLogError,
	clearLogNotice,
	loadRecents,
	loadToday,
	logError,
	logLoading,
	logMeal,
	logNotice,
	rateLog,
	recentLogs,
	recentSources,
	todayLogs
} from './logStore.svelte';
