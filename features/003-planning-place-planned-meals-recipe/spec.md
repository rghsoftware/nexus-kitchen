---
parent_branch: worktree-feat+planning
feature_number: '003'
status: In Progress
created_at: 2026-06-10T10:06:38-05:00
references_consulted:
  - docs/nexus-kitchen-requirements.md
  - docs/nexus-kitchen-domain-specification.md
  - docs/nexus-kitchen-invariants.md
  - docs/nexus-kitchen-differentiator.md
---

# Feature: Planning — Place Planned Meals on a Calendar

## Overview

Planning is how users express **demand** in Nexus Kitchen. Per the product thesis
(`nexus-kitchen-differentiator.md`): "Planning is how you express demand. The app's real job
is running the supply chain that meets it." A planned meal is a **requirement to be
fulfilled** — placing it on a day is the trigger for everything else the product does.

This feature delivers the **requirement-creation spine**: users place planned meals on a
calendar, where each meal is one of three sources — a **recipe** to cook (from the existing
recipe library), a **store-bought** ready-made meal to buy (e.g., "frozen lasagna"), or a
**quick** freeform option (e.g., "Takeout", "Leftovers"). Meals are assigned to a date and
optionally a meal slot (Breakfast, Lunch, Dinner, Snack, or unslotted "Anytime"), with any
number of meals allowed per slot group, ordered within the group.

**Explicitly deferred** (per the feature description "No fulfillment derivation yet"):
computing `HAVE_IT` / `CAN_MAKE_IT` / `MUST_ACQUIRE` fulfillment states (REQ-MP-012,
INV-PL-017) is a later chunk. This chunk also excludes the `PREPPED` meal source,
intelligent suggestions, plan generation, recurring schedule rules, nutrition rollups, and
meal logging — see Scope below. The data model laid down here is the canonical
`MealPlan` / `PlannedMeal` shape from Domain Specification §2.4, so the fulfillment engine
can be derived on top of it without schema rework.

## Scope

**In scope**

- Calendar views of planned meals: daily, weekly, and monthly (REQ-MP-001 in full)
- Creating planned meals with source = `RECIPE` (picker over the user's recipe library), `STORE_BOUGHT` (free-text name), or `QUICK` (free-text name with quick-pick defaults)
- Meal slots: Breakfast / Lunch / Dinner / Snack / unslotted ("Anytime"); multiple meals per slot group; stable ordering within a group
- Editing a planned meal (source details, servings, slot) and removing it
- Moving meals between dates and slots (drag-and-drop on pointer devices, plus a tap-based "Move" action everywhere)
- The `MealPlan` / `PlannedMeal` persistence model per Domain Specification §2.4, with RLS, owned by the user; plans are implicit (one per calendar week, auto-created)

**Out of scope (deferred to later chunks)**

- Fulfillment derivation — `HAVE_IT` / `CAN_MAKE_IT` / `MUST_ACQUIRE` (REQ-MP-012, INV-PL-017)
- `PREPPED` source — planning a specific existing prepped portion (per feature description: recipe / store-bought / quick only)
- Intelligent suggestions and plan generation (REQ-MP-006..010, `PlanGenerationPreferences`)
- Recurring meal schedules / `MealScheduleRule` (REQ-MP-003)
- Cumulative nutrition display (REQ-MP-005)
- Meal logging / skipping / swapping flows (status transitions beyond `PLANNED`; §3.6 Reminders & Logging)
- Household-shared plans and Realtime propagation (single-owner plans this chunk; schema allows `household_id` later)
- Shopping-list generation from plans (REQ-SL-002)

## Clarifications

### Session 2026-06-10

- Q: Should the MealPlan container be created explicitly by users or managed implicitly? → A: Implicit weekly plans — one `MealPlan` per calendar week (Monday-start ISO week), auto-created when the first meal lands in that week; no plan-management UI this chunk. Moving a meal across weeks re-homes it to the target week's plan (auto-creating it if needed), keeping INV-PL-002 intact. (FR-PL-011, FR-PL-015, A-009 updated.)
- Q: Which calendar views must ship in this chunk (REQ-MP-001 names daily, weekly, monthly)? → A: All three views ship now — daily, weekly, and monthly, fully satisfying REQ-MP-001. (FR-PL-001, FR-PL-004 updated.)
- Q: Drag-and-drop now, or tap-move only for the spine? → A: Both now — drag-and-drop on pointer devices plus the accessible tap-based "Move" action everywhere, fully satisfying REQ-MP-004. (FR-PL-013 confirmed as written.)

## User Scenarios

### Scenario 1: Viewing the Week

A user opens the Plan tab and sees the current week (Mon–Sun) with a column or row per day.
Each day shows its planned meals grouped by slot band — Breakfast, Lunch, Dinner, Snack,
and an "Anytime" group for unslotted meals — in their saved order. Empty days read as calm,
inviting empty states, not guilt. The user can step backward/forward a week at a time and
jump back to "Today".

### Scenario 2: Planning a Recipe Meal

The user taps an empty Dinner band on Thursday. An add-meal sheet opens scoped to
"Thursday — Dinner". They search their recipe library, pick "Chicken Stir Fry", optionally
adjust servings (defaulting from the recipe), and save. The meal appears in Thursday's
Dinner band immediately.

### Scenario 3: Planning a Store-Bought Meal

The user knows Friday will be a low-energy day. They add a meal to Friday Dinner, choose
"Store-bought", and type "Frozen lasagna". This records a ready-made meal they intend to
buy (per REQ-MP-011) — a requirement a later chunk will surface as must-acquire. No recipe
or pantry linkage is required.

### Scenario 4: Planning a Quick Option

The user adds "Takeout" to Saturday Dinner using a one-tap quick option (Takeout /
Leftovers / custom text). Quick meals are deliberately pressure-free placeholders and are
never fulfillment-tracked (per Domain Specification §2.4 `PlannedMealSource.QUICK`).

### Scenario 5: Multiple Meals in One Slot, and Anytime Meals

The user plans both "Soup" and "Grilled Cheese" for Wednesday Lunch — both appear in the
Lunch band in order. They also add "Protein shake" to Wednesday without picking a slot; it
appears in the day's "Anytime" group. (Per REQ-MP-002: slots are bands, not capacity
limits.)

### Scenario 6: Moving a Meal

Plans change. The user drags Thursday's "Chicken Stir Fry" to Saturday (desktop/pointer),
or taps the meal → "Move" and picks the new date/slot (mobile and keyboard users). The
meal keeps its details and lands in the target group's order (per REQ-MP-004).

### Scenario 7: Editing and Removing

The user taps a planned meal to open its detail, changes servings from 2 to 4, and saves.
Later they remove Saturday's takeout entirely; it disappears from the calendar without
ceremony or confirmation friction beyond a single confirm.

## Functional Requirements

### Calendar View

- **FR-PL-001**: The Plan view shall offer daily, weekly, and monthly calendar views with a view switcher, navigation to the previous/next period, and a "Today" shortcut (per REQ-MP-001; all three views confirmed in scope per Clarifications 2026-06-10). Weekly is the default view; the monthly view shows compact day summaries that navigate to the day on tap; the daily view shows the full slot-band detail for one day.
- **FR-PL-002**: Each day shall render its planned meals grouped by meal slot — Breakfast, Lunch, Dinner, Snack, then an "Anytime" group for unslotted meals — with meals ordered by their saved sort order within each group (per REQ-MP-002, Domain Specification §2.4 MealSlot notes, INV-PL-012).
- **FR-PL-003**: A planned meal card shall show its display name (recipe title, store-bought name, or quick name), its source kind, and servings. Recipe meals shall link/navigate to the recipe detail.
- **FR-PL-004**: All three views shall be responsive for desktop and mobile. On small screens the weekly view may compress day detail (and the daily view serves as the focused experience), provided every view remains usable on both form factors.

### Creating Planned Meals

- **FR-PL-005**: Users shall be able to add a planned meal to a specific date, optionally targeting a slot (tapping a slot band pre-fills that slot; an explicit "Anytime" choice leaves it unslotted) (per REQ-MP-002).
- **FR-PL-006**: Users shall be able to choose source = Recipe and select a recipe from their library via a searchable picker; servings defaults to the recipe's servings (per Domain Specification §2.4 PlannedMeal.servings).
- **FR-PL-007**: Users shall be able to choose source = Store-bought and enter a free-text name (e.g., "frozen lasagna") (per REQ-MP-011).
- **FR-PL-008**: Users shall be able to choose source = Quick and either tap a provided quick option ("Takeout", "Leftovers") or enter free text (per Domain Specification §2.4 PlannedMealSource.QUICK).
- **FR-PL-009**: Every planned meal shall have exactly one source reference matching its source kind (per INV-PL-003), positive servings (per INV-PL-004), and a date within its plan's range (per INV-PL-002).
- **FR-PL-010**: New meals shall be appended at the end of their (date, slot) group's order; sort order shall be unique within the group (per INV-PL-012).

### Plan Container

- **FR-PL-011**: Planned meals belong to a `MealPlan` with a date range (per Domain Specification §2.4, INV-PL-001/002). Plans are **implicit**: exactly one plan per calendar week (Monday-start), auto-created the first time a meal is placed in that week. Users never create, name, or delete plans in this chunk; the calendar is the only planning surface (per Clarifications 2026-06-10).

### Editing, Moving, Removing

- **FR-PL-012**: Users shall be able to edit a planned meal's servings, slot, source details (e.g., rename a store-bought item, change the linked recipe), and date (per REQ-MP-001).
- **FR-PL-013**: Users shall be able to move a meal to a different date and/or slot via drag-and-drop on pointer devices (per REQ-MP-004) AND via a non-drag "Move" action available on all devices (accessibility requirement; per requirements §4.4 WCAG 2.1 AA).
- **FR-PL-014**: Users shall be able to remove a planned meal from the calendar with a single lightweight confirmation.
- **FR-PL-015**: A moved meal shall be re-homed to the target (date, slot) group and appended to its order. Moving a meal to a different calendar week reassigns it to that week's plan, auto-creating the plan if it doesn't exist yet, so INV-PL-002 always holds (per Clarifications 2026-06-10).

### Persistence & Integrity

- **FR-PL-016**: Planned meals shall persist with the canonical shape from Domain Specification §2.4: date, optional meal slot, source kind + exactly-one source reference, servings, status (always `PLANNED` in this chunk), and sort order. Status values `LOGGED`/`SKIPPED`/`SWAPPED` exist in the model but have no UI this chunk.
- **FR-PL-017**: All planning data shall be private to its owner (RLS default-deny, owner-scoped, matching existing recipes/pantry conventions per `constitution`/tech stack; household sharing deferred).
- **FR-PL-018**: Database-level constraints shall enforce INV-PL-001 (plan end ≥ start), INV-PL-003 (exactly one source), INV-PL-004 (servings > 0), and INV-PL-012 (sort order unique per (plan, date, slot) group) so invalid requirements cannot be stored.
- **FR-PL-019**: Deleting a recipe that is referenced by planned meals shall not silently corrupt the plan. (Default: block deletion while future planned meals reference it, or convert those meals' display to a preserved snapshot name — see Assumptions.)

### Tone & ADHD Fit

- **FR-PL-020**: Planning UI copy shall be invitation-based and shame-free: empty days are neutral ("Nothing planned"), never framed as failure (per REQ-UX/ADHD principles in requirements §1.3 and the design system).
- **FR-PL-021**: Adding a meal shall take ≤ 3 interactions from the calendar for the quick path (tap band → pick/type → save), honoring the low-friction principle.

## Success Criteria

- **SC-001**: A user can place a recipe, a store-bought meal, and a quick meal on chosen days/slots, each in under 30 seconds from the calendar view.
- **SC-002**: A user can plan a full week (7+ meals across mixed sources) without leaving the Plan tab.
- **SC-003**: Planned meals survive reload and re-login with date, slot, order, and details intact; two meals in the same slot band always render in the same saved order.
- **SC-004**: Moving a meal between days (drag or tap-move) completes in one fluid interaction with no data loss, on both desktop and mobile viewports.
- **SC-005**: It is impossible to store a planned meal with zero/negative servings, more than one source reference, or a date outside its plan's range (verified by attempting each via direct API calls).
- **SC-006**: Another authenticated user can never read or modify someone else's plans (verified via RLS tests).
- **SC-007**: The week view renders within 1 second on a typical broadband connection with a 50-meal week.

## Key Entities

Per Domain Specification §2.4 (Planning Context) — canonical shapes, subset for this chunk:

- **MealPlan**: id, ownerId, optional name, startDate, endDate, timestamps. Container for planned meals (INV-PL-001/002). `householdId` and `generationPreferences` exist in the domain model but are deferred.
- **PlannedMeal**: id, mealPlanId, date, optional mealSlot (null = anytime), source (`RECIPE` | `STORE_BOUGHT` | `QUICK` this chunk; `PREPPED` reserved), exactly one of recipeId / storeBoughtName / quickMealName matching source (INV-PL-003), servings > 0 (INV-PL-004), status (`PLANNED`; `LOGGED`/`SKIPPED`/`SWAPPED` reserved per §5.4 state machine), sortOrder unique per (date, slot) group (INV-PL-012), timestamps.
- **MealSlot** (enum): BREAKFAST, LUNCH, DINNER, SNACK — conceptual time-of-day bands, never capacity limits; distinct from recipe MealType (Domain Specification §2.4 notes).
- **Recipe** (existing, read-only dependency): picker + display title for `RECIPE`-source meals.

## Assumptions

- **A-001**: Weekly is the default view on first visit; the chosen view (daily/weekly/monthly) persists locally across visits. All three views read the same data — no view-specific persistence.
- **A-009**: Weeks are Monday-start (ISO 8601) for implicit plan boundaries and the weekly view. Implicit plans get `startDate` = Monday, `endDate` = Sunday, and a null name.
- **A-002**: Meal logging (LOGGED/SKIPPED/SWAPPED) is part of the Reminders & Logging feature (requirements §3.6), not this chunk; the status column ships with only `PLANNED` written.
- **A-003**: The `PREPPED` source value is included in the persisted enum (so the schema matches Domain Specification §2.4 exactly) but is not creatable through the UI this chunk.
- **A-004**: Plans are single-owner this chunk. The schema mirrors the domain model so `household_id` can be added without migration pain.
- **A-005**: For FR-PL-019, the default is to preserve plan integrity by snapshotting the recipe title onto the planned meal at creation time (display continues to work if the recipe is later deleted); foreign key uses `on delete set null` with the snapshot name retained. This avoids blocking recipe deletion and avoids dangling references.
- **A-006**: Timezone handling: a planned meal's `date` is a civil date (no time component); "today" is computed in the user's local timezone (per data rules, timestamps stored as timestamptz UTC, plan dates as `date`).
- **A-007**: Sort order maintenance (gaps/renumbering on move) is an implementation detail; the observable contract is stable, unique ordering per group (INV-PL-012).
- **A-008**: Nutrition info on planned meals (`nutritionInfo`) is deferred with REQ-MP-005; no column needed this chunk beyond what a later migration can add.

## Sources

This spec was generated by consulting the following references (per `.specswarm/references.md`):

| Source | Sections informing this spec |
|--------|------------------------------|
| `docs/nexus-kitchen-requirements.md` | §3.1.1 Calendar-Based Planning (REQ-MP-001..005), §3.1.3 Sources & Fulfillment (REQ-MP-011, REQ-MP-012 deferred), §1.3 ADHD principles |
| `docs/nexus-kitchen-domain-specification.md` | §2.4 Planning Context (MealPlan, PlannedMeal, PlannedMealSource, MealSlot, MealType distinction), §3.4 Planning Invariants (INV-PL-001..005, 012, 017), §4.3 Meal Planning Flow + planning model note, §5.4 Planned Meal State Machine |
| `docs/nexus-kitchen-invariants.md` | §1.4 Planning Invariants table (INV-PL-001..017) |
| `docs/nexus-kitchen-differentiator.md` | Core model ("a planned meal is a requirement"), planning-as-demand framing, QUICK meals not fulfillment-tracked |

No section was fabricated without a corresponding source citation OR `[NEEDS CLARIFICATION]` marker.
