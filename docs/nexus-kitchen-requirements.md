# Meal Planning Application — Software Requirements Specification

**Document Version:** 1.0  
**Date:** June 4, 2026  
**Project:** Nexus Kitchen — Meal Planning Application with ADHD Accommodations

---

## 1. Executive Summary

### 1.1 Purpose

This document defines the comprehensive requirements for a meal planning application designed to address both general meal management needs and specific challenges faced by individuals with ADHD. The application will provide meal planning, nutrition tracking, recipe management, inventory management, and shopping list functionality—all built with principles that reduce cognitive load and support executive function challenges.

### 1.2 Scope

The application encompasses:

- Meal planning and scheduling
- Calorie and nutritional tracking
- Recipe management and import
- Pantry and grocery inventory management
- Shopping list generation and management
- ADHD-specific accommodations and features
- Multi-user household support
- Online-first operation with local read caching
- Managed Supabase backend; responsive web app served by Caddy (no native apps)

### 1.3 Design Philosophy

The application is guided by a core principle: **"Good enough nutrition maintained consistently beats perfect nutrition attempted sporadically."** All features must work with ADHD brain patterns rather than forcing neurotypical productivity models.

---

## 2. Stakeholder Requirements

### 2.1 Target Users

**Primary Users:**
- Individuals with ADHD who struggle with meal planning, remembering to eat, grocery management, and executive function around cooking
- Household members and families seeking collaborative meal management

**Secondary Users:**
- Community contributors who may extend the application

### 2.2 Business Constraints

| Constraint | Requirement |
|------------|-------------|
| Development Team | Solo developer or small team |
| Operational Cost | Runs within Supabase's free tier for personal/household use; the web app is static files on your own Caddy host; modest paid cost only if Supabase limits are exceeded |
| Licensing | Open source license that requires derivative works to remain open source |
| Deployment | Managed Supabase backend; static web app self-hosted behind Caddy; no app-store distribution |

---

## 3. Functional Requirements

### 3.1 Meal Planning

#### 3.1.1 Calendar-Based Planning
- REQ-MP-001: Users shall be able to create, view, and edit meal plans on a calendar view (daily, weekly, monthly)
- REQ-MP-002: Users shall be able to assign meals to a meal slot (breakfast, lunch, dinner, snack) or leave them unslotted ("anytime"), with more than one meal allowed per slot
- REQ-MP-003: The system shall support recurring meal schedules
- REQ-MP-004: Users shall be able to drag and drop meals between dates
- REQ-MP-005: The system shall display cumulative nutritional information for planned meals

#### 3.1.2 Intelligent Suggestions
- REQ-MP-006: The system shall suggest meals based on available pantry ingredients
- REQ-MP-007: The system shall prioritize ingredients approaching expiration in meal suggestions
- REQ-MP-008: The system shall learn user preferences over time and incorporate them into suggestions
- REQ-MP-009: The system shall factor in user-reported energy levels when suggesting meals
- REQ-MP-010: The system shall avoid suggesting meals containing user-specified disliked ingredients or allergens

### 3.2 Recipe Management

#### 3.2.1 Recipe Storage
- REQ-RC-001: Users shall be able to create recipes with title, ingredients, instructions, prep time, cook time, servings, and photos
- REQ-RC-002: Users shall be able to categorize recipes with tags (dietary, cuisine type, meal type, etc.)
- REQ-RC-003: Users shall be able to rate and review recipes
- REQ-RC-004: Users shall be able to mark recipes as favorites
- REQ-RC-005: The system shall support structured instructions (step-by-step format)

#### 3.2.2 Recipe Import
- REQ-RC-006: Users shall be able to import recipes from URLs (web scraping with structured data extraction)
- REQ-RC-007: Users shall be able to import recipes from photos (OCR and intelligent parsing)
- REQ-RC-008: Users shall be able to manually enter recipes
- REQ-RC-009: Imported recipes shall have automatically calculated nutritional information

#### 3.2.3 Recipe Scaling and Conversion
- REQ-RC-010: Users shall be able to scale recipes to different serving sizes
- REQ-RC-011: The system shall adjust ingredient quantities proportionally when scaling
- REQ-RC-012: The system shall support unit conversion for ingredients

#### 3.2.4 Energy-Based Classification
- REQ-RC-013: Recipes shall be classified by preparation energy required (1-5 scale from minimal effort to complex)
- REQ-RC-014: Recipes shall track both total time and active hands-on time separately
- REQ-RC-015: Users shall be able to filter recipes by energy level required

### 3.3 Nutrition Tracking

#### 3.3.1 Nutritional Data
- REQ-NT-001: The system shall maintain nutritional information per ingredient (calories, macronutrients, micronutrients)
- REQ-NT-002: The system shall calculate total nutrition for recipes based on ingredients
- REQ-NT-003: The system shall integrate with external nutrition databases for food data
- REQ-NT-004: Users shall be able to manually override or add nutritional data for custom foods

#### 3.3.2 Tracking and Goals
- REQ-NT-005: Users shall be able to set daily nutritional targets (calories, protein, carbs, fat, etc.)
- REQ-NT-006: Users shall be able to log meals consumed (planned or ad-hoc)
- REQ-NT-007: The system shall display progress toward daily/weekly nutritional goals
- REQ-NT-008: The system shall provide nutritional gap analysis with food suggestions to address deficiencies

#### 3.3.3 Compassionate Tracking (ADHD-Specific)
- REQ-NT-009: Nutrition tracking shall be opt-in and clearly optional
- REQ-NT-010: The system shall never use shaming language about nutrition choices
- REQ-NT-011: The system shall present nutrition information as neutral data, not judgment
- REQ-NT-012: The system shall celebrate consistency over perfection

### 3.4 Pantry and Inventory Management

#### 3.4.1 Inventory Tracking
- REQ-PM-001: Users shall be able to add items to pantry inventory with quantity, unit, and location (fridge, pantry, freezer)
- REQ-PM-002: Users shall be able to track expiration dates for perishable items
- REQ-PM-003: The system shall alert users to items approaching expiration
- REQ-PM-004: Users shall be able to add items via barcode scanning
- REQ-PM-005: Users shall be able to add items via photo with intelligent recognition
- REQ-PM-006: Users shall be able to mark items as "running low" with configurable minimum quantities

#### 3.4.2 Visual Inventory (ADHD-Specific)
- REQ-PM-007: Users shall be able to attach photos to pantry items
- REQ-PM-008: The system shall display a visual grid view of pantry contents (addressing "out of sight, out of mind")
- REQ-PM-009: The system shall organize visual inventory by storage location

#### 3.4.3 Automatic Inventory Updates
- REQ-PM-010: When users complete a recipe, the system shall offer to deduct used ingredients from inventory
- REQ-PM-011: When users complete a shopping list, the system shall offer to add purchased items to inventory

### 3.5 Shopping List Management

#### 3.5.1 List Creation
- REQ-SL-001: Users shall be able to manually add items to shopping lists
- REQ-SL-002: The system shall automatically generate shopping lists from meal plans based on required ingredients minus pantry inventory
- REQ-SL-003: Users shall be able to manage multiple shopping lists
- REQ-SL-004: Users shall be able to add items to shopping list directly from recipes

#### 3.5.2 Visual Shopping Lists (ADHD-Specific)
- REQ-SL-005: Shopping list items shall display product photos when available
- REQ-SL-006: Shopping lists shall be organized by store section/aisle
- REQ-SL-007: Users shall be able to define custom store layouts and section ordering
- REQ-SL-008: Users shall be able to save store layouts for frequently visited stores

#### 3.5.3 Shopping Experience
- REQ-SL-009: Users shall be able to check off items while shopping
- REQ-SL-010: Checked items shall move to a "completed" section rather than disappearing
- REQ-SL-011: Users shall be able to add items via barcode scan while shopping
- REQ-SL-012: The system shall support linking shopping items to online product sources

#### 3.5.4 Online Ordering Integration
- REQ-SL-013: Users shall be able to export shopping lists to common online grocery services
- REQ-SL-014: The system shall provide an extensible framework for integrating with delivery services

### 3.6 Meal Reminders and Logging (ADHD-Specific)

#### 3.6.1 Reminders
- REQ-MR-001: Users shall be able to set recurring meal reminders (e.g., "Time to eat lunch")
- REQ-MR-002: Reminders shall support pre-alerts (e.g., 30 minutes before meal time for preparation)
- REQ-MR-003: Users shall be able to configure reminder timing for each meal slot
- REQ-MR-004: Reminders shall be dismissable without guilt-inducing language
- REQ-MR-005: Missed reminders shall not generate shame-inducing notifications

#### 3.6.2 Quick Logging
- REQ-MR-006: Users shall be able to log meals with one tap (minimal friction)
- REQ-MR-007: Users shall be able to log current energy level (1-5 scale) alongside meals
- REQ-MR-008: The system shall support quick-add from favorites or recent meals
- REQ-MR-009: The system shall support logging "something" without specifying what (acknowledgment without detail)

#### 3.6.3 Visual Timeline
- REQ-MR-010: The system shall display a visual timeline of eating patterns
- REQ-MR-011: The timeline shall show gaps without negative framing
- REQ-MR-012: The system shall recognize and celebrate streaks without penalizing breaks

### 3.7 Energy-Aware Features (ADHD-Specific)

#### 3.7.1 Energy Tracking
- REQ-EA-001: Users shall be able to report current energy level (1-5 scale)
- REQ-EA-002: The system shall learn typical energy patterns by time of day and day of week
- REQ-EA-003: The system shall use historical patterns to predict energy levels

#### 3.7.2 Energy-Based Filtering
- REQ-EA-004: Users shall be able to filter all suggestions by current energy level
- REQ-EA-005: When energy is low, the system shall prioritize simple meals, premade options, and delivery
- REQ-EA-006: The system shall surface "no-cook" options when energy is very low
- REQ-EA-007: The system shall never suggest complex meals when user reports low energy

### 3.8 Food Variety and Rotation (ADHD-Specific)

#### 3.8.1 Hyperfixation Awareness
- REQ-FV-001: The system shall track food frequency patterns (non-judgmentally)
- REQ-FV-002: The system shall identify when a user may be in a food hyperfixation period
- REQ-FV-003: Hyperfixation tracking shall be informational only, never shaming
- REQ-FV-004: The system shall respect hyperfixations as valid eating patterns

#### 3.8.2 Gentle Variety Suggestions
- REQ-FV-005: The system shall offer "safe food rotation" suggestions—variations on current favorites
- REQ-FV-006: The system shall support "food chaining"—introducing new foods similar to current favorites
- REQ-FV-007: Variety suggestions shall be optional and never pushy
- REQ-FV-008: The system shall suggest variations on familiar foods (different sauces, toppings, preparations)

#### 3.8.3 Food Profiles
- REQ-FV-009: The system shall track food characteristics (texture, temperature, flavor profile, complexity)
- REQ-FV-010: The system shall use food profiles to suggest similar new foods based on preferred characteristics

### 3.9 Cooking Assistance (ADHD-Specific)

#### 3.9.1 Adaptive Recipe Instructions
- REQ-CA-001: Users shall be able to view recipes in a step-by-step cooking mode
- REQ-CA-002: Users shall be able to request more detailed breakdown of recipe steps (adjustable granularity)
- REQ-CA-003: The system shall provide intelligent step breakdown using AI when requested
- REQ-CA-004: Instructions shall use imperative, action-focused language

#### 3.9.2 Timer Management
- REQ-CA-005: Users shall be able to set multiple named timers from within recipes
- REQ-CA-006: The system shall automatically detect time references in recipe steps and offer to set timers
- REQ-CA-007: Timers shall provide visual countdown with progress indicators
- REQ-CA-008: Timers shall support audio and haptic notifications

#### 3.9.3 Progress Tracking
- REQ-CA-009: Users shall be able to track progress through recipe steps with visual indicators
- REQ-CA-010: Users shall be able to check off completed steps
- REQ-CA-011: Users shall be able to check off gathered ingredients

#### 3.9.4 Kitchen Display Mode
- REQ-CA-012: The application shall provide a kitchen display mode optimized for countertop use
- REQ-CA-013: Kitchen mode shall use large touch targets suitable for messy hands
- REQ-CA-014: Kitchen mode shall keep the screen awake during active cooking
- REQ-CA-015: Kitchen mode shall support hands-free progression (optional voice control as stretch goal)

### 3.10 Household and Sharing

#### 3.10.1 Household Management
- REQ-HH-001: Users shall be able to create and join households
- REQ-HH-002: Households shall support multiple members with role-based permissions (admin, member, viewer)
- REQ-HH-003: Users shall be able to invite others to households via email or link

#### 3.10.2 Shared Resources
- REQ-HH-004: Households shall share pantry inventory
- REQ-HH-005: Households shall share shopping lists
- REQ-HH-006: Households shall share meal plans
- REQ-HH-007: Users shall be able to designate recipes as household-shared or personal
- REQ-HH-008: Changes to shared resources shall sync in real-time across household members

#### 3.10.3 Collaboration
- REQ-HH-009: Shopping list items shall support assignment to specific household members
- REQ-HH-010: Users shall be able to mark items as purchased with attribution
- REQ-HH-011: The system shall provide notifications for shared list changes (configurable)

### 3.11 Meal Prep Support

#### 3.11.1 Meal Prep Session Planning
- REQ-PP-001: Users shall be able to select one or more recipes to batch cook in a meal prep session
- REQ-PP-002: Users shall be able to specify the number of servings to prepare for each selected recipe
- REQ-PP-003: The system shall suggest a meal prep day, defaulting to common prep days (e.g., weekends)
- REQ-PP-004: Users shall be able to override the suggested prep day
- REQ-PP-005: The system shall generate a meal plan distributing prepped meals across future days
- REQ-PP-006: The default planning horizon shall be calculated as: (new prepped servings + existing prepped inventory) / user's meals per day
- REQ-PP-007: Users shall be able to configure the planning horizon manually
- REQ-PP-008: Users shall be able to regenerate meal distribution ("replan") with a single action
- REQ-PP-009: Users shall be able to manually adjust the generated meal assignments

#### 3.11.2 Prepped Meal Inventory
- REQ-PP-010: Prepped meals shall be tracked in inventory as individual portions/servings
- REQ-PP-011: Each prepped meal portion shall track: recipe source, preparation date, storage location (fridge/freezer), and expiration date
- REQ-PP-012: The system shall apply different default shelf lives based on storage location (fridge vs. freezer)
- REQ-PP-013: Users shall be able to adjust shelf life estimates for individual items
- REQ-PP-014: The system shall visually indicate prepped meals approaching expiration
- REQ-PP-015: The system shall suggest "eat this first" based on expiration dates
- REQ-PP-016: Users shall be able to record moving frozen meals to the fridge for defrosting
- REQ-PP-017: The system shall track defrost time and adjust "ready to eat" status accordingly
- REQ-PP-018: Users shall be able to consume/remove prepped meal portions from inventory

#### 3.11.3 Meal Prep Integration with Shopping
- REQ-PP-019: When planning a meal prep session, the system shall calculate required ingredients across all selected recipes
- REQ-PP-020: The system shall compare required ingredients against current pantry inventory
- REQ-PP-021: The system shall generate a shopping list for missing ingredients
- REQ-PP-022: The shopping list shall indicate which items are needed for which prep recipes

#### 3.11.4 Meal Prep Integration with Meal Planning
- REQ-PP-023: Prepped meals in inventory shall be available as options when generating meal plans
- REQ-PP-024: At the start of meal plan generation, users shall be prompted for their preference: prioritize prepped meals, prioritize fresh cooking, or no preference
- REQ-PP-025: The preference prompt shall include a visual preview of prepped inventory (with expiration indicators) without overwhelming the user
- REQ-PP-026: The user's preference shall be a suggestion that can be adjusted, never forced
- REQ-PP-027: When prepped meals are selected for a day, the system shall automatically decrement from prepped inventory upon meal logging

#### 3.11.5 Meal Prep Energy Integration (ADHD-Specific)
- REQ-PP-028: When energy-aware planning is enabled, high-energy days shall default to suggesting fresh cooking or new meal prep sessions
- REQ-PP-029: When energy-aware planning is enabled, low-energy days shall default to suggesting prepped meals or simple options
- REQ-PP-030: Energy-based defaults shall always be overridable by the user
- REQ-PP-031: The system shall never force meal choices based on energy levels

### 3.12 Feature Configuration

#### 3.12.1 Feature Categorization
- REQ-CFG-001: Passive enhancement features (energy-aware filtering, expiration-aware suggestions, prepped meal prioritization, smart defaults) shall be enabled by default and individually toggleable
- REQ-CFG-002: Active tracking features (energy logging, energy pattern learning, nutrition tracking, variety tracking, hyperfixation awareness, food chaining suggestions) shall be disabled by default and require explicit opt-in
- REQ-CFG-003: Design philosophy elements (shame-free language, minimal taps, visual feedback, graceful exit ramps) shall be embedded in all features and not configurable

#### 3.12.2 Onboarding
- REQ-CFG-004: Onboarding shall capture user preferences using relatable statements (e.g., "I sometimes forget to eat") rather than clinical or diagnostic labels
- REQ-CFG-005: Onboarding selections shall set initial feature defaults, with all settings individually overridable in Settings
- REQ-CFG-006: The system shall never surface "ADHD" terminology or other clinical labels in user-facing UI

#### 3.12.3 Data Preservation
- REQ-CFG-007: Disabling an active tracking feature shall not delete historical data collected while the feature was enabled
- REQ-CFG-008: Users shall be able to explicitly delete tracking data for any feature independently of disabling the feature

---

## 4. Non-Functional Requirements

### 4.1 Platform Support

#### 4.1.1 Client Platforms
- REQ-PF-001: The application shall run as a responsive web app on desktop and mobile through the browser; no native app is distributed
- REQ-PF-002: The application shall run in modern web browsers (Chrome, Firefox, Safari, Edge)

#### 4.1.2 Responsive Design
- REQ-PF-003: The application shall adapt layout for phone screen sizes
- REQ-PF-004: The application shall provide optimized layouts for tablets (7", 10", 12"+)
- REQ-PF-005: Tablet layouts shall support side-by-side views (e.g., ingredients and instructions together)

### 4.2 Connectivity & Caching

#### 4.2.1 Online-First Model
- REQ-CN-001: The application requires network connectivity for normal operation; reads and writes go through the managed backend (Supabase).
- REQ-CN-002: The application shall cache recently viewed data (e.g., recipes, the current meal plan, the active shopping list) locally to keep navigation responsive and reduce redundant fetches.
- REQ-CN-003: The application shall apply optimistic UI updates for high-frequency actions (meal logging, checking off shopping items) and reconcile against the server response.
- REQ-CN-004: The application shall clearly indicate connectivity status and surface a non-blocking, non-shaming message when an action cannot complete without a connection.
- REQ-CN-005: On transient network failure, the application shall preserve user input and offer retry (see REQ-EH-003, REQ-EH-004).

#### 4.2.2 Realtime Household Sync
- REQ-CN-006: Changes to shared household resources shall propagate to other online members in near-real-time via Supabase Realtime.
- REQ-CN-007: Concurrent edits shall resolve last-write-wins at row/field granularity; append-only records (meal logs, energy logs, prepped-portion events) shall never be overwritten.

### 4.3 Performance

- REQ-PR-001: Application startup time shall be under 3 seconds on supported devices
- REQ-PR-002: Screen transitions shall complete in under 300ms
- REQ-PR-003: Recipe search shall return results in under 500ms against cached local data
- REQ-PR-004: The application shall remain responsive while fetching or refreshing data in the background
- REQ-PR-005: The local cache shall efficiently handle recipe libraries of 10,000+ items

### 4.4 Security

#### 4.4.1 Authentication
- REQ-SC-001: Authentication shall be provided by Supabase Auth (email/password and, optionally, third-party OAuth providers)
- REQ-SC-002: Credential storage and password hashing are managed by Supabase Auth; the application shall not implement its own password storage
- REQ-SC-003: The system shall use Supabase-issued JWT access tokens with refresh-token rotation as provided by Supabase Auth
- REQ-SC-004: The system shall store auth tokens securely via the Supabase client's browser session storage

#### 4.4.2 Data Protection
- REQ-SC-005: All data in transit shall be encrypted
- REQ-SC-006: User data shall be isolated between accounts/households, enforced via Postgres Row-Level Security (RLS)
- REQ-SC-007: All data access shall be authorized server-side via RLS policies; the client is never trusted for authorization
- REQ-SC-008: The system shall protect against common web vulnerabilities (XSS, CSRF, injection)

### 4.5 Privacy

- REQ-PV-001: Users shall be able to export all their data in standard formats (JSON, CSV)
- REQ-PV-002: Users shall be able to delete their account and all associated data
- REQ-PV-003: The application shall collect no usage telemetry without explicit opt-in

### 4.6 Accessibility

- REQ-AC-001: The application shall support system accessibility settings (font scaling, high contrast)
- REQ-AC-002: Interactive elements shall meet minimum touch target sizes (44pt minimum)
- REQ-AC-003: Color shall not be the sole indicator of state or meaning
- REQ-AC-004: The application shall support screen readers where platform capabilities allow
- REQ-AC-005: Kitchen display mode shall use extra-large touch targets (66-96pt)

### 4.7 Maintainability

#### 4.7.1 Modularity
- REQ-MT-001: The database is PostgreSQL via Supabase; data access shall be encapsulated so domain logic is not scattered through the UI. Pluggable database backends are out of scope.
- REQ-MT-002: Authentication is Supabase Auth; additional identity providers are configured within Supabase rather than via a custom auth abstraction.
- REQ-MT-003: The AI integration layer shall be modular, allowing different AI providers
- REQ-MT-004: Integrations shall be implementable as plugins without modifying core code

#### 4.7.2 Testing
- REQ-MT-005: The codebase shall include unit tests for business logic
- REQ-MT-006: The codebase shall include integration tests for API endpoints
- REQ-MT-007: The codebase shall include end-to-end tests for critical user flows
- REQ-MT-008: Test coverage shall be tracked and maintained above minimum thresholds

#### 4.7.3 Documentation
- REQ-MT-009: API endpoints shall be documented
- REQ-MT-010: Deployment procedures shall be documented
- REQ-MT-011: Plugin/extension development shall be documented
- REQ-MT-012: User guides shall be provided

### 4.8 Deployment

- REQ-DP-001: The web client shall be built as a static SvelteKit SPA (adapter-static) and served by Caddy on self-hosted infrastructure
- REQ-DP-002: The backend shall be a hosted Supabase project (Postgres, Auth, Storage, Realtime, Edge Functions)
- REQ-DP-003: HTTPS shall be provided automatically by Caddy for the web app and by Supabase for the API
- REQ-DP-004: Configuration (Supabase URL/keys, provider credentials) shall be supplied via environment variables / platform secrets
- REQ-DP-005: Database schema changes shall be managed as versioned migrations via the Supabase CLI

---

## 5. Integration Requirements

### 5.1 External Data Sources

#### 5.1.1 Nutrition Databases
- REQ-IN-001: The system shall integrate with at least one free/open nutrition database
- REQ-IN-002: Nutrition lookups shall include fallback behavior when primary source unavailable
- REQ-IN-003: Users shall be able to cache nutrition data locally

#### 5.1.2 Barcode Databases
- REQ-IN-004: The system shall integrate with barcode lookup services for product identification
- REQ-IN-005: Barcode lookups shall return product name, brand, and basic information

### 5.2 AI Integration

#### 5.2.1 AI Capabilities
- REQ-AI-001: The system shall use AI for recipe import/parsing from photos and URLs
- REQ-AI-002: The system shall use AI for intelligent meal suggestions
- REQ-AI-003: The system shall use AI for recipe step breakdown (adjustable granularity)
- REQ-AI-004: The system shall use AI for food recognition from photos
- REQ-AI-005: The system shall use AI for nutritional analysis and advice

#### 5.2.2 AI Provider Flexibility
- REQ-AI-006: The AI integration shall use cloud AI providers by default; local model execution is optional and out of scope for MVP
- REQ-AI-007: The AI integration shall support multiple cloud AI providers
- REQ-AI-008: The AI integration shall gracefully degrade when AI services are unavailable
- REQ-AI-009: Users shall be able to configure their preferred AI provider

### 5.3 Calendar Integration (Stretch Goal)

- REQ-CL-001: Users should be able to export meal plans to external calendar applications
- REQ-CL-002: Users should be able to sync meal reminders with system calendars

---

## 6. User Experience Requirements

### 6.1 Design Principles (ADHD-Informed)

#### 6.1.1 Cognitive Load Reduction
- REQ-UX-001: Each screen shall have a single primary action
- REQ-UX-002: The system shall minimize required decision points
- REQ-UX-003: Common tasks shall require no more than 3 taps/clicks
- REQ-UX-004: Forms shall use smart defaults whenever possible
- REQ-UX-005: The system shall remember user preferences and past choices

#### 6.1.2 Shame-Free Design
- REQ-UX-006: The system shall never use negative language about user behavior
- REQ-UX-007: Gaps in logging shall be presented neutrally, not as failures
- REQ-UX-008: Progress shall be celebrated without creating pressure
- REQ-UX-009: All features shall have graceful "exit ramps" (easy to dismiss, skip, or defer)
- REQ-UX-010: Notifications shall never be guilt-inducing

#### 6.1.3 External Scaffolding
- REQ-UX-011: The system shall provide persistent visual reminders and cues
- REQ-UX-012: Important information shall remain visible (not hidden in menus)
- REQ-UX-013: The system shall provide clear visual status indicators
- REQ-UX-014: The system shall support the user's memory through visual timelines and history

#### 6.1.4 Immediate Feedback
- REQ-UX-015: User actions shall produce immediate visual feedback
- REQ-UX-016: Loading states shall be clearly indicated
- REQ-UX-017: Success and error states shall be clearly communicated
- REQ-UX-018: The system shall use haptic feedback for confirmations (on supported devices)

### 6.2 Visual Design

- REQ-VD-001: The interface shall use clean, uncluttered layouts
- REQ-VD-002: Visual hierarchy shall clearly indicate primary vs. secondary actions
- REQ-VD-003: The system shall support light and dark color modes
- REQ-VD-004: Icons shall be accompanied by text labels for clarity
- REQ-VD-005: The system shall use consistent visual language throughout

> The visual language realizing these requirements — the "Warm Kitchen, Calm Mind" palette, the 1–5 energy scale, type, spacing, component vocabulary, and light/dark — is specified in **nexus-kitchen-design-system.md** (built from the Claude Design mockup).

### 6.3 Error Handling

- REQ-EH-001: Error messages shall be human-readable (no technical jargon)
- REQ-EH-002: Error messages shall suggest corrective actions when possible
- REQ-EH-003: The system shall not lose user input on errors
- REQ-EH-004: Network errors shall be handled gracefully with retry options

---

## 7. Constraints and Assumptions

### 7.1 Constraints

- **C-001:** Development resources are limited (solo developer or small team)
- **C-002:** Operational cost should stay within Supabase's free tier; the web app is self-hosted static files behind Caddy
- **C-003:** The license must be copyleft open source

### 7.2 Assumptions

- **A-001:** Users have reliable internet access for normal operation; brief gaps are tolerated via read caching, but full offline use is not supported
- **A-002:** Mobile devices have sufficient storage for local read caching

### 7.3 Dependencies

- **D-001:** Free-tier nutrition databases remain available and accessible
- **D-002:** Barcode lookup services remain available with acceptable rate limits

---

## 8. Glossary

| Term | Definition |
|------|------------|
| Energy Level | A user-reported scale (1-5) indicating current cognitive/physical capacity for tasks |
| Food Chaining | A therapeutic technique that introduces new foods by starting with accepted foods and making small, systematic changes |
| Food Hyperfixation | An ADHD-related pattern where a person eats the same food(s) repeatedly for an extended period |
| Household | A group of users who share resources (pantry, meal plans, shopping lists) |
| Kitchen Display Mode | A specialized UI mode optimized for viewing recipes while cooking, with large text and touch targets |
| Meal Prep Session | A planned batch cooking event where users prepare multiple servings of one or more recipes for future consumption |
| Planning Horizon | The number of days into the future that a meal plan covers |
| Prepped Meal | A portion of a previously prepared recipe stored for future consumption |
| Safe Food | Foods that a person can reliably eat regardless of sensory or energy state |
| Shame-Free Design | Design approach that presents information neutrally without judgment or guilt-inducing language |

---

## 9. Revision History

| Version | Date | Author | Description |
|---------|------|--------|-------------|
| 1.0 | 2026-06-04 | Robert | Initial requirements specification for Nexus Kitchen. |

---

## Appendix A: ADHD Feature Priority Matrix

Based on research into ADHD-specific food management challenges, features are prioritized by their impact on addressing core executive function difficulties:

### Priority 1 — MVP (Must Have)
These features address the most fundamental ADHD challenges:

1. **Meal Reminders** — Addresses forgetting to eat due to impaired interoception
2. **One-Tap Meal Logging** — Removes friction that prevents tracking
3. **Energy-Based Meal Filtering** — Respects variable executive function capacity

### Priority 2 — High Impact
These features significantly reduce cognitive load:

1. **Meal Prep Session Planning** — Batches decision-making to high-energy times, provides low-friction options for low-energy days
2. **Prepped Meal Inventory** — Tracks ready-to-eat options with expiration awareness
3. **Visual Shopping Lists** — Addresses "out of sight, out of mind"
4. **Store Section Organization** — Reduces wandering and forgotten items
5. **Household Sharing** — Distributes executive function burden

### Priority 3 — Enhanced Experience
These features provide meaningful quality of life improvements:

1. **AI Recipe Step Breakdown** — Reduces overwhelm from complex recipes
2. **Multi-Timer Management** — Supports working memory limitations
3. **Kitchen Display Mode** — Reduces friction during cooking
4. **Favorite Meals** — Provides quick access to reliable options
5. **Defrost Tracking** — Removes "did I take that out?" uncertainty

### Priority 4 — Advanced Features
These features provide additional support but are not essential:

1. **Food Variety Rotation** — Gently addresses hyperfixation patterns
2. **Food Chaining Suggestions** — Supports expanding food acceptance
3. **Hyperfixation Tracking** — Provides pattern awareness
4. **Compassionate Nutrition Insights** — Optional, shame-free nutrition awareness

---

## Appendix B: Success Metrics

The application's success should be measured by adoption and engagement metrics that align with ADHD-friendly design:

### Engagement Metrics
- Daily active users who log at least one meal
- Percentage of users who set up meal reminders
- Shopping list completion rate (items checked off)
- Household feature adoption rate
- Meal prep session frequency (sessions per user per month)
- Prepped meal utilization rate (prepped meals consumed vs. expired/discarded)

### Quality Metrics
- User-reported satisfaction with energy-based filtering accuracy
- Time to complete common tasks (recipe search, meal logging, shopping list creation)
- Realtime sync reliability (successful household updates delivered to online members)
- Meal prep planning horizon accuracy (did suggested days match user needs)

### Design Validation Metrics
- Zero shame-inducing messaging complaints
- Positive feedback on variety suggestions (>60% helpful rating)
- Low uninstall rate after first week of use

---

*End of Requirements Document*
