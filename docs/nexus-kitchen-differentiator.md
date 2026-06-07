# Nexus Kitchen - The Differentiator

**Document Version:** 1.0
**Date:** June 4, 2026

> This is the product thesis. Everything else in the document set - requirements, domain model, architecture, design system - is a *how*. This is the *why* they all answer to. Read it first. When a decision is unclear, this is the tiebreaker.

---

## What this is

**Nexus Kitchen is inventory and operations management for meals.**

Planning is how you express *demand*. The app's real job is running the *supply chain* that meets it. The value was never the calendar - it's everything the calendar sets in motion.

## Why that's different

The meal-app world is full of loggers and planners. They treat a meal as something you **record** or **schedule** - capture-first, then maybe a calendar skin on top. That problem is solved a hundred times over, and solving it again adds nothing.

Nexus treats a meal as a **requirement to be fulfilled.** Putting a meal on a day isn't the point - it's the trigger. The point is what becomes true the moment you commit to it: what's now covered by food you already have, what still has to be cooked or bought, and by when.

## The core model

A planned meal is a **requirement** in one of three states:

- **Have it** - a ready-to-eat portion already exists.
- **Can make it** - a recipe whose ingredients are on hand.
- **Must acquire** - it has to be cooked or bought by its day.

**The entire product exists to move every requirement to "have it" before it's due.**

## What that makes everything else

Pantry, prep/cook, and shopping are not peer features. They're the **operations that close gaps**:

- **Shopping** = the buy-gap.
- **Prep / cook** = the make-gap.
- **Pantry** (raw stock) = what those operations draw down.
- **Inventory** - raw stock *and* ready-to-eat portions - is the **state** the whole system tracks.

Planning expresses demand; inventory and operations are the engine that satisfies it.

## The real problem it solves

The problem here isn't forgetting to log a meal. It's the impossibility of **holding the whole operation in your head** - what's on hand, what's about to turn, what still has to happen and by when. That's the load that makes eating well exhausting.

Nexus is **external scaffolding for those operations.** The plan is durable, adjustable, and shown in a digestible form - never re-derived from scratch each time, never depending on you to remember the state of your own kitchen.

## What it is not

- **Not a meal logger or capture app.** Capture exists only to feed the operations loop - never as the point.
- **Not a recipe box, a calendar skin, or a macro tracker.** Those can exist, but only in service of fulfilling requirements.

## How to use this document

When any decision is in question - a feature, a model choice, a UI gesture - ask:

> *Does this help move meal requirements to "have it" by their day, with less held in the user's head?*

If it doesn't, it's probably not Nexus's job.
