# ADR-001: Platform Strategy — Svelte Web + Kotlin Multiplatform Mobile

**Status:** Accepted  
**Date:** 2026-01-10
**Deciders:** Robert (Project Lead)

---

## Context

The initial technical architecture targeted **Kotlin Multiplatform (KMP) + Compose Multiplatform** across all platforms:

- Android (Primary MVP)
- Desktop — Windows/Linux (Primary MVP)
- iOS/macOS (Stretch)
- Web (Stretch, experimental via Kotlin/Wasm)

During architecture review, we questioned whether a native desktop application was necessary given the primary use cases:

1. **Mobile-first usage** — Quick meal logging, reminders, barcode scanning while cooking or shopping
2. **"Big screen" planning sessions** — Weekly meal planning, recipe browsing, calendar management

The desktop app was originally justified by multi-window support for viewing recipes alongside the meal plan. However, this workflow is equally well-served by browser tabs or side-by-side browser windows.

We also evaluated **Compose for Web** maturity:

| Variant               | Maturity     | Code Sharing                      | Trade-offs                                   |
| --------------------- | ------------ | --------------------------------- | -------------------------------------------- |
| Compose HTML (DOM)    | Usable       | Different UI code from Compose UI | Kotlin everywhere, but two UI paradigms      |
| Compose Wasm (Canvas) | Experimental | True sharing                      | Not production-ready; accessibility concerns |

If Compose HTML requires separate UI code anyway, the benefit of "Kotlin everywhere" diminishes significantly compared to using a proven web framework.

---

## Decision

We adopt a **hybrid stack**:

| Platform    | Technology                    | Priority | Status           |
| ----------- | ----------------------------- | -------- | ---------------- |
| **Android** | KMP + Compose Multiplatform   | Primary  | MVP              |
| **Web**     | SvelteKit + PowerSync Web SDK | Primary  | MVP              |
| **iOS**     | KMP + Compose Multiplatform   | Stretch  | Community-tested |
| ~~Desktop~~ | ~~Dropped~~                   | —        | —                |

### Stack Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXUS KITCHEN                            │
├─────────────────────────────────────────────────────────────────┤
│  MOBILE (Android + iOS)          │  WEB                         │
│  ─────────────────────────       │  ───                         │
│  Kotlin Multiplatform            │  SvelteKit                   │
│  Compose Multiplatform           │  TypeScript                  │
│  PowerSync Kotlin SDK            │  PowerSync Web SDK           │
│  SQLite (local)                  │  IndexedDB/OPFS (local)      │
├─────────────────────────────────────────────────────────────────┤
│                         BACKEND                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Ktor (Kotlin) API Server                                       │
│  PostgreSQL + PowerSync Service                                 │
│  S3-compatible object storage                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Points

1. **Web is now MVP-tier** — Not experimental; it's a first-class client
2. **Desktop is dropped** — Browser handles "big screen" use case adequately
3. **iOS remains stretch** — Due to lack of test hardware, not technical limitations
4. **Two UI codebases** — Svelte (web) and Compose (mobile), but shared sync infrastructure
5. **Backend unchanged** — Ktor remains the backend framework

---

## Rationale

### Why Svelte over Compose for Web?

| Factor                      | Svelte              | Compose HTML | Compose Wasm         |
| --------------------------- | ------------------- | ------------ | -------------------- |
| Production readiness        | Proven              | Usable       | Experimental         |
| Ecosystem maturity          | Excellent           | Growing      | Early                |
| UI code sharing with mobile | None                | Minimal      | Full                 |
| Learning opportunity        | Yes (new framework) | Incremental  | Blocked              |
| Bundle size                 | Small               | Medium       | Large                |
| Accessibility               | Native HTML         | Native HTML  | Canvas (problematic) |
| Developer experience        | Excellent           | Good         | Unknown              |

Since Compose HTML doesn't share UI code with Compose Multiplatform anyway, choosing Svelte gives us:

- A battle-tested web framework
- Excellent developer experience
- An opportunity to learn a well-regarded modern framework
- Better community resources and tooling

### Why Drop Desktop?

1. **Use case overlap** — The "big screen planning" workflow works fine in a browser
2. **Multi-window needs** — Browser tabs provide equivalent functionality
3. **Reduced scope** — One fewer platform to build, test, and maintain
4. **JVM distribution burden** — Desktop apps require JVM bundling, increasing complexity

### Why Keep KMP for Mobile?

1. **Android-first development** — Kotlin is the natural choice
2. **iOS code sharing** — Significant business logic reuse when iOS is added
3. **PowerSync Kotlin SDK** — Production-ready, well-documented
4. **Compose Multiplatform** — Mature for Android, good for iOS

---

## Consequences

### Positive

- **Simpler MVP scope** — Two platforms (Android + Web) instead of three
- **Proven technologies** — Both Svelte and KMP are production-ready
- **Learning opportunity** — Svelte is an interesting framework to explore
- **Better web experience** — Native web framework vs. experimental Kotlin/Wasm
- **Smaller deployment footprint** — No JVM desktop apps to distribute

### Negative

- **Two UI codebases** — Svelte (TypeScript) and Compose (Kotlin)
- **Two languages** — TypeScript for web, Kotlin for mobile/backend
- **No UI code sharing** — Features must be implemented twice for web and mobile
- **Sync logic duplication risk** — Must ensure PowerSync usage patterns stay aligned

### Mitigations

| Risk                       | Mitigation                                                                      |
| -------------------------- | ------------------------------------------------------------------------------- |
| UI drift between platforms | Shared design system documentation; component parity checklist                  |
| Sync logic divergence      | PowerSync handles core sync; document any custom conflict resolution            |
| Feature parity gaps        | Maintain a feature matrix; prioritize mobile-first for ADHD features            |
| Two languages              | Kotlin backend + mobile keeps mobile/server aligned; TypeScript is web-standard |

---

## Alternatives Considered

### 1. KMP + Compose Wasm for Web

- **Rejected:** Kotlin/Wasm is experimental; not ready for MVP-tier web client

### 2. KMP + Compose HTML for Web

- **Rejected:** Still requires separate UI code; Svelte offers better DX and ecosystem

### 3. Svelte + Tauri for Everything

- **Rejected:** Would abandon KMP entirely; Tauri mobile (v2) is newer than KMP; loses Kotlin backend synergy

### 4. Keep Desktop, Drop Web

- **Rejected:** Web is more accessible; desktop doesn't add enough value over browser

### 5. React/Vue for Web

- **Rejected:** React was explicitly ruled out; Vue is viable but Svelte is more interesting to learn

---

## Implementation Notes

### Repository Structure (Updated)

```
nexus-kitchen/
├── apps/
│   ├── mobile/              # KMP + Compose (Android, iOS)
│   │   ├── shared/          # Shared Kotlin code
│   │   ├── androidApp/      # Android-specific
│   │   └── iosApp/          # iOS-specific (stretch)
│   └── web/                 # SvelteKit app
│       ├── src/
│       └── package.json
├── server/                  # Ktor backend
└── docker/                  # Infrastructure configs
```

### Shared Domain Types

To reduce drift, consider:

- OpenAPI spec generation from Ktor → TypeScript types for Svelte
- Shared JSON schema for domain models
- PowerSync schema as implicit contract

### PowerSync Configuration

Both clients use PowerSync but with different SDKs:

- **Mobile:** `@powersync/kotlin` → SQLite
- **Web:** `@powersync/web` → IndexedDB/OPFS

Sync rules (`powersync.yaml`) remain the single source of truth for what syncs.

---

## References

- [SvelteKit Documentation](https://kit.svelte.dev/)
- [PowerSync Web SDK](https://docs.powersync.com/client-sdk-references/javascript-web)
- [PowerSync Kotlin SDK](https://docs.powersync.com/client-sdk-references/kotlin-multiplatform)
- [Compose Multiplatform](https://www.jetbrains.com/lp/compose-multiplatform/)

---

_End of ADR-001_
