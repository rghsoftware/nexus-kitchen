# ADR-002: Library and Design System Selection

**Status:** Accepted  
**Date:** 2026-01-10  
**Deciders:** Robert (Project Lead)

---

## Context

With the platform strategy established in ADR-001 (SvelteKit web + KMP mobile), we needed to select supporting libraries for both platforms. Key considerations included:

1. **Design system approach** — Carbon Design System was initially considered for visual consistency across platforms, but Carbon Compose (the unofficial Compose implementation) has significant gaps
2. **Navigation** — Voyager is effectively unmaintained; Decompose adds architectural complexity
3. **Core utilities** — DI, logging, settings, date/time handling, image loading, error handling
4. **Web-specific needs** — Form validation, state management, HTTP client patterns

We evaluated Carbon Compose and found it lacking critical components:

| Component Category | Carbon Compose Status | Impact on Nexus Kitchen |
|--------------------|----------------------|-------------------------|
| Modal/Dialog | ❌ Missing | Can't edit recipes inline |
| Data Table | ❌ Missing | No shopping list views |
| Navigation Shell | ❌ Missing | No app structure |
| Card/Tile | ❌ Missing | No recipe cards |
| Date Picker | ⚠️ Partial | Limited meal scheduling |
| Form components | ❌ Missing | No structured input |

Meanwhile, Carbon Svelte has **169 production-ready components**. This asymmetry means "Carbon everywhere" provides no consistency benefit — we'd build custom mobile components anyway.

---

## Decision

We adopt a **headless/unstyled component approach** with a custom design system, plus carefully selected utility libraries for each platform.

### UI Component Strategy

| Platform | Library | Purpose |
|----------|---------|---------|
| **Mobile** | Compose Unstyled | Headless primitives (dialogs, sheets, menus) |
| **Web** | Bits UI | Headless primitives (built on Melt UI) |
| **Both** | Custom design tokens | Shared color, spacing, typography spec |
| **Web** | Tailwind CSS | Utility-first styling |

### Complete Library Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                     MOBILE (KMP + Compose)                      │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer                                                       │
│  ├── Compose Unstyled ─────── Headless primitives               │
│  ├── Material 3 DatePicker ── Date/time selection               │
│  ├── Coil 3.x ─────────────── Image loading                     │
│  └── JetBrains Navigation ─── Screen navigation                 │
├─────────────────────────────────────────────────────────────────┤
│  Domain/Data Layer                                              │
│  ├── Arrow (core) ─────────── Typed error handling              │
│  ├── Koin ─────────────────── Dependency injection              │
│  ├── Ktor Client ──────────── HTTP networking                   │
│  ├── kotlinx.serialization ── JSON serialization                │
│  ├── kotlinx-datetime ─────── Date/time logic                   │
│  ├── multiplatform-settings ─ Preferences storage               │
│  └── Kermit ───────────────── Logging                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        WEB (SvelteKit)                          │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer                                                       │
│  ├── Bits UI ──────────────── Headless primitives               │
│  ├── Tailwind CSS ─────────── Utility styling                   │
│  └── Svelte 5 runes ───────── Reactive state                    │
├─────────────────────────────────────────────────────────────────┤
│  Domain/Data Layer                                              │
│  ├── Superforms + Zod ─────── Form validation                   │
│  ├── Day.js ───────────────── Date/time handling                │
│  └── Native fetch ─────────── HTTP (SvelteKit enhanced)         │
└─────────────────────────────────────────────────────────────────┘
```

### Key Points

1. **Headless over pre-styled** — Full control, no fighting opinionated design systems
2. **JetBrains Navigation** — Official port of AndroidX Navigation for Compose Multiplatform
3. **Koin over kotlin-inject** — Better DX, no build time impact, excellent Compose integration
4. **Kermit over Napier** — Actively maintained; Napier hasn't been updated in 18 months
5. **Day.js over date-fns** — 2 KB vs 18 KB bundle; sufficient for our needs
6. **Svelte 5 runes sufficient** — No external state management library needed

---

## Rationale

### Why Headless Components?

| Factor | Carbon (Mixed) | Headless (Unstyled) |
|--------|---------------|---------------------|
| Mobile component coverage | ~50% | 80%+ of primitives |
| Styling freedom | Fight Carbon opinions | Full control |
| Cross-platform consistency | None (different implementations) | Same patterns, custom tokens |
| Custom component effort | Build anyway | Build with consistent primitives |
| Learning curve | Carbon + custom | Just custom |

Compose Unstyled provides the hard primitives (bottom sheets, dialogs, dropdown menus, tooltips) that are painful to build correctly. We style them once with our own design tokens rather than adapting Carbon's incomplete implementation.

### Why JetBrains Navigation?

| Library | Status | Complexity | Recommendation |
|---------|--------|------------|----------------|
| Voyager | Unmaintained (1+ year) | Low | ❌ Risk |
| Decompose | Active | High (BLoC pattern) | ⚠️ Overkill |
| JetBrains Navigation | Official, active | Medium | ✅ Recommended |

JetBrains now officially ports AndroidX Navigation as `org.jetbrains.androidx.navigation:navigation-compose`. It's the path of least resistance for Compose-only apps, with Navigation 3 coming in Compose Multiplatform 1.10.

### Why Koin for DI?

| Library | Type | Build Impact | Stars | Best For |
|---------|------|--------------|-------|----------|
| **Koin** | Runtime | None | ~9,800 | Rapid development |
| kotlin-inject | Compile-time | KSP overhead | ~1,200 | Type safety purists |
| Kodein | Runtime | None | ~3,100 | Existing users |

Koin's Kotlin DSL requires no annotation processing. The `koinViewModel` and `koinInject` composables integrate seamlessly with Compose Multiplatform. For a hobby project prioritizing developer velocity, runtime DI is acceptable.

### Why Kermit over Napier?

Napier's last release was January 2024 — **18 months without updates** creates risk for Kotlin version compatibility. Kermit from Touchlab offers:

- Active maintenance (2.0.8 as of late 2025)
- WASM support for future web stretch goal
- Crashlytics/Bugsnag integration
- Gradle plugin for stripping debug logs in release builds

### Why Day.js over date-fns?

| Library | Bundle Size | Tree-shaking | Timezone |
|---------|-------------|--------------|----------|
| **Day.js** | ~2 KB core | Plugin-based | Via Intl API |
| date-fns | ~18.6 KB | Good | Separate package |
| Temporal API | Native | N/A | Built-in (not ready) |

Day.js at 2 KB provides everything Nexus Kitchen needs for meal scheduling. The Temporal API remains unsuitable — only Chrome 144+ and Firefox 139+ support it as of January 2025.

### Why Superforms + Zod?

This combination won Svelte Hack 2023's best library award and remains the de facto standard for SvelteKit forms:

- Server-side and client-side validation from single schema
- Progressive enhancement (works without JS)
- Type-safe with TypeScript
- Formsnap adds accessible form components on top

### Why Native Fetch for Web?

SvelteKit's enhanced `fetch` in load functions provides:

- Automatic credential forwarding
- Relative URL handling
- Internal request short-circuiting

No wrapper library needed. For client-side calls requiring retries, `wretch` (~3 KB) is a lightweight option.

---

## Consequences

### Positive

- **Consistent primitives** — Same interaction patterns across platforms via headless approach
- **Full styling control** — Design tokens define look; primitives define behavior
- **Reduced dependency risk** — Actively maintained libraries throughout
- **Appropriate complexity** — No over-engineering (Decompose) or abandonment risk (Voyager)
- **Small web bundles** — Day.js + native fetch keeps payload minimal

### Negative

- **Custom design work required** — Must create design tokens and styled components
- **No pre-built component library** — More upfront UI development
- **Date picker gap** — Compose Unstyled lacks date pickers; need Material 3 or kmp-date-time-picker
- **Two validation approaches** — Arrow (mobile) vs Zod (web) for validation logic

### Mitigations

| Risk | Mitigation |
|------|------------|
| Design inconsistency | Document design tokens in shared spec; component parity checklist |
| Date picker styling mismatch | Use Material 3 on mobile, Bits UI on web; accept platform-native feel |
| Validation logic drift | Keep validation simple; complex rules in backend |
| Library deprecation | All selections are actively maintained with large communities |

---

## Alternatives Considered

### 1. Carbon Design System (Full)

- **Rejected:** Carbon Compose is ~50% complete; we'd build custom components anyway

### 2. Material 3 Everywhere

- **Rejected:** Explicitly wanted to avoid Material aesthetic; creates "generic Android app" feel

### 3. Decompose for Navigation

- **Rejected:** BLoC pattern adds complexity not justified for this project scope

### 4. kotlin-inject for DI

- **Rejected:** Compile-time safety is nice but KSP build overhead isn't worth it for hobby project

### 5. TanStack Query for Web State

- **Rejected:** Svelte 5 runes are sufficient; add TanStack Query only if caching needs grow

### 6. date-fns for Web Dates

- **Rejected:** 9x larger bundle than Day.js for equivalent functionality

---

## Implementation Notes

### Design Token Structure

```
design-tokens/
├── colors.json          # Semantic color palette
├── spacing.json         # Spacing scale (4px base)
├── typography.json      # Font families, sizes, weights
├── shadows.json         # Elevation levels
└── motion.json          # Animation durations, easings
```

Generate platform-specific outputs:
- **Mobile:** Kotlin `object` with Compose `Color`, `Dp`, `TextStyle`
- **Web:** CSS custom properties + Tailwind config

### Compose Unstyled Components Used

| Component | Nexus Kitchen Usage |
|-----------|---------------------|
| Bottom Sheet | Recipe quick-add, shopping item edit |
| Modal/Dialog | Confirmations, recipe details |
| Dropdown Menu | Meal slot selection, filters |
| Tabs | Recipe categories, meal plan views |
| Checkbox | Shopping list items, dietary tags |
| Toggle | Feature preferences, dark mode |
| Accordion | Recipe sections, FAQ |

### Bits UI Components Used

| Component | Nexus Kitchen Usage |
|-----------|---------------------|
| Dialog | Recipe editing, confirmations |
| Popover | Tooltips, contextual help |
| Select | Ingredient units, categories |
| Combobox | Ingredient search/autocomplete |
| DatePicker | Meal plan date selection |
| Tabs | Navigation, content sections |
| Checkbox | Shopping list, filters |

### Missing Components (Build Custom)

| Component | Platform | Notes |
|-----------|----------|-------|
| Recipe Card | Both | Custom layout with image, title, metadata |
| Meal Slot | Both | Calendar grid cell with meal assignment |
| Shopping Item | Both | Swipeable list item with checkbox |
| Calendar View | Mobile | Monthly/weekly meal plan grid |
| Nutrition Badge | Both | Macro/calorie display chip |

### Version Matrix

| Library | Version | Platform | License |
|---------|---------|----------|---------|
| Compose Unstyled | 1.49.x | Mobile | Apache 2.0 |
| Bits UI | 1.x | Web | MIT |
| Tailwind CSS | 4.x | Web | MIT |
| JetBrains Navigation | 2.9.x | Mobile | Apache 2.0 |
| Coil | 3.3.x | Mobile | Apache 2.0 |
| Arrow | 2.2.x | Mobile | Apache 2.0 |
| Koin | 4.1.x | Mobile | Apache 2.0 |
| Ktor Client | 3.3.x | Mobile | Apache 2.0 |
| kotlinx.serialization | 1.7.x | Mobile/Backend | Apache 2.0 |
| kotlinx-datetime | 0.7.x | Mobile/Backend | Apache 2.0 |
| multiplatform-settings | 1.3.x | Mobile | Apache 2.0 |
| Kermit | 2.0.x | Mobile | Apache 2.0 |
| Superforms | 2.29.x | Web | MIT |
| Zod | 4.3.x | Web | MIT |
| Day.js | 1.11.x | Web | MIT |

---

## References

- [Compose Unstyled](https://composables.com/compose-unstyled)
- [Bits UI](https://www.bits-ui.com/)
- [JetBrains Navigation for Compose](https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-navigation-routing.html)
- [Coil](https://coil-kt.github.io/coil/)
- [Arrow](https://arrow-kt.io/)
- [Koin](https://insert-koin.io/)
- [Kermit](https://kermit.touchlab.co/)
- [multiplatform-settings](https://github.com/russhwolf/multiplatform-settings)
- [Superforms](https://superforms.rocks/)
- [Bits UI Documentation](https://www.bits-ui.com/docs)
- [Day.js](https://day.js.org/)

---

_End of ADR-002_
