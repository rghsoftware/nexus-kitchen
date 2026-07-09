---
parent_branch: feat/006-today-logging
feature_number: 006
status: Implemented — pending manual verification + /ss:ship
created_at: 2026-07-09T15:30:00-05:00
references_consulted:
  - nexus-kitchen-requirements.md
  - nexus-kitchen-domain-specification.md
  - nexus-kitchen-invariants.md
  - nexus-kitchen-differentiator.md
  - nexus-kitchen-design-system.md
  - design/screens/web-today.html, tablet-today.html, mobile-today.html, mobile-log.html
---

# Feature: Today dashboard, one-tap meal logging & meal verdicts

## Overview

The app can plan, stock, and shop — but it has no daily surface and no way to say "I ate."
This feature adds the **Today dashboard** as the app's home screen and closes the supply
loop with **one-tap meal logging** and an optional, shame-free **meal verdict**
(Again / Fine / Not for me). Logging a prepped meal draws down the portion ledger, keeping
HAVE_IT truthful; verdicts feed future suggestion features so good options resurface
without re-deciding.

Concretely, delivers:

- A `/today` home surface: greeting, per-slot meal cards with status, day-coverage
  summary, quick actions, and an attention list for prepped food about to turn
  (Domain Specification §4.2; REQ-UX-011/012/013).
- One-tap logging of planned meals (REQ-MR-006, REQ-NT-006) — the first writer of the
  `PLANNED → LOGGED` transition shipped in feature 003 (INV-PL-005).
- A Quick Log sheet: slot picker, "I ate something" zero-detail log (REQ-MR-009),
  prepped meals, recents, and keepers (REQ-MR-008), per `design/screens/mobile-log.html`.
- Prepped-meal logs consume portions through the append-only portion ledger
  (INV-XD-003, INV-CC-006), linking the ledger event to the log entry.
- Optional three-way verdict capture at log time or later, plus a "How were these?"
  recap for recent unrated meals (REQ-MR-007 as amended below).
- A gentle, client-side mealtime nudge banner (visual cue only — push reminders are
  feature 007).

## Scope

**In scope:** `meal_logs` table + RLS; log domain module; Today route/components;
Quick Log sheet; verdict capture/recall; client-side nudge banner; nav/home wiring.

**Out of scope:** push/scheduled reminders (§3.6.1, REQ-MR-001..005 — feature 007);
visual timeline/history (§3.6.3, REQ-MR-010..012); nutrition capture on logs
(REQ-NT-009 opt-in, deferred); variety/rotation consumers of verdict data (§3.7);
household sharing; meal-prep sessions; recipe 1–5 star ratings (already shipped in 001,
separate concept per Domain Specification `UserRecipeMeta`).

## Clarifications

### Session 2026-07-09

- Q: The SRS/domain spec define a four-value `MealRating` (HATED/OK/LIKED/LOVED), but the
  canonical mockups and shipped `base.css` primitives implement a three-value **verdict**
  (`keep` "Again" / `fine` "It was fine" / `rest` "Not for me") via `.nk-verdict` and
  `--verdict-*` tokens. Which wins? → A: **The design mockups win** (project rule:
  `design/screens/*.html` are canonical). The verdict enum is `KEEP | FINE | REST`;
  `KEEP` absorbs LIKED/LOVED, `FINE` = OK, `REST` is the shame-free framing of HATED
  ("set it aside" — a verdict on the food, not the person). REQ-MR-007 is satisfied in
  substance; the deviation is recorded here.
- Q: `MealLog` is append-only (INV-CC-004, REQ-CN-007), yet the design lets users set a
  verdict "anytime later". → A: The log **occurrence** (what/when/how much) is immutable
  after insert; `verdict` and `notes` are late-arriving annotations and the only mutable
  fields, enforced by a DB trigger. No LWW overwrite of occurrence facts is possible.
- Q: Domain entity lists five log types but INV-XD-001/002 only constrain FROM_PLAN and
  FROM_PREPPED. → A: Ship all five types (`FROM_PLAN, FROM_RECIPE, FROM_PREPPED,
  QUICK_LOG, CUSTOM`); enforce the type↔reference rules at insert time (references may
  later become NULL if the source row is deleted; the name snapshot preserves display).
- Q: Undo for accidental one-tap logs? → A: **Deferred.** No DELETE policy in v1; the
  confirmation is calm, not modal. Revisit alongside the timeline feature where a log can
  be reviewed. Recorded as A-004.
- Q: Does the Today reminder banner require the reminders backend? → A: No — it is a
  purely client-side visual cue derived from the clock, today's plan, and today's logs
  (REQ-UX-011). Push delivery is feature 007. Dismissal is local to the device and day.

## User Scenarios

### Primary: lunch, one tap

Jordan planned Marinara pasta (prepped, 3 portions left) for lunch. Around noon the Today
screen shows a gentle "It's around lunchtime" banner. Jordan taps **Log it** on the lunch
card. The card flips to "Eaten · 12:04pm" immediately, portions drop to 2, and an
unobtrusive "How was it?" appears. Jordan ignores it — that's fine.

### Quick log: "I ate something"

Mid-afternoon, Jordan ate crackers at the desk. From Today, **Log a meal** opens the sheet;
slot defaults to Snack; one tap on **I ate something** records it with no details. Total:
3 taps, no typing, no judgment.

### Verdict later

The next morning the recap card asks "How were these?" for yesterday's unrated lentil
curry. Jordan taps **Again**. Lentil curry now carries a Keeper mark and appears in the
Keepers group of the log sheet with "made 3 times".

### Dinner not covered

Dinner's salmon is MUST_ACQUIRE. Its card offers **Add to list** (not "Log it") and the
coverage card says "Tonight's salmon is the only gap — one thing to pick up, and the
day's set."

### Edge cases

- No plan at all today → coverage card invites planning ("Nothing planned — that's okay.
  Want to pick something easy?"); meal grid shows empty-slot invitations; Quick Log still
  fully works.
- Logging a prepped meal with 1 portion left → succeeds, portions hit 0; the item stops
  appearing in the sheet's prepped group.
- Two rapid taps on **Log it** → exactly one log (button disables optimistically).
- Log insert succeeds but portion consumption or status flip fails (offline blip) → log
  is kept; calm notice "Logged — we'll tidy the pantry count when you're back online";
  no crash, no rollback of the log (FR-TL-014).
- Planned meal's recipe deleted after logging → log still displays via name snapshot.
- Verdict tapped again → deselects back to unrated (never required).
- Day boundary: "today" is the user's local calendar day; logs at 11:58pm belong to that
  day; the dashboard rolls over naturally on next render.

## Functional Requirements

### Today surface

- FR-TL-001: The system shall provide a Today dashboard as the app's home surface: the
  root path redirects to `/today` and the existing "Today" navigation item activates
  (REQ-UX-012, Domain Specification §4.2).
- FR-TL-002: The Today screen shall show a time-of-day greeting and the full date with
  calm, pressure-free copy per the canonical mockups (design voice rules).
- FR-TL-003: The Today screen shall list today's planned meals as slot-labelled cards in
  slot order, each showing the meal name, source tag (e.g. "Prepped · N left"), and
  status: logged ("Eaten · h:mm") vs not yet (REQ-UX-013, Domain Specification §4.2).
- FR-TL-004: Each unlogged planned-meal card shall present exactly one primary action
  derived from its fulfillment state: **Log it** (HAVE_IT / CAN_MAKE_IT) or **Add to
  list** (MUST_ACQUIRE, navigating to shopping) (REQ-UX-001; feature 004 derivation).
- FR-TL-005: The Today screen shall show a day-coverage card summarising each planned
  slot's fulfillment as chips plus one supportive sentence (REQ-UX-011/013).
- FR-TL-006: Empty meal slots shall show a low-pressure invitation ("Add a snack —
  optional") linking to the planner; absence of a plan is never framed as failure
  (REQ-UX-014, design voice rules).
- FR-TL-007: The Today screen shall offer quick actions: Plan the week, Build shopping
  list, Browse the pantry (Domain Specification §4.2). ("Start a prep session" waits for
  the prep feature.)
- FR-TL-008: The Today screen shall show an attention list of prepped meals with portions
  remaining that expire within 3 days, each linking to the planner ("Plan it in")
  (differentiator: surface "what's about to turn").

### One-tap logging

- FR-TL-009: Users shall log a planned meal with a single tap; the log records source
  reference, name snapshot, slot, and the planned servings, applied optimistically
  (REQ-MR-006, REQ-NT-006, REQ-CN-003).
- FR-TL-010: Logging a planned meal shall transition that planned meal `PLANNED → LOGGED`
  with `logged_at` set (INV-PL-005, Domain Specification §5.4); an already-LOGGED planned
  meal shall not be double-flipped.
- FR-TL-011: A Quick Log sheet shall be reachable from Today, offering: a slot picker
  defaulting to the current mealtime, "I ate something" zero-detail logging (REQ-MR-009),
  today-ready prepped meals with portion counts, recent meals, and keepers (REQ-MR-008),
  per `mobile-log.html`.
- FR-TL-012: Logging a prepped meal shall consume the logged servings from the portion
  ledger as a CONSUMED event linked to the log entry (`triggered_by` = log id), never
  writing the portion count directly (INV-XD-003, INV-INV-004/010/011, INV-CC-006).
- FR-TL-013: Every log path reachable from Today shall complete in at most 3 taps with
  immediate visual feedback and a calm confirmation (REQ-UX-003, REQ-UX-015).
- FR-TL-014: If the log record persists but a follow-up write fails (portion event or
  planned-meal flip), the log shall be kept and a calm non-blocking notice shown; partial
  failure shall never crash or silently disappear (pattern precedent: shopping trip
  completion).

### Verdicts

- FR-TL-015: At log time the user may optionally set a three-way verdict — KEEP
  ("Again"), FINE ("It was fine"), REST ("Not for me") — always skippable and
  deselectable, labels always paired with icons (REQ-MR-007 as amended; design system
  valence rules).
- FR-TL-016: A verdict (and notes) may be set or changed on an existing log at any later
  time; all other log fields are immutable after insert (INV-CC-004, REQ-CN-007).
- FR-TL-017: Today shall show a "How were these?" recap of up to 3 recent unrated logs
  (last 48 h, excluding zero-detail QUICK_LOG entries) with inline verdict capture; the
  module disappears when there is nothing to ask.
- FR-TL-018: Wherever previously logged meals resurface (recents, keepers), the system
  shall show the source's current verdict mark; the Keepers group lists sources whose
  most recent verdict is KEEP, with a times-made count.

### Gentle nudge

- FR-TL-019: During a mealtime window whose slot has a planned, unlogged meal, Today
  shall show a gentle banner ("It's around lunchtime… No rush.") with **Log** and **Not
  now**; "Not now" dismisses that slot for the rest of the local day on that device. No
  notification is sent (REQ-UX-011; push is feature 007).

### Data & integrity

- FR-TL-020: Meal logs shall be stored in a `meal_logs` table: UUID PK, owner-scoped
  default-deny RLS, `timestamptz` UTC, insert-time validation that the log type's
  required reference and name snapshot are present (INV-XD-001/002), cross-user
  reference guards, and no DELETE capability in v1 (INV-SEC-004/006, INV-DB-001/002/011).
- FR-TL-021: Database types shall be regenerated and mapped to camelCase app types; UI
  code shall never import generated row types directly (established convention).

## Success Criteria

- From a cold open of the app, logging today's planned lunch takes 1 tap on the meal card
  (≤3 taps including any scrolling context), and the card reflects "Eaten" in under
  200 ms perceived (optimistic).
- Logging a prepped meal visibly decrements its portion count everywhere (Today, pantry)
  without any direct write to the portion column; the ledger gains exactly one CONSUMED
  event referencing the log.
- A planned meal logged via Today reads LOGGED with a timestamp in the planner.
- "I ate something" produces a log with no name, no reference, and no verdict — and zero
  validation errors.
- A user who never sets a verdict experiences no prompts beyond the passive recap card.
- Another user's meal logs are invisible and unwritable (RLS proven both directions by
  pgTAP).
- All automated gates green: `check`, `lint`, unit, build, pgTAP; e2e for the today/log
  flow passes locally.

## Key Entities

- **MealLog** — one eating occurrence. `id`, `ownerId`, `logType` (FROM_PLAN /
  FROM_RECIPE / FROM_PREPPED / QUICK_LOG / CUSTOM), optional source refs
  (`plannedMealId`, `recipeId`, `preppedMealId`), `nameSnapshot`, `mealSlot?`,
  `servings` (default 1), `loggedAt`, `verdict?` (KEEP/FINE/REST), `notes?`.
  Deferred fields from the domain entity: `nutritionInfo` (opt-in nutrition, later),
  `householdId` FK enforcement (household feature).
- **PortionEvent (existing)** — gains its intended `triggered_by` link: CONSUMED events
  created by prepped-meal logs carry the log's id.
- **PlannedMeal (existing)** — first writer of `status = LOGGED` + `logged_at`.

## Assumptions

- A-001: **Slot windows** for nudges/defaults are fixed client constants (breakfast
  06–10, lunch 11–14, dinner 17–21, else snack); personalisation belongs to the
  reminders feature.
- A-002: **Keepers/recents derive from logs** at query time; no denormalised verdict on
  recipes. `user_recipe_meta.times_cooked` is not written by logging (cooking ≠ eating);
  times-made counts come from log aggregation.
- A-003: **Low-stock attention items** ship only if the pantry module already exposes a
  low-stock signal; otherwise the attention list is expiring-prepped only (matches
  mockup content, avoids scope creep into pantry).
- A-004: **No undo/delete of logs in v1** (append-only); accidental logs are tolerated
  until the timeline feature adds review affordances.
- A-005: Deferred per corpus but out of this feature: reminders backend (007), visual
  timeline (§3.6.3), nutrition on logs, variety consumers, household visibility of logs.

## Sources

| Source | Sections informing this spec |
|--------|------------------------------|
| nexus-kitchen-requirements.md | §3.6.2 (REQ-MR-006..009), REQ-NT-006, §6 (REQ-UX-001/003/011/012/013/014/015), REQ-CN-003/007, Appendix A P1 |
| nexus-kitchen-domain-specification.md | MealLog entity + MealLogType + MealRating, §4.2 Home Screen Flow, §4.8 Log flow, §5.4 PlannedMeal state machine |
| nexus-kitchen-invariants.md | INV-XD-001/002/003, INV-PL-005, INV-CC-004/006, INV-CON-003/004, INV-SEC-004/006, INV-DB-001/002/011, INV-INV-004/010/011, INV-MOD-001/002 |
| nexus-kitchen-differentiator.md | capture feeds the operations loop; "what's about to turn" |
| design/screens/*.html + base.css | canonical Today/Log layouts, `.nk-verdict` three-way control |

No section was fabricated without a corresponding source citation or a resolved
Clarification entry.
