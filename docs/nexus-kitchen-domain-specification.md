# Meal Planning Application - Domain Specification

**Document Version:** 1.0  
**Date:** June 4, 2026  
**Purpose:** Spec-Driven Development reference for domain models, invariants, and UI flows

---

## Table of Contents

1. [Domain Model Overview](#1-domain-model-overview)
2. [Core Domain Models](#2-core-domain-models)
3. [Domain Invariants](#3-domain-invariants)
4. [UI Flows](#4-ui-flows)
5. [State Machines](#5-state-machines)

---

## 1. Domain Model Overview

### 1.1 Bounded Contexts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MEAL PLANNING APPLICATION                        │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│   IDENTITY      │    RECIPES      │   INVENTORY     │      PLANNING         │
│   CONTEXT       │    CONTEXT      │   CONTEXT       │      CONTEXT          │
├─────────────────┼─────────────────┼─────────────────┼───────────────────────┤
│ • User          │ • Recipe        │ • PantryItem    │ • MealPlan            │
│ • Household     │ • RecipeStep    │ • PreppedMeal   │ • PlannedMeal         │
│ • Membership    │ • Ingredient    │ • StorageLocation│ • MealPrepSession    │
│ • Preferences   │ • RecipeTag     │                 │ • MealReminder        │
│                 │ • NutritionInfo │                 │                       │
├─────────────────┼─────────────────┼─────────────────┼───────────────────────┤
│   SHOPPING      │   NUTRITION     │                 │     VARIETY           │
│   CONTEXT       │   CONTEXT       │                 │     CONTEXT           │
├─────────────────┼─────────────────┼─────────────────┼───────────────────────┤
│ • ShoppingList  │ • NutritionGoal │                 │ • FoodHyperfixation   │
│ • ListItem      │ • NutritionLog  │                 │ • FoodProfile         │
│ • StoreLayout   │ • DailyIntake   │                 │ • ChainSuggestion     │
│ • StoreSection  │                 │                 │ • VariationIdea       │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
```

### 1.2 Context Map

```
Identity ←──────→ Recipes (User owns Recipes)
    │                 │
    ↓                 ↓
Household ←─────→ Inventory (Household shares Inventory)
    │                 │
    ↓                 ↓
Planning ←──────→ Inventory (Planning consumes/creates Inventory)
    │                 │
    ↓                 ↓
Shopping ←──────→ Planning (Shopping fulfills Planning needs)
    │
    ↓
Variety ←───────→ Planning (Variety informs Planning variety)
```

---

## 2. Core Domain Models

### 2.1 Identity Context

#### User
```
User {
    id: UserId [unique, immutable]
    email: Email [unique]
    displayName: String [1..100 chars]
    passwordHash: HashedPassword [internal]
    currentHouseholdId: HouseholdId? [nullable]
    preferences: UserPreferences
    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
    lastActiveAt: Timestamp
}

UserPreferences {
    // Basic settings
    mealsPerDay: PositiveInteger [default: 3, range: 1..10]
    defaultServings: PositiveInteger [default: 2, range: 1..20]
    measurementSystem: MeasurementSystem [METRIC | IMPERIAL]
    theme: Theme [LIGHT | DARK | SYSTEM]
    notificationsEnabled: Boolean [default: true]

    // Passive features (default ON, individually toggleable)
    // These enhance suggestions without requiring user input
    ratingAwareSuggestions: Boolean [default: true]    // Favor liked/loved, steer off hated
    expirationAwareSuggestions: Boolean [default: true] // Prioritize expiring items
    preppedMealSuggestions: Boolean [default: true]    // Suggest prepped meals when available
    smartMealDefaults: Boolean [default: true]         // Remember last choices, smart defaults

    // Active tracking features (default OFF, opt-in)
    // These require ongoing user input or track patterns
    nutritionTracking: Boolean [default: false]        // Track nutrition goals/progress
    varietyTracking: Boolean [default: false]          // Track food frequency patterns
    hyperfixationAwareness: Boolean [default: false]   // Identify hyperfixation periods
    foodChainingSuggestions: Boolean [default: false]  // Suggest similar new foods

    // Onboarding profile (informs defaults, not shown as labels)
    supportProfile: SupportProfile?
}

SupportProfile {
    // Captured during onboarding to set sensible defaults
    // Never labeled as "ADHD" in UI - framed as personal preferences

    wantsRemindersToEat: Boolean          // "I sometimes forget to eat"
    prefersSimpleOptions: Boolean          // "I often feel too tired to cook"
    likesVisualOrganization: Boolean       // "I work better with visual cues"
    wantsGentleVarietySuggestions: Boolean // "I tend to eat the same things"
    prefersMinimalDecisions: Boolean       // "I get overwhelmed by too many choices"

    // Used to set initial defaults, user can override any individual setting later
}

/*
 * FEATURE CATEGORIZATION DESIGN NOTE
 * ──────────────────────────────────────────────────────────────────────
 *
 * Features are categorized into three tiers based on user impact:
 *
 * 1. DESIGN PHILOSOPHY (Always On, Not Configurable)
 *    - Shame-free language throughout the app
 *    - Minimal taps for common actions
 *    - Visual feedback and progress indicators
 *    - Smart defaults that remember preferences
 *    - Graceful "exit ramps" (easy to dismiss/skip)
 *
 *    These are just good UX - everyone benefits, no toggle needed.
 *
 * 2. PASSIVE FEATURES (Default ON, Individually Toggleable)
 *    - Rating-aware suggestions (favor liked/loved)
 *    - Expiration-aware meal suggestions  
 *    - Prepped meal prioritization
 *    - Visual pantry and shopping lists
 *
 *    These enhance the experience without requiring user input.
 *    Low overhead, high benefit. Users can disable if not useful.
 *
 * 3. ACTIVE TRACKING (Default OFF, Opt-In)
 *    - Nutrition goal tracking
 *    - Hyperfixation detection
 *    - Food chaining suggestions
 *    - Variety scoring
 *
 *    These require ongoing user engagement and track behavioral patterns.
 *    Must be explicitly enabled. Some users find tracking stressful.
 *
 * ONBOARDING APPROACH:
 * - Present as personal preferences, not medical accommodations
 * - Use relatable "I sometimes..." statements
 * - Set defaults based on selections
 * - Never label anything as "ADHD features" in UI
 * - All settings individually adjustable post-onboarding
 *
 * ──────────────────────────────────────────────────────────────────────
 */
```

#### Household
```
Household {
    id: HouseholdId [unique, immutable]
    name: String [1..100 chars]
    createdBy: UserId [immutable]
    members: Set<HouseholdMember> [min: 1]
    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

HouseholdMember {
    odMembersh: HouseholdMemberId [unique, immutable]
    householdId: HouseholdId [immutable]
    userId: UserId [immutable]
    role: HouseholdRole [ADMIN | MEMBER | VIEWER]
    joinedAt: Timestamp [immutable]
}

HouseholdRole {
    ADMIN   // Can manage household, invite/remove members, full edit
    MEMBER  // Can edit shared resources
    VIEWER  // Read-only access to shared resources
}
```

### 2.2 Recipe Context

#### Recipe
```
Recipe {
    id: RecipeId [unique, immutable]
    ownerId: UserId [immutable]
    householdId: HouseholdId? [nullable, for shared recipes]

    // Core Info
    title: String [1..500 chars]
    description: String? [0..2000 chars]
    servings: PositiveInteger [range: 1..100]

    // Time
    prepTimeMinutes: NonNegativeInteger?
    cookTimeMinutes: NonNegativeInteger?
    activeTimeMinutes: NonNegativeInteger? [hands-on time]
    totalTimeMinutes: computed [prep + cook]

    // Classification
    tags: Set<RecipeTag>
    cuisineType: String?
    mealTypes: Set<MealType> [what the recipe IS, e.g., breakfast food;
                              independent of MealSlot / when it is planned]

    // Content
    ingredients: List<RecipeIngredient> [ordered, min: 1]
    steps: List<RecipeStep> [ordered, min: 1]
    notes: String? [0..5000 chars]

    // Media
    imageUrls: List<Url> [max: 10]
    sourceUrl: Url? [for imported recipes]

    // Nutrition (computed or overridden)
    nutritionPerServing: NutritionInfo?
    nutritionSource: NutritionSource [COMPUTED | MANUAL | EXTERNAL]

    // Metadata
    isFavorite: Boolean [default: false]
    rating: Rating? [1..5]
    timesCooked: NonNegativeInteger [default: 0]
    lastCookedAt: Timestamp?
    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

RecipeIngredient {
    id: RecipeIngredientId [unique]
    ingredientId: IngredientId?  [link to master ingredient, nullable for custom]
    name: String [1..200 chars]  [display name, may differ from master]
    quantity: PositiveDecimal
    unit: MeasurementUnit
    preparation: String? [e.g., "diced", "minced"]
    isOptional: Boolean [default: false]
    substituteFor: RecipeIngredientId? [for substitution suggestions]
    sortOrder: NonNegativeInteger
}

RecipeStep {
    id: RecipeStepId [unique]
    instruction: String [1..2000 chars]
    durationMinutes: NonNegativeInteger? [estimated time for step]
    timerMinutes: NonNegativeInteger? [if step requires a timer]
    timerLabel: String? [e.g., "Simmer sauce"]
    imageUrl: Url?
    sortOrder: NonNegativeInteger
}

RecipeTag {
    id: RecipeTagId [unique]
    name: String [1..50 chars, lowercase]
    category: TagCategory [DIETARY | CUISINE | MEAL_TYPE | COOKING_METHOD | CUSTOM]
}
```

#### Ingredient (Master Data)
```
Ingredient {
    id: IngredientId [unique, immutable]
    name: String [1..200 chars]
    alternateNames: Set<String> [for search]
    category: IngredientCategory
    defaultUnit: MeasurementUnit
    nutritionPer100g: NutritionInfo?
    barcode: String? [for scanning]
    isCommon: Boolean [for suggestion prioritization]

    // Food profile for variety features
    foodProfile: FoodProfile?
}

IngredientCategory {
    PRODUCE
    MEAT_SEAFOOD
    DAIRY
    GRAINS_BREAD
    CANNED_JARRED
    FROZEN
    CONDIMENTS_SAUCES
    SPICES_SEASONINGS
    SNACKS
    BEVERAGES
    BAKING
    OTHER
}
```

#### Nutrition
```
NutritionInfo {
    calories: NonNegativeDecimal [kcal]
    proteinGrams: NonNegativeDecimal
    carbsGrams: NonNegativeDecimal
    fatGrams: NonNegativeDecimal
    fiberGrams: NonNegativeDecimal?
    sugarGrams: NonNegativeDecimal?
    sodiumMg: NonNegativeDecimal?
    saturatedFatGrams: NonNegativeDecimal?
    cholesterolMg: NonNegativeDecimal?

    // Micronutrients (all optional)
    vitaminA_IU: NonNegativeDecimal?
    vitaminC_mg: NonNegativeDecimal?
    vitaminD_IU: NonNegativeDecimal?
    calcium_mg: NonNegativeDecimal?
    iron_mg: NonNegativeDecimal?
    potassium_mg: NonNegativeDecimal?
}
```

### 2.3 Inventory Context

#### PantryItem
```
PantryItem {
    id: PantryItemId [unique, immutable]
    ownerId: UserId [immutable]
    householdId: HouseholdId? [nullable, for shared pantry]

    // Item identification
    ingredientId: IngredientId? [link to master ingredient]
    name: String [1..200 chars]
    barcode: String?

    // Quantity
    quantity: NonNegativeDecimal
    unit: MeasurementUnit
    minimumQuantity: NonNegativeDecimal? [for "running low" alerts]

    // Storage
    storageLocation: StorageLocation [PANTRY | FRIDGE | FREEZER | OTHER]
    customLocation: String? [e.g., "garage freezer"]

    // Freshness
    purchaseDate: Date?
    expirationDate: Date?
    openedDate: Date? [some items expire faster once opened]

    // Visual
    photoUrl: Url?
    thumbnailUrl: Url?

    // State
    isRunningLow: computed [quantity <= minimumQuantity]
    isExpiringSoon: computed [expirationDate within 7 days]
    isExpired: computed [expirationDate < today]

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

StorageLocation {
    PANTRY   [default shelf life: 365 days]
    FRIDGE   [default shelf life: 7 days]
    FREEZER  [default shelf life: 90 days]
    OTHER    [default shelf life: 30 days]
}
```

#### PreppedMeal
```
PreppedMeal {
    id: PreppedMealId [unique, immutable]
    ownerId: UserId [immutable]
    householdId: HouseholdId? [nullable]

    // Source / provenance
    origin: PreppedMealOrigin               [how this ready-to-eat portion came to exist]
    name: String                            [display name, e.g., "Chili", "Store lasagna"]
    recipeId: RecipeId?                     [set only when cooked from a recipe; nullable]
    recipeName: String? [denormalized; present iff recipeId set]
    mealPrepSessionId: MealPrepSessionId?   [set only when origin = PREP_SESSION]

    // Portion tracking
    portionsRemaining: NonNegativeInteger
    originalPortions: PositiveInteger [immutable]

    // Storage state
    storageLocation: StorageLocation
    containerLabel: String? [e.g., "Blue lid container"]

    // Dates
    preparedDate: Date [immutable]
    expirationDate: Date

    // Defrost tracking
    defrostState: DefrostState
    defrostStartedAt: Timestamp?
    estimatedReadyAt: Timestamp? [computed from defrost start]

    // Visual
    photoUrl: Url?

    // Computed state
    isExpiringSoon: computed [expirationDate within 2 days]
    isExpired: computed [expirationDate < today]
    isReadyToEat: computed [defrostState == READY or storageLocation != FREEZER]

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

DefrostState {
    NOT_APPLICABLE  [item is not frozen]
    FROZEN          [in freezer, not defrosting]
    DEFROSTING      [moved to fridge, thawing]
    READY           [defrosted and ready to eat]
}

PreppedMealOrigin {
    PREP_SESSION   // produced by a MealPrepSession (one optional convenience)
    DIRECT_ENTRY   // entered directly ("I have 3 portions of X"), no session required
    STORE_BOUGHT   // a ready-made meal acquired from a store
}

// A PreppedMeal is any ready-to-eat portion in inventory, whatever its origin.
// A MealPrepSession is ONE optional way to create them; direct entry is the
// primary path and is never gated behind a session. recipeId is set only when
// the portion was cooked from a recipe; direct-entry and store-bought portions
// have none.
```

### 2.4 Planning Context

#### MealPlan
```
MealPlan {
    id: MealPlanId [unique, immutable]
    ownerId: UserId [immutable]
    householdId: HouseholdId? [nullable]

    name: String? [optional label, e.g., "Week of Dec 25"]
    startDate: Date
    endDate: Date

    plannedMeals: List<PlannedMeal>

    // Generation preferences (captured when plan was created)
    generationPreferences: PlanGenerationPreferences?

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

PlannedMeal {
    id: PlannedMealId [unique]
    mealPlanId: MealPlanId [immutable]

    date: Date
    mealSlot: MealSlot? [null = anytime / unslotted; see MealSlot notes]
    plannedTime: LocalTime? [optional explicit time; otherwise ordered by sortOrder]

    // What's planned (exactly one reference, matching source)
    source: PlannedMealSource
    recipeId: RecipeId?          [if source == RECIPE]
    preppedMealId: PreppedMealId? [if source == PREPPED]
    storeBoughtName: String?      [if source == STORE_BOUGHT, e.g., "frozen lasagna"]
    quickMealName: String?        [if source == QUICK, e.g., "Leftovers", "Takeout"]

    // Serving info
    servings: PositiveInteger [default: from recipe or 1]

    // Nutrition (computed or from source)
    nutritionInfo: NutritionInfo?

    // State
    status: PlannedMealStatus [PLANNED | LOGGED | SKIPPED | SWAPPED]
    loggedAt: Timestamp?

    sortOrder: NonNegativeInteger [ordering within (date, mealSlot); unique per group]
}

PlannedMealSource {
    RECIPE        // Cook from a recipe
    PREPPED       // Eat an existing ready-to-eat portion (homemade or store-bought)
    STORE_BOUGHT  // A ready-made meal you plan to buy (a "must acquire" requirement)
    QUICK         // Freeform option (takeout, leftovers, "whatever"); not fulfillment-tracked
}

PlannedMealStatus {
    PLANNED   // Scheduled but not yet eaten
    LOGGED    // Marked as eaten
    SKIPPED   // User skipped this meal
    SWAPPED   // Replaced with something else
}

// Fulfillment state: DERIVED, never stored. Computed per PlannedMeal against
// current inventory (the operational core; see the Differentiator):
//   HAVE_IT      - source = PREPPED and the referenced portion has portionsRemaining > 0
//   CAN_MAKE_IT  - source = RECIPE and every ingredient is on hand in the pantry
//   MUST_ACQUIRE - not yet satisfiable: a RECIPE missing ingredients (cook/shop),
//                  or a STORE_BOUGHT not yet purchased (buy)
// QUICK meals carry no fulfillment state by design. The whole product exists to
// move every requirement to HAVE_IT before its date.

MealSlot {
    BREAKFAST [typical time: 07:00-09:00]
    LUNCH     [typical time: 12:00-14:00]
    DINNER    [typical time: 18:00-20:00]
    SNACK     [no fixed time; may occur any number of times per day]
}

MealType {
    BREAKFAST
    LUNCH
    DINNER
    SNACK
}

// MealType and MealSlot share values today but are DISTINCT concepts and must
// not be merged: MealType describes what a recipe IS (a property of the recipe);
// MealSlot describes WHEN a meal is planned (a property of the PlannedMeal).
// This separation is what allows "breakfast for dinner": a recipe with
// mealType = BREAKFAST placed in mealSlot = DINNER.

// MealSlot is a conceptual time-of-day band, NOT a capacity limit. A
// PlannedMeal's mealSlot is optional: null = "anytime / unslotted".
// Any band (and the unslotted group) may hold multiple meals, ordered by
// sortOrder. Reminders and schedule rules target a specific (non-null) band.

PlanGenerationPreferences {
    preppedMealPriority: PrepPriority [PREFER_PREPPED | PREFER_FRESH | NO_PREFERENCE]
    excludeRecipeIds: Set<RecipeId>
    requiredTags: Set<RecipeTagId>
    excludedTags: Set<RecipeTagId>
}

PrepPriority {
    PREFER_PREPPED   // Use prepped meals first
    PREFER_FRESH     // Prefer fresh cooking
    NO_PREFERENCE    // Mix as appropriate
}
```

#### MealPrepSession
```
MealPrepSession {
    id: MealPrepSessionId [unique, immutable]
    ownerId: UserId [immutable]
    householdId: HouseholdId? [nullable]

    name: String? [optional label]
    scheduledDate: Date

    // Recipes to prep
    recipes: List<MealPrepRecipe> [min: 1]

    // Totals (computed)
    totalServings: computed [sum of recipe servings]
    totalPrepTime: computed [sum of recipe prep times]
    totalCookTime: computed [max of recipe cook times, assuming parallel]

    // Generated plan
    generatedMealPlanId: MealPlanId? [the plan created from this session]
    planningHorizonDays: PositiveInteger

    // State
    status: MealPrepSessionStatus
    completedAt: Timestamp?

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

MealPrepRecipe {
    id: MealPrepRecipeId [unique]
    sessionId: MealPrepSessionId [immutable]
    recipeId: RecipeId
    recipeName: String [denormalized]

    servingsToPrep: PositiveInteger
    storageLocation: StorageLocation [where it will be stored]

    // Computed
    ingredientsNeeded: List<IngredientRequirement> [computed from recipe * servings]
}

MealPrepSessionStatus {
    PLANNING     // User is selecting recipes
    SCHEDULED    // Prep day is set, shopping may be needed
    READY        // Shopping complete, ready to prep
    IN_PROGRESS  // Currently prepping
    COMPLETED    // Prep finished, meals in inventory
    CANCELLED    // User cancelled the session
}

IngredientRequirement {
    ingredientId: IngredientId?
    name: String
    quantityNeeded: PositiveDecimal
    quantityInPantry: NonNegativeDecimal
    quantityToShop: NonNegativeDecimal [computed: needed - inPantry, min 0]
    unit: MeasurementUnit
    forRecipeIds: Set<RecipeId> [which recipes need this]
}
```

#### MealReminder
```
MealReminder {
    id: MealReminderId [unique, immutable]
    userId: UserId [immutable]

    name: String [1..100 chars, e.g., "Lunch time"]
    mealSlot: MealSlot

    // Timing
    reminderTime: LocalTime [e.g., 12:00]
    preAlertMinutes: NonNegativeInteger? [e.g., 30 for prep reminder]

    // Schedule
    isEnabled: Boolean [default: true]
    daysOfWeek: Set<DayOfWeek> [min: 1 if enabled]

    // Notification preferences
    notificationType: NotificationType [PUSH | SILENT | NONE]

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

DayOfWeek {
    MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY
}
```

#### MealLog
```
MealLog {
    id: MealLogId [unique, immutable]
    userId: UserId [immutable]

    // What was eaten
    logType: MealLogType
    plannedMealId: PlannedMealId?  [if from plan]
    recipeId: RecipeId?            [if specific recipe]
    preppedMealId: PreppedMealId?  [if from prepped inventory]
    description: String?           [for quick logs]

    // When
    loggedAt: Timestamp
    mealSlot: MealSlot?

    // Quantity
    servings: PositiveDecimal [default: 1]

    // How the meal was (favors liked/loved, steers off hated in suggestions)
    rating: MealRating? [HATED | OK | LIKED | LOVED]

    // Nutrition (computed or estimated)
    nutritionInfo: NutritionInfo?

    // Notes
    notes: String? [0..1000 chars]

    createdAt: Timestamp [immutable]
}

MealLogType {
    FROM_PLAN       // Logged from meal plan
    FROM_RECIPE     // Cooked a recipe (not planned)
    FROM_PREPPED    // Ate prepped meal (not planned)
    QUICK_LOG       // Simple acknowledgment ("I ate something")
    CUSTOM          // Custom description
}

MealRating {
    HATED   // never again
    OK      // fine, neutral
    LIKED   // would have again
    LOVED   // a favorite
}
// Set when logging a meal; aggregated per recipe / prepped item to favor
// liked/loved and steer off hated in suggestions and variety. A verdict on the
// food, not a self-assessment.
```

#### MealScheduleRule
```
MealScheduleRule {
    id: MealScheduleRuleId [unique, immutable]
    ownerId: UserId [immutable]
    householdId: HouseholdId? [nullable, for shared schedules]

    name: String? [optional label, e.g., "Taco Tuesday"]
    mealSlot: MealSlot

    // What recurs (exactly one reference, matching source)
    source: ScheduledMealSource
    recipeId: RecipeId?       [if source == RECIPE]
    storeBoughtName: String?  [if source == STORE_BOUGHT, e.g., "frozen pizza"]
    quickMealName: String?    [if source == QUICK, e.g., "Leftovers", "Takeout"]

    servings: PositiveInteger [default: from recipe or 1]

    // Recurrence
    isEnabled: Boolean [default: true]
    daysOfWeek: Set<DayOfWeek> [min: 1 if enabled]
    effectiveFrom: Date? [optional start; null = always]
    effectiveTo: Date?   [optional end; null = no end]

    sortOrder: NonNegativeInteger [ordering when a slot has multiple rules]

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

ScheduledMealSource {
    RECIPE        // Schedule a specific recipe
    STORE_BOUGHT  // Schedule a recurring store-bought meal (e.g., "Friday: store pizza")
    QUICK         // Schedule a quick/simple option (leftovers, takeout, etc.)
    // PREPPED is intentionally excluded: prepped meals are specific, perishable
    // inventory portions and cannot be committed to a recurring rule. STORE_BOUGHT
    // is allowed because it names a repeatable to-acquire intent, not a specific portion.
}
```

Notes:
- A `MealScheduleRule` is a recurring template, not a scheduled instance. When a `MealPlan` is generated or extended over a date range, enabled rules whose `daysOfWeek` match a date populate `PlannedMeal`s for the corresponding `(date, mealSlot)`. Rules are a generation input, alongside `PlanGenerationPreferences`.
- Materialized `PlannedMeal`s remain fully editable; editing a generated meal does not change the rule. (Supports REQ-MP-003.)

#### MealSuggestionFeedback
```
MealSuggestionFeedback {
    id: MealSuggestionFeedbackId [unique, immutable]
    userId: UserId [immutable]

    // What was suggested (exactly one target must be set)
    target: SuggestedMealTarget
    recipeId: RecipeId?           [if target == RECIPE]
    preppedMealId: PreppedMealId? [if target == PREPPED]
    quickMealName: String?        [if target == QUICK]

    // Reaction
    reaction: SuggestionReaction

    // Context at suggestion time (supports preference learning)
    mealSlot: MealSlot?
    suggestedForDate: Date?

    createdAt: Timestamp [immutable]
}

SuggestedMealTarget {
    RECIPE
    PREPPED
    QUICK
}

SuggestionReaction {
    ACCEPTED   // User added the suggestion to a plan or chose it
    REJECTED   // User dismissed the suggestion
    DEFERRED   // User snoozed / "maybe later"
}
```

Notes:
- `MealSuggestionFeedback` is append-only; records are never mutated. It feeds suggestion ranking (REQ-MP-008) and informs avoidance via REJECTED (REQ-MP-010); meal `rating` (on MealLog) favors liked/loved and steers off hated.

### 2.5 Shopping Context

#### ShoppingList
```
ShoppingList {
    id: ShoppingListId [unique, immutable]
    ownerId: UserId [immutable]
    householdId: HouseholdId? [nullable, for shared lists]

    name: String [1..100 chars]

    // Source
    sourceType: ShoppingListSource
    mealPlanId: MealPlanId?      [if generated from plan]
    mealPrepSessionId: MealPrepSessionId? [if generated from prep session]

    // Store organization
    storeLayoutId: StoreLayoutId?

    items: List<ShoppingListItem>

    // State
    status: ShoppingListStatus
    completedAt: Timestamp?

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

ShoppingListItem {
    id: ShoppingListItemId [unique]
    shoppingListId: ShoppingListId [immutable]

    // Item identification
    ingredientId: IngredientId?
    name: String [1..200 chars]

    // Quantity
    quantity: PositiveDecimal
    unit: MeasurementUnit

    // Organization
    storeSectionId: StoreSectionId?
    sortOrder: NonNegativeInteger

    // Source tracking
    neededForRecipeIds: Set<RecipeId> [which recipes need this]

    // Visual
    photoUrl: Url?

    // Collaboration
    assignedToUserId: UserId?

    // State
    status: ShoppingItemStatus
    checkedAt: Timestamp?
    checkedByUserId: UserId?

    // Online ordering
    onlineProductId: String?
    onlineProductUrl: Url?
    onlineProvider: String?

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

ShoppingListSource {
    MANUAL        // Created manually by user
    FROM_PLAN     // Generated from meal plan
    FROM_PREP     // Generated from meal prep session
}

ShoppingListStatus {
    ACTIVE        // Currently in use
    SHOPPING      // User is actively shopping
    COMPLETED     // All items checked
    ARCHIVED      // Historical record
}

ShoppingItemStatus {
    PENDING       // Not yet purchased
    CHECKED       // Purchased/in cart
    UNAVAILABLE   // Marked as unavailable at store
    REMOVED       // Removed from list
}
```

#### StoreLayout
```
StoreLayout {
    id: StoreLayoutId [unique, immutable]
    userId: UserId [immutable]

    storeName: String [1..100 chars]
    isDefault: Boolean [default: false]

    sections: List<StoreSection> [ordered, min: 1]

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}

StoreSection {
    id: StoreSectionId [unique]
    storeLayoutId: StoreLayoutId [immutable]

    name: String [1..50 chars]
    color: HexColor? [for visual distinction]
    iconName: String? [icon identifier]

    // Default ingredient categories for this section
    defaultCategories: Set<IngredientCategory>

    sortOrder: NonNegativeInteger
}
```

### 2.6 Nutrition Context

#### NutritionGoal
```
NutritionGoal {
    id: NutritionGoalId [unique]
    userId: UserId [immutable]

    // Daily targets (all optional - user sets what they care about)
    dailyCalories: PositiveInteger?
    dailyProteinGrams: PositiveInteger?
    dailyCarbsGrams: PositiveInteger?
    dailyFatGrams: PositiveInteger?
    dailyFiberGrams: PositiveInteger?
    dailySodiumMg: PositiveInteger?

    // Active period
    effectiveFrom: Date
    effectiveTo: Date? [null = ongoing]

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}
```

#### DailyNutritionSummary
```
DailyNutritionSummary {
    id: DailyNutritionSummaryId [unique]
    userId: UserId [immutable]
    date: Date [immutable]

    // Totals from meal logs
    totalCalories: NonNegativeDecimal
    totalProteinGrams: NonNegativeDecimal
    totalCarbsGrams: NonNegativeDecimal
    totalFatGrams: NonNegativeDecimal
    totalFiberGrams: NonNegativeDecimal
    totalSodiumMg: NonNegativeDecimal

    // Goal comparison (if goals set)
    caloriesPercent: Decimal? [actual / goal * 100]
    proteinPercent: Decimal?
    carbsPercent: Decimal?
    fatPercent: Decimal?

    // Meal count
    mealsLogged: NonNegativeInteger

    lastUpdatedAt: Timestamp
}
```

### 2.7 Variety Context

#### FoodProfile
```
FoodProfile {
    id: FoodProfileId [unique]
    ingredientId: IngredientId? [link to master ingredient]
    name: String [1..200 chars]

    // Sensory characteristics
    texture: Texture? [CRUNCHY | SOFT | CHEWY | SMOOTH | CRISPY | CREAMY]
    temperature: Temperature? [HOT | WARM | ROOM_TEMP | COLD | FROZEN]
    flavorProfile: Set<Flavor> [SWEET | SALTY | SAVORY | UMAMI | SPICY | SOUR | BITTER]

    // Complexity
    complexity: ComplexityLevel [1..5, 1=simple single ingredient, 5=complex dish]

    // Dietary info
    dietaryTags: Set<DietaryTag>
    commonAllergens: Set<Allergen>

    // For chaining
    similarFoods: Set<FoodProfileId> [manually curated or AI-generated]
}

Texture { CRUNCHY | SOFT | CHEWY | SMOOTH | CRISPY | CREAMY | LIQUID }
Temperature { HOT | WARM | ROOM_TEMP | COLD | FROZEN }
Flavor { SWEET | SALTY | SAVORY | UMAMI | SPICY | SOUR | BITTER | BLAND }
```

#### FoodHyperfixation
```
FoodHyperfixation {
    id: FoodHyperfixationId [unique, immutable]
    userId: UserId [immutable]

    // What food
    foodName: String [1..200 chars]
    ingredientId: IngredientId?
    recipeId: RecipeId?

    // Pattern tracking
    startedAt: Date
    endedAt: Date? [null = still active]

    // Frequency
    occurrenceCount: PositiveInteger
    peakFrequencyPerDay: Decimal [max times eaten per day during fixation]

    // Status
    isActive: Boolean

    // Notes (user can add context if they want)
    notes: String?

    createdAt: Timestamp [immutable]
    updatedAt: Timestamp
}
```

#### ChainSuggestion
```
ChainSuggestion {
    id: ChainSuggestionId [unique]
    userId: UserId [immutable]

    // Current food
    currentFoodName: String
    currentFoodProfileId: FoodProfileId?

    // Suggested food
    suggestedFoodName: String
    suggestedFoodProfileId: FoodProfileId?
    suggestedRecipeId: RecipeId?

    // Why suggested
    similarityReason: String [e.g., "Similar texture and temperature"]
    sharedCharacteristics: Set<String>

    // Feedback
    status: SuggestionStatus [PENDING | ACCEPTED | REJECTED | TRIED]
    userFeedback: String?
    wasLiked: Boolean?

    createdAt: Timestamp [immutable]
    respondedAt: Timestamp?
}

SuggestionStatus {
    PENDING   // Not yet responded to
    ACCEPTED  // User will try it
    REJECTED  // User not interested
    TRIED     // User tried it (feedback recorded)
}
```

### 2.8 Common Types

```
// Identifiers (all are UUID or similar unique identifiers)
type UserId = UniqueId
type HouseholdId = UniqueId
type RecipeId = UniqueId
// ... etc

// Measurements
MeasurementUnit {
    // Volume
    ML | L | TSP | TBSP | CUP | FL_OZ | PINT | QUART | GALLON

    // Weight
    G | KG | OZ | LB

    // Count
    PIECE | SLICE | CLOVE | PINCH | DASH | BUNCH | CAN | PACKAGE

    // Other
    TO_TASTE
}

MeasurementSystem {
    METRIC    // mL, L, g, kg
    IMPERIAL  // cups, oz, lb
}

// Primitives with constraints
type PositiveInteger = Integer where value > 0
type NonNegativeInteger = Integer where value >= 0
type PositiveDecimal = Decimal where value > 0
type NonNegativeDecimal = Decimal where value >= 0
type Decimal = Number with arbitrary precision
type Timestamp = UTC datetime with timezone
type Date = Calendar date without time
type LocalTime = Time without date or timezone
type Email = String matching email pattern
type Url = String matching URL pattern
type HexColor = String matching #RRGGBB pattern
type Rating = Integer where 1 <= value <= 5
```

---

## 3. Domain Invariants

### 3.1 Identity Invariants

```
INV-ID-001: User email must be unique across all users
    ∀ u1, u2 ∈ Users: u1.id ≠ u2.id → u1.email ≠ u2.email

INV-ID-002: A user can be a member of at most one household
    ∀ u ∈ Users: |{m ∈ HouseholdMembers : m.userId = u.id}| ≤ 1

INV-ID-003: Every household must have at least one ADMIN member
    ∀ h ∈ Households: |{m ∈ h.members : m.role = ADMIN}| ≥ 1

INV-ID-004: The household creator must be an ADMIN member
    ∀ h ∈ Households: ∃ m ∈ h.members : m.userId = h.createdBy ∧ m.role = ADMIN

INV-ID-005: User's currentHouseholdId must reference a household they belong to
    ∀ u ∈ Users where u.currentHouseholdId ≠ null:
        ∃ m ∈ HouseholdMembers : m.userId = u.id ∧ m.householdId = u.currentHouseholdId
```

### 3.2 Recipe Invariants

```
INV-RC-001: Recipe must have at least one ingredient
    ∀ r ∈ Recipes: |r.ingredients| ≥ 1

INV-RC-002: Recipe must have at least one step
    ∀ r ∈ Recipes: |r.steps| ≥ 1

INV-RC-003: Recipe servings must be positive
    ∀ r ∈ Recipes: r.servings > 0

INV-RC-005: Ingredient quantities must be positive
    ∀ r ∈ Recipes, i ∈ r.ingredients: i.quantity > 0

INV-RC-006: Step sort orders must be unique within recipe
    ∀ r ∈ Recipes: ∀ s1, s2 ∈ r.steps: s1.id ≠ s2.id → s1.sortOrder ≠ s2.sortOrder

INV-RC-007: Ingredient sort orders must be unique within recipe
    ∀ r ∈ Recipes: ∀ i1, i2 ∈ r.ingredients: i1.id ≠ i2.id → i1.sortOrder ≠ i2.sortOrder

INV-RC-008: Active time cannot exceed total time
    ∀ r ∈ Recipes where r.activeTimeMinutes ≠ null ∧ r.totalTimeMinutes ≠ null:
        r.activeTimeMinutes ≤ r.totalTimeMinutes

INV-RC-009: Recipe rating must be 1-5 if set
    ∀ r ∈ Recipes where r.rating ≠ null: 1 ≤ r.rating ≤ 5

INV-RC-010: Shared recipe must have householdId set
    ∀ r ∈ Recipes where r.householdId ≠ null:
        ∃ h ∈ Households : h.id = r.householdId

INV-RC-011: Substitute ingredient must exist in same recipe
    ∀ r ∈ Recipes, i ∈ r.ingredients where i.substituteFor ≠ null:
        ∃ i2 ∈ r.ingredients : i2.id = i.substituteFor
```

### 3.3 Inventory Invariants

```
INV-INV-001: Pantry item quantity must be non-negative
    ∀ p ∈ PantryItems: p.quantity ≥ 0

INV-INV-002: Minimum quantity must be non-negative if set
    ∀ p ∈ PantryItems where p.minimumQuantity ≠ null: p.minimumQuantity ≥ 0

INV-INV-003: Expiration date must not be in distant past when created
    ∀ p ∈ PantryItems where p.expirationDate ≠ null:
        p.expirationDate ≥ p.createdAt - 30 days
        (allows backdating for items already in pantry)

INV-INV-004: Prepped meal portions remaining cannot exceed original
    ∀ pm ∈ PreppedMeals: pm.portionsRemaining ≤ pm.originalPortions

INV-INV-005: Prepped meal portions must be non-negative
    ∀ pm ∈ PreppedMeals: pm.portionsRemaining ≥ 0

INV-INV-006: Prepped meal recipe reference, when present, must be valid
    ∀ pm ∈ PreppedMeals where pm.recipeId ≠ null: ∃ r ∈ Recipes : r.id = pm.recipeId
    // recipeId is null for DIRECT_ENTRY and STORE_BOUGHT origins.

INV-INV-007: Defrost state consistency with storage location
    ∀ pm ∈ PreppedMeals:
        pm.storageLocation ≠ FREEZER → pm.defrostState ∈ {NOT_APPLICABLE, READY}

INV-INV-008: Defrosting items must have defrost started timestamp
    ∀ pm ∈ PreppedMeals where pm.defrostState = DEFROSTING:
        pm.defrostStartedAt ≠ null

INV-INV-009: Prepped meal expiration must be after preparation date
    ∀ pm ∈ PreppedMeals: pm.expirationDate > pm.preparedDate
```

### 3.4 Planning Invariants

```
INV-PL-001: Meal plan end date must be on or after start date
    ∀ mp ∈ MealPlans: mp.endDate ≥ mp.startDate

INV-PL-002: Planned meal date must be within meal plan range
    ∀ mp ∈ MealPlans, pm ∈ mp.plannedMeals:
        mp.startDate ≤ pm.date ≤ mp.endDate

INV-PL-003: Planned meal must have exactly one source
    ∀ pm ∈ PlannedMeals:
        (pm.source = RECIPE ∧ pm.recipeId ≠ null ∧ pm.preppedMealId = null ∧ pm.storeBoughtName = null ∧ pm.quickMealName = null) ∨
        (pm.source = PREPPED ∧ pm.preppedMealId ≠ null ∧ pm.recipeId = null ∧ pm.storeBoughtName = null ∧ pm.quickMealName = null) ∨
        (pm.source = STORE_BOUGHT ∧ pm.storeBoughtName ≠ null ∧ pm.recipeId = null ∧ pm.preppedMealId = null ∧ pm.quickMealName = null) ∨
        (pm.source = QUICK ∧ pm.quickMealName ≠ null ∧ pm.recipeId = null ∧ pm.preppedMealId = null ∧ pm.storeBoughtName = null)

INV-PL-004: Planned meal servings must be positive
    ∀ pm ∈ PlannedMeals: pm.servings > 0

INV-PL-005: Logged meals must have logged timestamp
    ∀ pm ∈ PlannedMeals where pm.status = LOGGED: pm.loggedAt ≠ null

INV-PL-006: Meal prep session must have at least one recipe
    ∀ mps ∈ MealPrepSessions: |mps.recipes| ≥ 1

INV-PL-007: Meal prep recipe servings must be positive
    ∀ mps ∈ MealPrepSessions, r ∈ mps.recipes: r.servingsToPrep > 0

INV-PL-008: Completed meal prep session must have completion timestamp
    ∀ mps ∈ MealPrepSessions where mps.status = COMPLETED: mps.completedAt ≠ null

INV-PL-009: Planning horizon must be positive
    ∀ mps ∈ MealPrepSessions: mps.planningHorizonDays > 0

INV-PL-010: Meal reminder time must be valid
    ∀ mr ∈ MealReminders: 00:00 ≤ mr.reminderTime ≤ 23:59

INV-PL-011: Enabled reminder must have at least one day selected
    ∀ mr ∈ MealReminders where mr.isEnabled = true: |mr.daysOfWeek| ≥ 1

INV-PL-012: Planned meal sort order is unique within a (date, slot) group
    ∀ mp ∈ MealPlans, pm1, pm2 ∈ mp.plannedMeals where
        pm1.id ≠ pm2.id ∧ pm1.date = pm2.date ∧ pm1.mealSlot = pm2.mealSlot:
            pm1.sortOrder ≠ pm2.sortOrder
    // Unslotted meals (mealSlot = null) form their own group per date.
    // A (date, slot) group may hold any number of planned meals.

INV-PL-013: Meal schedule rule must have exactly one source
    ∀ msr ∈ MealScheduleRules:
        (msr.source = RECIPE ∧ msr.recipeId ≠ null ∧ msr.storeBoughtName = null ∧ msr.quickMealName = null) ∨
        (msr.source = STORE_BOUGHT ∧ msr.storeBoughtName ≠ null ∧ msr.recipeId = null ∧ msr.quickMealName = null) ∨
        (msr.source = QUICK ∧ msr.quickMealName ≠ null ∧ msr.recipeId = null ∧ msr.storeBoughtName = null)

INV-PL-014: Enabled meal schedule rule must have at least one day selected
    ∀ msr ∈ MealScheduleRules where msr.isEnabled = true: |msr.daysOfWeek| ≥ 1

INV-PL-015: Meal schedule rule effective range must be valid
    ∀ msr ∈ MealScheduleRules where msr.effectiveFrom ≠ null ∧ msr.effectiveTo ≠ null:
        msr.effectiveTo ≥ msr.effectiveFrom

INV-PL-016: Meal suggestion feedback must reference exactly one target
    ∀ f ∈ MealSuggestionFeedback:
        (f.target = RECIPE ∧ f.recipeId ≠ null ∧ f.preppedMealId = null ∧ f.quickMealName = null) ∨
        (f.target = PREPPED ∧ f.preppedMealId ≠ null ∧ f.recipeId = null ∧ f.quickMealName = null) ∨
        (f.target = QUICK ∧ f.quickMealName ≠ null ∧ f.recipeId = null ∧ f.preppedMealId = null)

INV-PL-017: Fulfillment state is derived, never stored
    The HAVE_IT / CAN_MAKE_IT / MUST_ACQUIRE state of a PlannedMeal is always
    computed from current inventory and the plan; it is never persisted.
```

### 3.5 Shopping Invariants

```
INV-SH-001: Shopping list must have at least one item when active
    ∀ sl ∈ ShoppingLists where sl.status = ACTIVE: |sl.items| ≥ 1

INV-SH-002: Item quantity must be positive
    ∀ sl ∈ ShoppingLists, i ∈ sl.items: i.quantity > 0

INV-SH-003: Checked items must have checked timestamp
    ∀ i ∈ ShoppingListItems where i.status = CHECKED: i.checkedAt ≠ null

INV-SH-004: Completed list must have completion timestamp
    ∀ sl ∈ ShoppingLists where sl.status = COMPLETED: sl.completedAt ≠ null

INV-SH-005: Store section sort orders must be unique within layout
    ∀ sl ∈ StoreLayouts: ∀ s1, s2 ∈ sl.sections: s1.id ≠ s2.id → s1.sortOrder ≠ s2.sortOrder

INV-SH-006: Only one default store layout per user
    ∀ u ∈ Users: |{sl ∈ StoreLayouts : sl.userId = u.id ∧ sl.isDefault = true}| ≤ 1

INV-SH-007: Assigned user must be household member if list is shared
    ∀ sl ∈ ShoppingLists, i ∈ sl.items
        where sl.householdId ≠ null ∧ i.assignedToUserId ≠ null:
        ∃ m ∈ HouseholdMembers : m.householdId = sl.householdId ∧ m.userId = i.assignedToUserId
```

### 3.6 Nutrition Invariants

```
INV-NT-001: Nutrition values must be non-negative
    ∀ n ∈ NutritionInfo:
        n.calories ≥ 0 ∧ n.proteinGrams ≥ 0 ∧ n.carbsGrams ≥ 0 ∧ n.fatGrams ≥ 0

INV-NT-002: Nutrition goals must be positive if set
    ∀ ng ∈ NutritionGoals:
        (ng.dailyCalories = null ∨ ng.dailyCalories > 0) ∧
        (ng.dailyProteinGrams = null ∨ ng.dailyProteinGrams > 0) ∧
        (ng.dailyCarbsGrams = null ∨ ng.dailyCarbsGrams > 0) ∧
        (ng.dailyFatGrams = null ∨ ng.dailyFatGrams > 0)

INV-NT-003: Goal effective period must be valid
    ∀ ng ∈ NutritionGoals where ng.effectiveTo ≠ null:
        ng.effectiveTo ≥ ng.effectiveFrom

INV-NT-004: Only one active goal per user at a time
    ∀ u ∈ Users, d ∈ Dates:
        |{ng ∈ NutritionGoals : ng.userId = u.id ∧ ng.effectiveFrom ≤ d ∧
            (ng.effectiveTo = null ∨ ng.effectiveTo ≥ d)}| ≤ 1
```

### 3.7 Variety Invariants

```
INV-VR-001: Food hyperfixation end date must be after start date if set
    ∀ fh ∈ FoodHyperfixations where fh.endedAt ≠ null:
        fh.endedAt > fh.startedAt

INV-VR-002: Active hyperfixation must not have end date
    ∀ fh ∈ FoodHyperfixations where fh.isActive = true: fh.endedAt = null

INV-VR-003: Ended hyperfixation must not be active
    ∀ fh ∈ FoodHyperfixations where fh.endedAt ≠ null: fh.isActive = false

INV-VR-004: Hyperfixation occurrence count must be positive
    ∀ fh ∈ FoodHyperfixations: fh.occurrenceCount > 0

INV-VR-005: Chain suggestion must not suggest same food
    ∀ cs ∈ ChainSuggestions: cs.currentFoodName ≠ cs.suggestedFoodName

INV-VR-006: Tried suggestions must have liked feedback
    ∀ cs ∈ ChainSuggestions where cs.status = TRIED: cs.wasLiked ≠ null
```

### 3.8 Cross-Domain Invariants

```
INV-XD-001: Meal log from plan must reference valid planned meal
    ∀ ml ∈ MealLogs where ml.logType = FROM_PLAN:
        ml.plannedMealId ≠ null ∧ ∃ pm ∈ PlannedMeals : pm.id = ml.plannedMealId

INV-XD-002: Meal log from prepped must reference valid prepped meal
    ∀ ml ∈ MealLogs where ml.logType = FROM_PREPPED:
        ml.preppedMealId ≠ null ∧ ∃ pm ∈ PreppedMeals : pm.id = ml.preppedMealId

INV-XD-003: Consuming prepped meal decrements portions
    When meal logged from prepped meal:
        preppedMeal.portionsRemaining = preppedMeal.portionsRemaining - mealLog.servings
        (enforced via domain event, not structural invariant)

INV-XD-004: Shopping list from prep references valid session
    ∀ sl ∈ ShoppingLists where sl.sourceType = FROM_PREP:
        sl.mealPrepSessionId ≠ null ∧ ∃ mps ∈ MealPrepSessions : mps.id = sl.mealPrepSessionId

INV-XD-005: Planned meal from prepped must reference valid prepped meal with portions
    ∀ pm ∈ PlannedMeals where pm.source = PREPPED:
        ∃ prm ∈ PreppedMeals : prm.id = pm.preppedMealId ∧ prm.portionsRemaining > 0

INV-XD-006: Household resources accessible only to members
    ∀ resource ∈ {Recipes, PantryItems, PreppedMeals, MealPlans, ShoppingLists}
        where resource.householdId ≠ null:
        Only users in household can access resource
        (enforced via authorization, not structural invariant)
```

---

## 4. UI Flows

### 4.1 Onboarding Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      ONBOARDING FLOW                        │
└─────────────────────────────────────────────────────────────┘

[App Launch - First Time]
        │
        ▼
┌─────────────────┐
│  Welcome Screen │ "Your personal meal companion"
│                 │ [Get Started] button
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Account Setup   │ Email + Password
│                 │ (or skip for local-only mode)
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   BASIC PREFERENCES                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  "How many meals do you typically eat per day?"             │
│  [1] [2] [3] [4] [5+]                                      │
│                                                             │
│  "What's your usual household size for meals?"              │
│  [Just me] [2] [3-4] [5+]                                  │
│                                                             │
│  "Any dietary needs?"                                       │
│  □ Vegetarian  □ Vegan  □ Gluten-free                      │
│  □ Dairy-free  □ Allergies: ________                       │
│                                                             │
│  [Continue]                                                 │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              PERSONALIZE YOUR EXPERIENCE                    │
│  (Persona-based, no condition labels)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  "Check any that sound like you"                           │
│                                                             │
│  □ "I sometimes forget to eat when I'm busy"               │
│     → Enables: Meal reminders setup                        │
│                                                             │
│  □ "I work better with visual cues and photos"             │
│     → Enables: Visual pantry, photo shopping lists         │
│                                                             │
│  □ "I tend to eat the same foods for a while"              │
│     → Enables: Variety tracking, gentle suggestions        │
│                                                             │
│  □ "Too many choices can feel overwhelming"                │
│     → Enables: Simplified suggestions, smart defaults      │
│                                                             │
│  (All optional - these just set your starting defaults)   │
│                                                             │
│  [Continue]                              [Skip for now]    │
└────────┬────────────────────────────────────────────────────┘
         │
         │ [If "forget to eat" selected]
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    SET UP REMINDERS                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  "When would you like gentle nudges?"                      │
│                                                             │
│  ☑ Breakfast    [8:00 AM ▼]                                │
│  ☑ Lunch        [12:30 PM ▼]                               │
│  ☑ Dinner       [6:30 PM ▼]                                │
│  □ Snacks       [3:00 PM ▼]                                │
│                                                             │
│  "You can adjust these anytime in Settings"                │
│                                                             │
│  [Set Reminders]                         [Maybe later]     │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Setup Complete  │ "You're all set!"
│                 │ "Adjust any of this in Settings"
│                 │ [Start Planning] [Explore First]
└────────┬────────┘
         │
         ▼
    [Home Screen]
```

### 4.2 Home Screen Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       HOME SCREEN                           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐   │
│  │            TODAY'S OVERVIEW                          │   │
│  │  ──────────────────────────────────────────────────  │   │
│  │  [Morning greeting based on time]                    │   │
│  │  "Good morning! Here's your day."                    │   │
│  │                                                       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                │   │
│  │  │Breakfast│ │  Lunch  │ │ Dinner  │  ← Today's     │   │
│  │  │ ✓ Eaten │ │ Planned │ │ Planned │    meals       │   │
│  │  │ Oatmeal │ │ Chili   │ │ Tacos   │                │   │
│  │  └─────────┘ └─────────┘ └─────────┘                │   │
│  │                                                       │   │
│  │  [Quick Log Button] "Log a meal"                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            QUICK ACTIONS                             │   │
│  │  ──────────────────────────────────────────────────  │   │
│  │  ┌──────────────┐  ┌──────────────┐                 │   │
│  │  │ 📅 Plan Week │  │ 🛒 Shopping  │                 │   │
│  │  └──────────────┘  └──────────────┘                 │   │
│  │  ┌──────────────┐  ┌──────────────┐                 │   │
│  │  │ 🍳 Meal Prep │  │ 📖 Recipes   │                 │   │
│  │  └──────────────┘  └──────────────┘                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            ATTENTION NEEDED (if any)                 │   │
│  │  ──────────────────────────────────────────────────  │   │
│  │  ⚠️ 3 prepped meals expiring soon                   │   │
│  │  ⚠️ Milk running low                                │   │
│  │  [View All]                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [─────] [Home] [Plan] [Recipes] [Pantry] [─────]   │   │
│  │          Bottom Navigation                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Meal Planning Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MEAL PLANNING FLOW                       │
└─────────────────────────────────────────────────────────────┘

[Tap "Plan Week" or navigate to Plan tab]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    MEAL PLAN CALENDAR                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  < Dec 23-29, 2025 >    [Today] [Generate Plan]     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Mon 23  │  Tue 24  │  Wed 25  │  Thu 26  │ ...    │   │
│  ├──────────┼──────────┼──────────┼──────────┼─────────┤   │
│  │ 🍳       │ 🍳       │ 🍳       │ 🍳       │         │   │
│  │ Oatmeal  │ Eggs     │  (empty) │ Smoothie │         │   │
│  ├──────────┼──────────┼──────────┼──────────┼─────────┤   │
│  │ 🥗       │ 🥗       │ 🥗       │ 🥗       │         │   │
│  │ [Chili]  │ Salad    │  (empty) │ [Soup]   │         │   │
│  │ *prepped │          │          │ *prepped │         │   │
│  ├──────────┼──────────┼──────────┼──────────┼─────────┤   │
│  │ 🍽️       │ 🍽️       │ 🍽️       │ 🍽️       │         │   │
│  │ Tacos    │ Pasta    │  (empty) │ Stir Fry │         │   │
│  └──────────┴──────────┴──────────┴──────────┴─────────┘   │
│                                                             │
│  Legend: [bracketed] = prepped meal, *prepped = from prep  │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Tap a slot to add a meal]
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  ADD MEAL TO SLOT                           │
│  ────────────────────────────────────────────────────────   │
│  Wednesday, Dec 25 - Lunch                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔍 Search recipes...                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  FROM PREPPED MEALS                                  │   │
│  │  ────────────────────                               │   │
│  │  🥣 Chili (4 portions) - expires Dec 27 ⚠️          │   │
│  │  🍲 Soup (6 portions) - expires Dec 30              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  SUGGESTIONS (based on pantry)                       │   │
│  │  ────────────────────                               │   │
│  │  🥪 Grilled Cheese - 15 min                         │   │
│  │  🍳 Eggs & Toast - 10 min                           │   │
│  │  🥗 Caesar Salad - 20 min                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  FAVORITES                                           │   │
│  │  ────────────────────                               │   │
│  │  ⭐ Chicken Stir Fry                                │   │
│  │  ⭐ Spaghetti Bolognese                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Quick Option: "Takeout"] [Quick Option: "Leftovers"]     │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Tap "Generate Plan"]
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  PLAN GENERATION OPTIONS                    │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  "Let's set up your meal plan"                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Date Range                                          │   │
│  │  [Dec 23] to [Dec 29]                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Prepped Meal Preference                             │   │
│  │  ─────────────────────────                          │   │
│  │  You have 10 prepped portions available:            │   │
│  │    🥣 Chili (4) - exp Dec 27 ⚠️                     │   │
│  │    🍲 Soup (6) - exp Dec 30                         │   │
│  │                                                      │   │
│  │  ( ) Use prepped meals first                        │   │
│  │  ( ) Prefer fresh cooking                           │   │
│  │  (•) Mix it up (no preference)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Cancel]                              [Generate Plan]      │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  REVIEW GENERATED PLAN                      │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  [Calendar view with generated meals filled in]            │
│                                                             │
│  "Here's your plan! Tap any meal to swap it."              │
│                                                             │
│  [Regenerate]    [Accept Plan]    [Edit Manually]          │
└─────────────────────────────────────────────────────────────┘
```

> **Planning model note.** The calendar grid presents an underlying ordered list per `(date, mealSlot)`, not a fixed one-cell-per-slot grid. Any band (Breakfast / Lunch / Dinner / Snack) may hold more than one meal, and a meal may be left unslotted ("Anytime", `mealSlot = null`). Ordering within a group is by `sortOrder`; "usually one dinner" is a soft UI default, never a constraint.

### 4.4 Meal Prep Session Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   MEAL PREP SESSION FLOW                    │
└─────────────────────────────────────────────────────────────┘

[Tap "Meal Prep" from home or menu]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                   MEAL PREP HOME                            │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  CURRENT PREPPED INVENTORY                           │   │
│  │  ─────────────────────────                          │   │
│  │  🥣 Chili - 4 portions (fridge, exp Dec 27) ⚠️      │   │
│  │  🍲 Vegetable Soup - 6 portions (freezer, exp Jan 15)│   │
│  │  🍝 Pasta Sauce - 3 portions (freezer, exp Jan 20)  │   │
│  │                                                      │   │
│  │  Total: 13 portions (~3 days of meals)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [+ Start New Prep Session]                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PAST SESSIONS                                       │   │
│  │  ─────────────────────────                          │   │
│  │  Dec 21 - Made Chili, Soup (10 portions)            │   │
│  │  Dec 14 - Made Pasta Sauce (8 portions)             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Tap "Start New Prep Session"]
        ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 1: SELECT RECIPES                         │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  "What do you want to prep?"                               │
│                                                             │
│  🔍 Search recipes...                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  GOOD FOR MEAL PREP (batch-friendly)                 │   │
│  │  ─────────────────────────                          │   │
│  │  □ 🍲 Chicken Curry        ~45 min, serves 6        │   │
│  │  □ 🥗 Greek Salad Jars     ~30 min, serves 5        │   │
│  │  □ 🌯 Burrito Bowls        ~60 min, serves 8        │   │
│  │  ☑ 🍝 Marinara Sauce       ~40 min, serves 10       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  FAVORITES                                           │   │
│  │  ─────────────────────────                          │   │
│  │  □ ⭐ Beef Stew            ~90 min, serves 8        │   │
│  │  ☑ ⭐ Black Bean Soup      ~45 min, serves 6        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Selected: 2 recipes                                       │
│  [Back]                                         [Next →]    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 2: SET QUANTITIES                         │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  "How many servings of each?"                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🍝 Marinara Sauce                                   │   │
│  │  Recipe makes: 10 servings                          │   │
│  │                                                      │   │
│  │  Servings to prep: [-] 8 [+]                        │   │
│  │  Store in: (•) Freezer  ( ) Fridge                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🍲 Black Bean Soup                                  │   │
│  │  Recipe makes: 6 servings                           │   │
│  │                                                      │   │
│  │  Servings to prep: [-] 12 [+]  (2x recipe)          │   │
│  │  Store in: ( ) Freezer  (•) Fridge                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  SUMMARY                                                   │
│  Total new portions: 20                                    │
│  + Existing inventory: 13                                  │
│  = Total available: 33 portions                            │
│                                                             │
│  At 4 meals/day, that's ~8 days of meals                   │
│                                                             │
│  [← Back]                                       [Next →]    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 3: SCHEDULE & PLAN                        │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  "When will you prep?"                                     │
│                                                             │
│  Prep Day: [Sunday, Dec 28 ▼]                              │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  "Want me to create a meal plan using these preps?"        │
│                                                             │
│  Planning horizon: [8 days] (suggested based on portions)  │
│                                                             │
│  (•) Yes, create a meal plan                               │
│  ( ) No, just track the prepped meals                      │
│                                                             │
│  [← Back]                                       [Next →]    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 4: SHOPPING LIST                          │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  "Here's what you need to buy"                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  NEED TO BUY (not in pantry)                         │   │
│  │  ─────────────────────────                          │   │
│  │  □ Crushed tomatoes (2 cans) - Marinara, Soup       │   │
│  │  □ Black beans (3 cans) - Soup                      │   │
│  │  □ Onions (4) - Marinara, Soup                      │   │
│  │  □ Garlic (1 head) - Marinara, Soup                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ALREADY HAVE (in pantry)                            │   │
│  │  ─────────────────────────                          │   │
│  │  ✓ Olive oil - enough                               │   │
│  │  ✓ Vegetable broth - 2 cartons                      │   │
│  │  ✓ Cumin - plenty                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [← Back]    [Skip Shopping]           [Create List →]     │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 5: REVIEW & CONFIRM                       │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  PREP SESSION SUMMARY                                      │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  📅 Prep Day: Sunday, Dec 28                               │
│                                                             │
│  📝 Recipes:                                               │
│     • Marinara Sauce (8 portions → freezer)                │
│     • Black Bean Soup (12 portions → fridge)               │
│                                                             │
│  ⏱️ Estimated Time: ~1.5 hours                              │
│                                                             │
│  🛒 Shopping List: 4 items created                         │
│                                                             │
│  📅 Meal Plan: 8 days created (Dec 28 - Jan 4)             │
│                                                             │
│  [← Back]                              [Confirm Session]    │
└─────────────────────────────────────────────────────────────┘
        │
        │ [After prep day, user marks session complete]
        ▼
┌─────────────────────────────────────────────────────────────┐
│              COMPLETE PREP SESSION                          │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  "How did prep go?"                                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🍝 Marinara Sauce                                   │   │
│  │  Planned: 8 portions                                │   │
│  │  Actually made: [-] 8 [+]    ✓ Done                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🍲 Black Bean Soup                                  │   │
│  │  Planned: 12 portions                               │   │
│  │  Actually made: [-] 10 [+]   ✓ Done                 │   │
│  │  (adjusted - made a bit less)                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Cancel]                          [Complete & Add to      │
│                                     Inventory]             │
└─────────────────────────────────────────────────────────────┘
```

### 4.5 Recipe Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   RECIPE MANAGEMENT FLOW                    │
└─────────────────────────────────────────────────────────────┘

[Navigate to Recipes tab]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    RECIPE LIBRARY                           │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  🔍 Search recipes...              [Filter] [+ Add]        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  FILTER BAR (scrollable)                             │   │
│  │  [All] [Favorites ⭐] [Quick <30min]                 │   │
│  │  [Breakfast] [Lunch] [Dinner] [Vegetarian] ...      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ [Image]      │  │ [Image]      │  │ [Image]      │     │
│  │ Chicken Curry│  │ Pasta Primav │  │ Beef Tacos   │     │
│  │ ⭐ 45min 🔥3 │  │    30min 🔥2 │  │ ⭐ 25min 🔥2 │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ [Image]      │  │ [Image]      │  │ [Image]      │     │
│  │ Greek Salad  │  │ Tomato Soup  │  │ Stir Fry     │     │
│  │    15min     │  │    40min     │  │    20min     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Tap recipe card]
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    RECIPE DETAIL                            │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  [← Back]                    [⭐ Favorite] [Edit] [...]    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   [Recipe Image]                     │   │
│  │                                                      │   │
│  │  Chicken Curry                                       │   │
│  │  ⭐⭐⭐⭐☆ (4.2) · 45 min · Serves 6                │   │
│  │                                                      │   │
│  │  Tags: Dinner, Indian, Gluten-Free, Meal-Prep       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Tab: Ingredients] [Tab: Instructions] [Tab: Nutrition]   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  INGREDIENTS (6 servings)    [Scale: 4 6 8 12]      │   │
│  │  ─────────────────────────                          │   │
│  │  □ 2 lbs chicken thighs, cubed                      │   │
│  │  □ 1 can coconut milk                               │   │
│  │  □ 2 tbsp curry powder                              │   │
│  │  □ 1 onion, diced                                   │   │
│  │  □ 3 cloves garlic, minced                          │   │
│  │  □ 1 inch ginger, grated                            │   │
│  │  □ Salt and pepper to taste                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [🍳 Start Cooking]  [📅 Add to Plan]  [🛒 Shop]    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Tap "+ Add" to add new recipe]
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    ADD RECIPE OPTIONS                       │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  "How would you like to add a recipe?"                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📝 Create from scratch                              │   │
│  │     Type in your recipe manually                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🔗 Import from URL                                  │   │
│  │     Paste a link to a recipe website                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📷 Scan from photo                                  │   │
│  │     Take a photo of a recipe card or book           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Cancel]                                                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.6 Cooking Mode Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     COOKING MODE FLOW                       │
└─────────────────────────────────────────────────────────────┘

[Tap "Start Cooking" from recipe detail]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              COOKING MODE - PREP CHECKLIST                  │
│  ────────────────────────────────────────────────────────   │
│  (Large touch targets, screen stays awake)                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  CHICKEN CURRY                                       │   │
│  │  Gather your ingredients                            │   │
│  │  ────────────────────────────────────               │   │
│  │                                                      │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ □  2 lbs chicken thighs                     │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ ☑  1 can coconut milk                       │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ □  2 tbsp curry powder                      │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │  ... (large tappable checkboxes)                    │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Progress: ████████░░░░░░░░ 3/7 ingredients               │
│                                                             │
│  [Exit]                                    [Start Cooking →]│
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              COOKING MODE - STEP VIEW                       │
│  ────────────────────────────────────────────────────────   │
│  (Optimized for kitchen - large text, minimal UI)          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  STEP 2 of 6                                        │   │
│  │  ════════════════════════════════════════════════   │   │
│  │                                                      │   │
│  │  Heat oil in a large pan over                       │   │
│  │  medium-high heat. Add the                          │   │
│  │  chicken pieces and cook until                      │   │
│  │  browned on all sides.                              │   │
│  │                                                      │   │
│  │            ~8 minutes                               │   │
│  │                                                      │   │
│  │         [🔔 Set 8 min Timer]                        │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [Need simpler steps?]  ← AI breakdown option          │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────┐              ┌────────────────────────┐   │
│  │  [← Prev]  │              │  [Mark Done & Next →]  │   │
│  │            │              │                        │   │
│  └────────────┘              └────────────────────────┘   │
│                                                             │
│  Progress: ████████████░░░░ Step 2/6                       │
│                                                             │
│  [Active Timers: 🔔 Brown chicken 5:32]                    │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Tap "Need simpler steps?"]
        ▼
┌─────────────────────────────────────────────────────────────┐
│              COOKING MODE - AI BREAKDOWN                    │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  STEP 2 - BROKEN DOWN                               │   │
│  │  ════════════════════════════════════════════════   │   │
│  │                                                      │   │
│  │  2a. Add 2 tablespoons of oil to your               │   │
│  │      large pan                                      │   │
│  │                           [□ Done]                  │   │
│  │                                                      │   │
│  │  2b. Turn heat to medium-high                       │   │
│  │      (dial to 7-8 out of 10)                        │   │
│  │                           [□ Done]                  │   │
│  │                                                      │   │
│  │  2c. Wait 1-2 minutes until oil                     │   │
│  │      shimmers (not smoking!)                        │   │
│  │                           [□ Done]                  │   │
│  │                                                      │   │
│  │  2d. Add chicken pieces in single layer             │   │
│  │      (don't crowd the pan)                          │   │
│  │                           [□ Done]                  │   │
│  │                                                      │   │
│  │  2e. Let chicken sit 3-4 minutes                    │   │
│  │      until bottom is golden                         │   │
│  │         [🔔 Set 3 min Timer]                        │   │
│  │                           [□ Done]                  │   │
│  │                                                      │   │
│  │  2f. Flip and repeat on other side                  │   │
│  │         [🔔 Set 3 min Timer]                        │   │
│  │                           [□ Done]                  │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [← Back to Simple View]               [All Done → Next]   │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Complete all steps]
        ▼
┌─────────────────────────────────────────────────────────────┐
│              COOKING COMPLETE                               │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  🎉 Nice work!                                             │
│                                                             │
│  You made Chicken Curry                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  How did it go?                                      │   │
│  │                                                      │   │
│  │  ⭐ ⭐ ⭐ ⭐ ⭐   (optional rating)                 │   │
│  │                                                      │   │
│  │  Notes: ___________________  (optional)             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  □ Log this meal now                                │   │
│  │  □ Add leftovers to inventory                       │   │
│  │    Portions: [-] 4 [+]                              │   │
│  │    Store in: (•) Fridge  ( ) Freezer               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Skip]                                     [Done]          │
└─────────────────────────────────────────────────────────────┘
```

### 4.7 Shopping Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      SHOPPING FLOW                          │
└─────────────────────────────────────────────────────────────┘

[Navigate to Shopping or tap from home]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    SHOPPING LISTS                           │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ACTIVE LIST                                         │   │
│  │  Weekly Shopping · 12 items                         │   │
│  │  ████████████░░░░░░░░ 7/12 checked                  │   │
│  │  [Continue Shopping]                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [+ Create New List]                                       │
│  [📅 Generate from Meal Plan]                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  RECENT LISTS                                        │   │
│  │  ─────────────────────────                          │   │
│  │  Dec 18 - Completed · 15 items                      │   │
│  │  Dec 11 - Completed · 8 items                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Tap "Continue Shopping" or open list]
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    SHOPPING LIST VIEW                       │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  [← Back]   Weekly Shopping   [Store: Kroger ▼] [+ Add]    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🥬 PRODUCE                                          │   │
│  │  ─────────────────────────                          │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ □ Onions (4)              [photo]           │   │   │
│  │  │   For: Marinara, Soup                       │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ ☑ Garlic (1 head)         [photo]           │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ □ Carrots (1 lb)          [photo]           │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🥫 CANNED GOODS                                     │   │
│  │  ─────────────────────────                          │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ □ Crushed tomatoes (2)    [photo]           │   │   │
│  │  │   For: Marinara, Soup                       │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │ □ Black beans (3)         [photo]           │   │   │
│  │  │   For: Soup                                 │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ✓ CHECKED (5 items)                    [collapse]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Complete Shopping - Add to Pantry]                       │
└─────────────────────────────────────────────────────────────┘
```

### 4.8 Meal Logging Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MEAL LOGGING FLOW                        │
└─────────────────────────────────────────────────────────────┘

[From reminder notification, home screen, or quick action]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    QUICK LOG OPTIONS                        │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  "Log your meal"                                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  TODAY'S PLAN (if planned)                           │   │
│  │  ─────────────────────────                          │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │ 🍲 Chicken Curry (from plan)     [Log This]   │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PREPPED MEALS READY                                │   │
│  │  ─────────────────────────                          │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │ 🥣 Chili (4 left, exp Dec 27)    [Log This]   │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  │  ┌───────────────────────────────────────────────┐ │   │
│  │  │ 🍲 Soup (6 left, exp Dec 30)     [Log This]   │ │   │
│  │  └───────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  RECENT / FAVORITES                                  │   │
│  │  ─────────────────────────                          │   │
│  │  ⭐ Oatmeal                          [Log This]     │   │
│  │  🔄 Eggs & Toast (yesterday)         [Log This]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  QUICK OPTIONS                                       │   │
│  │  ─────────────────────────                          │   │
│  │  [🍕 Takeout]  [🍱 Leftovers]  [✓ Something else]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Browse Recipes]                              [Cancel]     │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Tap any "Log This" option]
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOG DETAILS (Optional)                   │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  Logging: Chicken Curry                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Servings: [-] 1 [+]                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  How was it? (optional)                             │   │
│  │                                                     │   │
│  │  [ Hated ]  [ OK ]  [ Liked ]  [ Loved ]            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Notes (optional): _______________________          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Skip Details]                              [Log Meal]    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOGGED CONFIRMATION                      │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│          ✓ Meal logged!                                    │
│                                                             │
│     (Brief toast notification, returns to previous screen) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.9 Pantry Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   PANTRY MANAGEMENT FLOW                    │
└─────────────────────────────────────────────────────────────┘

[Navigate to Pantry tab]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    PANTRY OVERVIEW                          │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  🔍 Search pantry...                          [+ Add]      │
│                                                             │
│  [Tab: All] [Tab: Fridge] [Tab: Freezer] [Tab: Pantry]    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ⚠️ EXPIRING SOON                                   │   │
│  │  ─────────────────────────                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ [photo]  │  │ [photo]  │  │ [photo]  │          │   │
│  │  │ Milk     │  │ Yogurt   │  │ Spinach  │          │   │
│  │  │ exp 12/26│  │ exp 12/27│  │ exp 12/26│          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🚨 RUNNING LOW                                      │   │
│  │  ─────────────────────────                          │   │
│  │  Eggs (2 left), Bread (3 slices), Butter            │   │
│  │  [Add to Shopping List]                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📷 VISUAL INVENTORY                                │   │
│  │  ─────────────────────────                          │   │
│  │  (Grid of pantry item photos, tappable)             │   │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │   │
│  │  │     │ │     │ │     │ │     │ │     │          │   │
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘          │   │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │   │
│  │  │     │ │     │ │     │ │     │ │ +   │          │   │
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Tap "+ Add"]
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    ADD PANTRY ITEM                          │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  "Add to your pantry"                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [📷 Take Photo]  [🔍 Scan Barcode]  [✏️ Manual]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Item name: [Chicken Breast____________]                   │
│                                                             │
│  Quantity: [-] 2 [+]   Unit: [lbs ▼]                       │
│                                                             │
│  Location: (•) Fridge  ( ) Freezer  ( ) Pantry             │
│                                                             │
│  Expiration: [Dec 28, 2025]  (suggested based on item)     │
│                                                             │
│  Minimum quantity alert: [_____] (optional)                │
│                                                             │
│  [Cancel]                                      [Add Item]  │
└─────────────────────────────────────────────────────────────┘
```

### 4.10 Settings Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      SETTINGS FLOW                          │
└─────────────────────────────────────────────────────────────┘

[Tap profile/settings icon]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                       SETTINGS                              │
│  ────────────────────────────────────────────────────────   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ACCOUNT                                             │   │
│  │  ─────────────────────────                          │   │
│  │  Profile                                    [→]     │   │
│  │  Household                                  [→]     │   │
│  │  Account & Data                             [→]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PREFERENCES                                         │   │
│  │  ─────────────────────────                          │   │
│  │  Meals per day                              [3]     │   │
│  │  Default servings                           [2]     │   │
│  │  Measurement system                    [Metric]     │   │
│  │  Theme                                  [System]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  SMART SUGGESTIONS (always-on enhancements)          │   │
│  │  ─────────────────────────                          │   │
│  │  Rating-aware suggestions                  [ON]     │   │
│  │  Expiration-aware suggestions              [ON]     │   │
│  │  Prepped meal suggestions                  [ON]     │   │
│  │  Remember my preferences                   [ON]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  TRACKING FEATURES (opt-in)                          │   │
│  │  ─────────────────────────                          │   │
│  │  Meal reminders                             [→]     │   │
│  │  Nutrition tracking                       [OFF]     │   │
│  │  Food variety awareness                   [OFF]     │   │
│  │  Suggest similar new foods                [OFF]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  DIETARY                                             │   │
│  │  ─────────────────────────                          │   │
│  │  Dietary preferences                        [→]     │   │
│  │  Allergies & restrictions                   [→]     │   │
│  │  Disliked ingredients                       [→]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  SHOPPING                                            │   │
│  │  ─────────────────────────                          │   │
│  │  Store layouts                              [→]     │   │
│  │  Default store                         [Kroger]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  DATA                                                │   │
│  │  ─────────────────────────                          │   │
│  │  Export data                                [→]     │   │
│  │  Import data                                [→]     │   │
│  │  Clear all data                             [→]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ABOUT                                               │   │
│  │  ─────────────────────────                          │   │
│  │  Version                                  [1.0.0]   │   │
│  │  Licenses                                   [→]     │   │
│  │  Privacy Policy                             [→]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Log Out]                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

### 4.11 Add Prepped Meal Directly

Adding an existing ready-to-eat portion never requires a prep session (REQ-PP-032). A session is one optional way to produce portions in bulk; direct entry is the primary path.

```
┌─────────────────────────────────────────────────────────────┐
│               ADD PREPPED MEAL (DIRECT ENTRY)               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PREPPED INVENTORY                                          │
│  ───────────────────────────────────────────────────────    │
│  Chili            4 portions   fridge    exp Dec 27         │
│  Vegetable Soup   6 portions   freezer   exp Jan 15         │
│                                                             │
│  Total: 10 portions  (~2 days of meals)                     │
│                                                             │
│  [+ Add a prepped meal I already have]   <-- direct         │
│  [+ Start a prep session]                (optional)         │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Tap "+ Add a prepped meal I already have"]
        ▼
┌─────────────────────────────────────────────────────────────┐
│  ADD A PREPPED MEAL   (no prep session needed)              │
│  ───────────────────────────────────────────────────────    │
│  What do you have?                                          │
│                                                             │
│  Name:        [ Chili                          ]            │
│                                                             │
│  I:           (•) made it      ( ) bought it                │
│               => origin DIRECT_ENTRY / STORE_BOUGHT         │
│                                                             │
│  From a recipe?  [ link a recipe... ]  (optional)           │
│                                                             │
│  Portions:    [-]  4  [+]                                   │
│  On:          [ today        ]   (made / bought)            │
│  Store in:    (•) Fridge    ( ) Freezer                     │
│  Use within:  [ 4 days ]   (auto from storage; edit)        │
│                                                             │
│  [Cancel]                                   [Save]          │
└─────────────────────────────────────────────────────────────┘
        │
        │ [Save]
        ▼
┌─────────────────────────────────────────────────────────────┐
│  PREPPED INVENTORY   (updated)                              │
│  ───────────────────────────────────────────────────────    │
│  Chili            4 portions   fridge    exp Dec 27         │
│  Vegetable Soup   6 portions   freezer   exp Jan 15         │
│                                                             │
│  Saved with no session. It is now ready-to-eat              │
│  inventory and reads as "have it" wherever you              │
│  place it on a day.                                         │
└─────────────────────────────────────────────────────────────┘
```

Notes:
- Direct entry creates a `PreppedMeal` with `origin = DIRECT_ENTRY` ("made it") or `STORE_BOUGHT` ("bought it"); a recipe link is optional (REQ-PP-032, REQ-PP-033).
- No `MealPrepSession` is created or required.
- Once saved, the portion is ready-to-eat inventory: placing it on a day reads as the `HAVE_IT` fulfillment state (see the Differentiator).

---

## 5. State Machines

### 5.1 Meal Prep Session State Machine

```
                            ┌──────────────┐
                            │   PLANNING   │
                            │              │
                            │ User adding  │
                            │ recipes      │
                            └──────┬───────┘
                                   │
                          [Set prep date]
                                   │
                                   ▼
                            ┌──────────────┐
            ┌──────────────►│  SCHEDULED   │
            │               │              │
            │               │ Prep date    │
            │               │ is set       │
     [User cancels]         └──────┬───────┘
            │                      │
            │             [Shopping complete
            │              or skipped]
            │                      │
            │                      ▼
            │               ┌──────────────┐
            ├──────────────►│    READY     │
            │               │              │
            │               │ Ready to     │
            │               │ start prep   │
            │               └──────┬───────┘
            │                      │
            │              [User starts
            │               cooking]
            │                      │
            │                      ▼
            │               ┌──────────────┐
            ├──────────────►│ IN_PROGRESS  │
            │               │              │
            │               │ Actively     │
            │               │ prepping     │
            │               └──────┬───────┘
            │                      │
            │              [User marks
            │               complete]
            │                      │
            │                      ▼
┌───────────┴──┐            ┌──────────────┐
│  CANCELLED   │            │  COMPLETED   │
│              │            │              │
│ User chose   │            │ Meals added  │
│ not to prep  │            │ to inventory │
└──────────────┘            └──────────────┘
```

### 5.2 Prepped Meal Defrost State Machine

```
                     ┌─────────────────────┐
                     │   NOT_APPLICABLE    │
                     │                     │
                     │ Item stored in      │
                     │ fridge or pantry    │
                     └─────────────────────┘
                               ▲
                               │
                    [Move to fridge/pantry]
                               │
┌─────────────────────────────────────────────────────────┐
│                                                         │
│    ┌──────────────┐                  ┌──────────────┐  │
│    │    FROZEN    │                  │    READY     │  │
│    │              │  [Time passes    │              │  │
│    │ In freezer   │───or user marks──►│ Thawed and   │  │
│    │              │   thawed]        │ ready to eat │  │
│    └──────┬───────┘                  └──────────────┘  │
│           │                                    ▲       │
│           │                                    │       │
│   [Move to fridge                    [Time passes      │
│    for thawing]                       ~24hrs or        │
│           │                           user marks       │
│           ▼                           thawed]          │
│    ┌──────────────┐                            │       │
│    │  DEFROSTING  │────────────────────────────┘       │
│    │              │                                    │
│    │ In fridge,   │                                    │
│    │ thawing      │                                    │
│    └──────────────┘                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
        (States for items that were/are frozen)
```

### 5.3 Shopping List Item State Machine

```
┌──────────────┐
│   PENDING    │◄─────────────────────────┐
│              │                          │
│ Not yet      │                          │
│ purchased    │                   [User unchecks]
└──────┬───────┘                          │
       │                                  │
       │                                  │
       ├──────[User checks]───────────────┤
       │                                  │
       │                                  │
       ▼                                  │
┌──────────────┐                          │
│   CHECKED    │──────────────────────────┘
│              │
│ In cart or   │
│ purchased    │
└──────┬───────┘
       │
       │
       ├──────[Item not available]
       │
       ▼
┌──────────────┐
│ UNAVAILABLE  │
│              │
│ Not in stock │
│ at store     │
└──────────────┘


       │
       │ [User removes]
       │
       ▼
┌──────────────┐
│   REMOVED    │
│              │
│ Deleted from │
│ list         │
└──────────────┘
```

### 5.4 Planned Meal State Machine

```
┌──────────────┐
│   PLANNED    │
│              │
│ Scheduled    │
│ for future   │
└──────┬───────┘
       │
       ├──────────────────────────────────┐
       │                                  │
       │                                  │
[User logs     [User skips      [User swaps
 the meal]      the meal]        with another]
       │              │                   │
       ▼              ▼                   ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│    LOGGED    │ │   SKIPPED    │ │   SWAPPED    │
│              │ │              │ │              │
│ Meal was     │ │ Meal was     │ │ Replaced     │
│ eaten        │ │ not eaten    │ │ with other   │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Appendix A: Domain Events

> **Note.** Domain events are a *conceptual* reaction catalog. They are implemented with the simplest mechanism per case - a Postgres trigger, a Supabase Edge Function, or transactional client logic - not an asynchronous event bus.

```
// Identity Events
UserRegistered { userId, email, timestamp }
UserPreferencesUpdated { userId, preferences, timestamp }
HouseholdCreated { householdId, createdBy, name, timestamp }
HouseholdMemberAdded { householdId, userId, role, timestamp }
HouseholdMemberRemoved { householdId, userId, timestamp }

// Recipe Events
RecipeCreated { recipeId, ownerId, title, timestamp }
RecipeUpdated { recipeId, changes, timestamp }
RecipeDeleted { recipeId, timestamp }
RecipeFavorited { recipeId, userId, timestamp }
RecipeUnfavorited { recipeId, userId, timestamp }
RecipeCooked { recipeId, userId, servings, timestamp }

// Inventory Events
PantryItemAdded { itemId, ownerId, name, quantity, timestamp }
PantryItemUpdated { itemId, changes, timestamp }
PantryItemConsumed { itemId, quantityUsed, timestamp }
PantryItemDeleted { itemId, timestamp }
PreppedMealCreated { mealId, origin, recipeId?, portions, timestamp }
PreppedMealPortionConsumed { mealId, portions, timestamp }
PreppedMealDefrostStarted { mealId, timestamp }
PreppedMealDefrostCompleted { mealId, timestamp }
PreppedMealExpired { mealId, timestamp }

// Planning Events
MealPlanCreated { planId, ownerId, dateRange, timestamp }
MealPlanUpdated { planId, changes, timestamp }
PlannedMealAdded { planId, mealId, date, slot, source, timestamp }
PlannedMealLogged { mealId, userId, timestamp }
PlannedMealSkipped { mealId, userId, timestamp }
PlannedMealSwapped { mealId, newSource, timestamp }
MealPrepSessionCreated { sessionId, recipes, scheduledDate, timestamp }
MealPrepSessionCompleted { sessionId, actualPortions, timestamp }
MealPrepSessionCancelled { sessionId, timestamp }
MealReminderTriggered { reminderId, userId, timestamp }
MealScheduleRuleApplied { ruleId, planId, plannedMealIds, timestamp }
MealSuggestionFeedbackRecorded { feedbackId, userId, target, reaction, timestamp }

// Shopping Events
ShoppingListCreated { listId, ownerId, source, timestamp }
ShoppingItemAdded { listId, itemId, name, quantity, timestamp }
ShoppingItemChecked { itemId, userId, timestamp }
ShoppingItemUnchecked { itemId, timestamp }
ShoppingListCompleted { listId, timestamp }

// Nutrition Events
NutritionGoalSet { userId, goals, timestamp }
DailyNutritionSummaryUpdated { userId, date, totals, timestamp }

// Variety Events
FoodHyperfixationDetected { userId, foodName, startDate, timestamp }
FoodHyperfixationEnded { hyperfixationId, endDate, timestamp }
ChainSuggestionGenerated { userId, currentFood, suggestedFood, timestamp }
ChainSuggestionResponded { suggestionId, response, timestamp }
```

---

*End of Domain Specification*
