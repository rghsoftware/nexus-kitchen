# Nexus Kitchen - Logical Architecture

**Document Version:** 1.0  
**Date:** June 4, 2026  
**Purpose:** System design for the resolved Supabase-native stack, derived from the domain specification and requirements.

> **Stack.** A responsive **SvelteKit SPA** (`adapter-static`, client-rendered) that runs in the browser on every device - no native apps. **Supabase** is the backend: PostgreSQL + Row-Level Security, Auth, Realtime, Storage, Edge Functions, and Cron. The static build is **served by Caddy** on self-hosted infrastructure (the backend stays managed Supabase). **Reminders** are server-side (Supabase Cron → Pushover). The app is **online-first** with local read caching. The SPA build is kept so a **Tauri** wrapper stays a future option if a native need arises.

---

## Table of Contents

1. [System Context](#1-system-context)
2. [Component Architecture](#2-component-architecture)
3. [Bounded Contexts as Modules](#3-bounded-contexts-as-modules)
4. [Core Data Flows](#4-core-data-flows)
5. [Integration Architecture](#5-integration-architecture)
6. [Connectivity, Caching & Realtime Model](#6-connectivity-caching--realtime-model)
7. [Security Architecture](#7-security-architecture)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [Resolved Technology Decisions](#9-resolved-technology-decisions)

---

## 1. System Context

### 1.1 Context Diagram

```
        ┌───────────────────────────── CLIENTS ──────────────────────────────┐
        │   Desktop browser              Mobile browser                       │
        │   one responsive Svelte SPA - the same web app on every device       │
        └───────────────────────────────┬────────────────────────────────────┘
                                         │ HTTPS + WSS (supabase-js)
                                         ▼
        ┌──────────────────────────── SUPABASE ──────────────────────────────┐
        │  Auth (JWT)   PostgREST API   Realtime   Storage   Edge Functions   │
        │                      PostgreSQL + Row-Level Security                │
        │                  pg_cron / scheduled Edge Functions                 │
        └───────────────────────────────┬────────────────────────────────────┘
                                         │ (server-side calls from Edge Functions)
                                         ▼
        ┌──────────────────────── EXTERNAL SYSTEMS ──────────────────────────┐
        │ Cloud AI (Anthropic/OpenAI/Gemini)   Nutrition DB (USDA/OFF)        │
        │ Barcode DB (OpenFoodFacts/UPC)       Pushover (push delivery)       │
        │ Calendar / Grocery (stretch)                                        │
        └─────────────────────────────────────────────────────────────────────┘

  Notifications: server-side via Supabase Cron → Pushover.
```

### 1.2 Actor Descriptions

| Actor | Description | Key Interactions |
|-------|-------------|------------------|
| **Primary User** | Individual managing meals, with ADHD accommodations | All core features across desktop and mobile browsers |
| **Household Member** | User in a shared household with a role | Shared pantry, shopping lists, meal plans |
| **Admin User** | Household admin | Household settings, member management, data export |
| **Scheduled Tasks** | Server-side automation (Supabase Cron / Edge Functions) | Expiration checks, pattern recomputation, **reminder dispatch (Cron → Pushover)** |

### 1.3 External System Dependencies

| System | Purpose | Criticality | Degraded Behavior |
|--------|---------|-------------|-------------------|
| **Cloud AI provider** | Recipe parsing, suggestions, step breakdown, food recognition | Low | Feature off or rule-based fallback |
| **Nutrition database** | Ingredient nutrition lookup | Medium | Cache; manual entry fallback |
| **Barcode database** | Product identification | Low | Manual entry fallback |
| **Notifications** | Meal reminders, alerts | Medium | Server-side: Supabase Cron → **Pushover** |
| **Calendar / Grocery** | Export & ordering (stretch) | Low | Manual sharing |

---

## 2. Component Architecture

### 2.1 High-Level Diagram

```
┌──────────────────────────── SHARED SVELTE SPA ─────────────────────────────┐
│  UI components   │  State (Svelte stores)  │  Read cache  │  supabase-js    │
│  (headless +     │  optimistic updates     │  (recipes,   │  (Auth, CRUD,   │
│   design tokens) │                         │   plans,     │   Realtime)     │
│                  │                         │   lists)     │                 │
│  Barcode scan via the browser camera API; served as static files by Caddy.  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │  supabase-js (HTTPS/WSS)
                                    ▼
┌──────────────────────────────── SUPABASE ──────────────────────────────────┐
│  Auth            PostgREST (auto CRUD)        Realtime (household changes)   │
│  Storage (images)        Edge Functions (server-side logic & secrets)        │
│  ───────────────────────────────────────────────────────────────────────    │
│  PostgreSQL + Row-Level Security (single source of truth)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Svelte UI** | Components built on the **design system** (warm palette, Phosphor icons, `.nk-*` classes); shame-free, ADHD-friendly flows; light + dark |
| **State / stores** | Client state, optimistic updates, reconciliation against server |
| **Read cache** | Keep recent recipes / current plan / active list responsive; reduce refetches |
| **supabase-js** | Auth session, PostgREST CRUD, Realtime subscriptions, Storage |
| **Caddy** | Serves the static SPA over automatic HTTPS on self-hosted infrastructure |
| **PostgREST** | Auto-generated REST CRUD over tables, constrained by RLS |
| **Edge Functions** | Server-side logic needing secrets/privilege: AI calls, third-party lookups, privileged writes |
| **Postgres + RLS** | Authoritative data, integrity constraints, authorization, cross-aggregate reactions (triggers) |
| **Realtime** | Near-real-time propagation of shared-household changes |

---

## 3. Bounded Contexts as Modules

Bounded contexts are retained as a **code-organization and ownership** concept, realized as PostgreSQL schema/table groups, matching client modules, and RLS policies - not as separately deployed services.

### 3.1 Context → Module Mapping

| Context | Tables (owned) | Client module |
|---------|----------------|---------------|
| Identity | users, households, household_members, user_preferences, dietary_profiles | `auth/`, `household/` |
| Recipes | recipes, recipe_steps, recipe_ingredients, ingredients, recipe_tags, user_recipe_meta | `recipes/` |
| Inventory | pantry_items, prepped_meals, portion_events, storage_locations | `inventory/` |
| Planning | meal_plans, planned_meals, meal_prep_sessions, meal_reminders, meal_logs, meal_schedule_rules, meal_suggestion_feedback | `planning/` |
| Shopping | shopping_lists, shopping_list_items, store_layouts, store_sections | `shopping/` |
| Nutrition | nutrition_goals, daily_nutrition_summary (view/table) | `nutrition/` |
| Variety | food_profiles, food_hyperfixations, chain_suggestions, variation_ideas | `variety/` |

### 3.2 Cross-Context Interaction

- **Reads:** other modules read via foreign-key references and Postgres views.
- **Reactions:** cross-aggregate effects (e.g., `MealLogged` → decrement prepped portions) are implemented as a **Postgres trigger**, a **Supabase Edge Function**, or **transactional client logic** - chosen per case and kept idempotent where retried.
- **No** message broker, outbox, or inter-service calls.

---

## 4. Core Data Flows

All writes go to Supabase (PostgREST or an Edge Function); shared-household changes propagate via Realtime. Clients apply optimistic updates and reconcile.

### 4.1 Meal Planning
Client composes plan → upsert `meal_plans` / `planned_meals` via PostgREST (RLS-scoped to household) → Realtime notifies other members → caches updated.

### 4.2 Meal Prep Session
Client creates session + servings → on completion, a trigger/Edge Function creates `prepped_meals`, deducts pantry quantities, and generates/updates the distributing meal plan.

### 4.3 Meal Logging
User taps Log (or from a reminder) → optimistic UI insert of `meal_logs` → PostgREST write → **trigger** appends a `portion_events` row when source = PREPPED (decrementing remaining portions), updates the nutrition projection (if opt-in) and food-frequency (Variety, if opt-in) → Realtime broadcast. Append-only logs are never overwritten.

### 4.4 Shopping List Generation
Source = MealPlan / MealPrepSession / manual → aggregate required ingredients (recipe ingredients × servings), subtract pantry on-hand, drop non-positive needs, organize by the user's store layout, attach product photos → write `shopping_lists` + `shopping_list_items`. Heavier aggregation may run in an Edge Function; simple cases run client-side.

---

## 5. Integration Architecture

### 5.1 Integration via Edge Functions
External calls that need API keys or server trust run in **Edge Functions** (keys never reach the client), with response caching, retry-with-backoff, and fallback:

| Adapter | Providers | Fallback |
|---------|-----------|----------|
| Nutrition | USDA FoodData Central, Open Food Facts | Cache → manual entry |
| Barcode | Open Food Facts, UPC database | Manual entry |
| AI | Anthropic / OpenAI / Gemini (cloud) | Rule-based or feature off (see 5.3) |
| Notifications | Supabase Cron → Pushover (server-side push) | In-app surfacing |

Barcode *scanning* is client-side via the browser camera API (`BarcodeDetector`, JS fallback); the table's Barcode row is the *lookup* call.

### 5.2 AI Integration (cloud-first)
A capability router selects a provider by capability (vision/text), user configuration, availability, and cost. Use cases: recipe import (URL/photo), meal suggestions, step breakdown (ADHD-friendly), food recognition, nutrition estimation. All AI calls go through an Edge Function for key safety and PII minimization; AI output is treated as untrusted and validated before persistence.

### 5.3 Graceful Degradation Matrix

| Feature | AI Available | AI Unavailable |
|---------|--------------|----------------|
| Recipe URL Import | AI extracts structured data | Fallback to JSON-LD/schema.org parsing, then manual entry |
| Recipe Photo Import | AI parses image | Feature unavailable, manual entry only |
| Meal Suggestions | AI-enhanced personalization | Rule-based (favorites, expiring items, meal ratings) |
| Step Breakdown | AI generates sub-steps | Show original steps only |
| Food Recognition | AI identifies items | Manual entry only |

---

## 6. Connectivity, Caching & Realtime Model

- **Online-first.** Normal operation requires connectivity; Supabase Postgres is always authoritative.
- **Read cache.** Recent recipes, the current meal plan, and the active shopping list are cached locally for snappy navigation and fewer refetches.
- **Optimistic UI.** High-frequency actions (meal logging, checking off items) update the UI immediately and reconcile with the server response, rolling back on rejection.
- **Realtime.** Shared-household changes propagate via Supabase Realtime (best-effort; clients can always re-fetch).
- **On network loss.** Read from cache where possible; clearly indicate offline status; preserve user input and offer retry; do not pretend a write succeeded.

---

## 7. Security Architecture

### 7.1 Authentication & Authorization
- **Auth:** Supabase Auth issues JWTs (with refresh-token rotation). The app does not implement password hashing or token issuance.
- **Authorization:** Postgres **Row-Level Security** is the boundary. Default-deny; policies grant access to a user's own rows and to household rows per role (ADMIN/MEMBER/VIEWER). The client is never trusted for authorization.

### 7.2 Data Protection
- Auth tokens are kept in the Supabase client's browser session storage.
- TLS everywhere - Supabase for the API, Caddy's automatic HTTPS for the web app.
- The Supabase **anon key is public**; security rests on RLS + Auth. The **service-role key** lives only in Edge Functions / server env.
- No PII in logs.

### 7.3 Application Security
- Data access via PostgREST/parameterized queries; no string-built SQL in Edge Functions.
- Rely on Svelte output escaping; avoid unchecked `{@html}`.
- Validate inputs client-side, backstopped by DB constraints and RLS.

---

## 8. Cross-Cutting Concerns

### 8.1 Logging & Observability
Supabase platform logs (Postgres, Edge Functions) plus client-side error reporting. Never log tokens, emails, or PII-laden bodies.

### 8.2 Error Handling
- Retry with backoff on transient network / 5xx errors.
- Optimistic updates roll back on server rejection.
- User-friendly messages (no stack traces); preserve user input.

### 8.3 Internationalization (i18n)
English-only MVP; architecture prepared for i18n (externalized strings, locale-aware date/number formatting, metric/imperial preference). Future: RTL, pluralization, AI-assisted recipe translation.

---

## 9. Resolved Technology Decisions

Key technology decisions:

| Question | Decision |
|----------|----------|
| Frontend | SvelteKit SPA (`adapter-static`, client-rendered) - responsive web, all devices |
| Packaging | None - responsive web in the browser; static SPA build kept so Tauri stays a future drop-in option |
| Backend | Supabase (managed) |
| Database | PostgreSQL (single DB) |
| API style | PostgREST (auto CRUD) + Edge Functions for server logic |
| Real-time | Supabase Realtime |
| AuthN / AuthZ | Supabase Auth / Postgres RLS |
| Connectivity | Online-first + local read cache (no offline sync engine) |
| AI | Cloud providers via Edge Functions (local optional, post-MVP) |
| Web hosting | Static SPA served by Caddy (self-hosted); managed Supabase backend |
| Reminders | Server-side: Supabase Cron → Pushover |

**Smaller open items:** client cache/library choice; Pushover vs. a self-hosted shoutrrr relay for delivery; image handling pipeline in Supabase Storage; Caddy SPA-fallback config.

**Ruled out (for MVP):** native apps and app-store distribution (Play closed-testing wall, age-verification laws); React/React Native/Expo; JS/Node/Deno as the primary backend; offline-first sync engine; self-hosting the Supabase backend. **Tauri is deferred, not ruled out** - the static SPA keeps it a drop-in option.

---

## Appendix A: Domain Event Flow Summary

> **Note.** These are a *conceptual* reaction catalog. "Service" below means the owning **module**; each reaction is implemented with the simplest fit - a Postgres trigger, a Supabase Edge Function, or transactional client logic - not an async event bus.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      KEY DOMAIN EVENT REACTIONS                             │
└─────────────────────────────────────────────────────────────────────────────┘

Event                          │ Triggered Reactions
───────────────────────────────┼──────────────────────────────────────────────
MealLogged                     │ • Decrement PreppedMeal portions (if source)
                               │ • Update DailyNutritionSummary
                               │ • Update food frequency (Variety)
                               │ • Update PlannedMeal status
───────────────────────────────┼──────────────────────────────────────────────
MealPrepSessionCompleted       │ • Create PreppedMeal entries
                               │ • Deduct ingredients from Pantry
                               │ • Generate/update MealPlan
───────────────────────────────┼──────────────────────────────────────────────
ShoppingListCompleted          │ • Offer to add items to Pantry
                               │ • Update MealPrepSession status (if linked)
───────────────────────────────┼──────────────────────────────────────────────
PreppedMealExpired             │ • Remove from available inventory
                               │ • Update affected MealPlan items
                               │ • Notify user (optional)
───────────────────────────────┼──────────────────────────────────────────────
HouseholdMemberAdded           │ • Grant access to shared resources
                               │ • Notify existing members
───────────────────────────────┼──────────────────────────────────────────────
RecipeCooked                   │ • Increment timesCooked
                               │ • Update lastCookedAt
                               │ • Offer to log meal
                               │ • Offer to save leftovers as PreppedMeal
```

---

## Appendix B: MVP Scope Considerations

Based on the ADHD Feature Priority Matrix from requirements:

**Priority 1 (Must Have for MVP):**
- Meal reminders
- One-tap meal logging
- Basic recipe management
- Basic meal planning

**Priority 2 (High Impact, Early Post-MVP):**
- Meal prep sessions
- Prepped meal inventory
- Visual shopping lists
- Household sharing

**Can Defer:**
- AI features (can launch without, add incrementally)
- Advanced variety tracking
- Food chaining
- Calendar integration
- Grocery delivery integration

---

*End of Logical Architecture Document*
