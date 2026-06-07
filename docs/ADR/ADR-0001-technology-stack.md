# ADR-0001: Technology stack — SvelteKit SPA + Supabase (web-only)

- **Status:** Accepted
- **Date:** June 4, 2026
- **Deciders:** Robert (solo developer)

## Context

Nexus Kitchen is a solo, hobby-paced project whose guiding goal is to **reduce cognitive load**. The developer is fluent in SvelteKit and Supabase and has built applications of this kind before — so the stack's main job is to stay out of the way and let features ship, not to be proven out.

Mobile reach matters, but **native app distribution is actively undesirable** here:
- Google Play's closed-testing rule (12 testers for 14 days before a personal account can apply for production) is a real wall for a personal app.
- App-store **age-verification laws** now landing add ongoing compliance drag for no benefit to a meal planner.

Crucially, the one capability that previously justified going native — **meal reminders** — can be delivered entirely server-side (see ADR-0002 / reminders design: Supabase Cron → Pushover). That removes the last reason to ship a native build.

## Decision

- **One SvelteKit SPA** (`adapter-static`, client-rendered) — a **responsive web app** that serves desktop and mobile through the browser. **No native apps.**
- **Supabase** backend: PostgreSQL + Row-Level Security, Auth, Realtime, Storage, Edge Functions, and Cron.
- The static build is **served by Caddy** on self-hosted infrastructure; the backend stays **managed Supabase** (see ADR-0003).
- **Reminders are server-side**: Supabase Cron → Pushover. No native/Web Push notification layer.
- **Barcode scanning** uses the browser camera API (`BarcodeDetector`, with a JS fallback) — no native module.
- **No Tauri, no Rust.** The app is kept as a **static SPA** specifically so a Tauri wrapper remains a **drop-in option later** if a genuine native need ever emerges.

## Alternatives Considered

- **Tauri (web UI + native packaging).** Was the prior choice. *Rejected for now* because server-side push removed its main justification, and native distribution brings app-store friction (Play closed-testing wall, age-verification laws) and webview/mobile-maturity complexity for no real gain. **Not ruled out permanently** — the static SPA preserves it as a later option.
- **Flutter / native / Kotlin Multiplatform.** Strong native UI, but a new ecosystem and/or two codebases, plus the app-store burden. *Rejected.*
- **PWA / installable web app.** Unnecessary for the MVP — Pushover handles notifications, so there's no install requirement. Trivial to add later if wanted.

## Consequences

### Positive
- One web codebase for every device; no native builds, no app stores, no store compliance.
- Familiar stack the developer has shipped before — maximum momentum.
- Server-side reminders work even with no app open.
- Self-hosting the frontend is trivial (static files behind Caddy); the heavy backend stays managed.

### Accepted trade-offs
- No native-app feel and no installed/offline presence — it's a responsive website.
- Reminders depend on **Pushover** (a third party the developer already uses; household members would need the Pushover app).
- Barcode scanning relies on the browser camera API, which is well-supported but not universal — hence the JS fallback.

### Neutral
- Rust drops out of the project entirely.
- The static-SPA choice is retained deliberately to keep the Tauri door open.
