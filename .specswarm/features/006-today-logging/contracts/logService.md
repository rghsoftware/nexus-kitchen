# Contract: log module

PostgREST tables touched: `meal_logs` (new, INSERT/SELECT/UPDATE), `planned_meals`
(UPDATE status safe-flip), `portion_events` (INSERT via existing pantry consume path),
`prepped_meals` (SELECT via existing store).

```ts
// src/lib/log/logService.ts — stateless; every fn awaits requireSession(); errors
// rethrown as LogError with calm message; no owner filters (RLS authoritative).

/** Insert one meal log from a draft. Returns the persisted, mapped row. */
export async function createLog(draft: MealLogDraft, loggedAt?: string): Promise<MealLog>;

/** Set or clear the verdict on an existing log (annotation window, R2). */
export async function setVerdict(logId: string, verdict: MealVerdict | null): Promise<MealLog>;

/** Logs in [fromISO, toISO) for the current user, newest first. */
export async function fetchLogsBetween(fromISO: string, toISO: string): Promise<MealLog[]>;

/** Latest `limit` non-QUICK_LOG logs (for recents/keepers grouping). */
export async function fetchRecentLogs(limit?: number): Promise<MealLog[]>; // default 100

/** Safe-flip: PLANNED → LOGGED with logged_at; returns false if already flipped. */
export async function markPlannedMealLogged(plannedMealId: string, loggedAt: string): Promise<boolean>;
```

```ts
// src/lib/log/logStore.svelte.ts — getter-function store (planStore pattern).
export function todayLogs(): MealLog[];
export function recentSources(): LoggedSource[];
export function logLoading(): boolean;
export function logError(): string | null;
export function logNotice(): string | null; // calm partial-failure notice (FR-TL-014)

export async function loadToday(now?: Date): Promise<void>;
export async function loadRecents(): Promise<void>;

/**
 * Orchestrated one-tap log (R5): optimistic append → createLog →
 *   FROM_PREPPED: optimisticConsumePortions(preppedMealId, servings, { triggeredBy: log.id })
 *   FROM_PLAN:    markPlannedMealLogged(plannedMealId, log.loggedAt)
 * Insert failure → rollback optimistic row + logError.
 * Follow-up failure → keep log + logNotice, never throws.
 */
export async function logMeal(draft: MealLogDraft): Promise<MealLog | null>;

/** Optimistic verdict set/clear on a log (recap card + sheet footer). */
export async function rateLog(logId: string, verdict: MealVerdict | null): Promise<void>;
```

```ts
// src/lib/pantry — additive, backwards-compatible change:
export async function consumePortions(
	preppedMealId: string,
	count: number,
	opts?: { triggeredBy?: string } // meal_logs.id → portion_events.triggered_by
): Promise<PortionEvent>;
// optimisticConsumePortions gains the same optional opts pass-through.
```

## Behavioral guarantees

| Guarantee | Backstop |
|-----------|----------|
| A log's occurrence fields never change after insert | DB trigger `meal_logs_annotation_only` (pgTAP both ways) |
| No log can be deleted (v1) | No DELETE policy + no DELETE grant (pgTAP) |
| FROM_PLAN/FROM_PREPPED/FROM_RECIPE always born with their reference; non-quick logs always born named | DB trigger `meal_logs_validate_source` (pgTAP) |
| A log can never reference another user's plan/recipe/prepped meal | SECURITY DEFINER ownership trigger (pgTAP cross-user) |
| Prepped consumption can't go negative and never writes the count directly | existing `sync_portions_remaining` trigger (pgTAP in 0004's suite) |
| Planned meal flips PLANNED→LOGGED at most once | safe-flip UPDATE predicate returns 0 rows on repeat (unit test) |
| One rapid double-tap ⇒ one log | optimistic in-flight guard on the card button (e2e) |
| Users see only their own logs | RLS owner policies (pgTAP both directions) |
