# Nexus Kitchen

**Inventory and operations management for meals** — an ADHD-friendly, energy-aware meal
planner delivered as a responsive **SvelteKit SPA**. One web app for desktop and mobile;
no native apps.

> **Status:** early scaffold. `src/` is still close to the minimal template and the
> Supabase backend described below is the _designed_ target, not yet built.

---

## What it is

Most meal apps are loggers and planners — they treat a meal as something you **record** or
**schedule**. Nexus Kitchen treats a planned meal as a **requirement to be fulfilled**, in
one of three states:

- **Have it** — a ready-to-eat portion already exists.
- **Can make it** — a recipe whose ingredients are on hand.
- **Must acquire** — it has to be cooked or bought by its day.

The whole product exists to move every requirement to "have it" before it's due. Pantry,
prep/cook, and shopping aren't peer features — they're the operations that close gaps:

- **Shopping** = the buy-gap.
- **Prep / cook** = the make-gap.
- **Pantry** (raw stock) = what those operations draw down.
- **Inventory** (raw stock _and_ ready-to-eat portions) = the state the whole system tracks.

It's built to reduce cognitive load and support executive-function challenges: energy-aware
suggestions, low-friction capture, and a calm, shame-free interface.

## Architecture

- **Frontend:** SvelteKit with `adapter-static`, client-rendered SPA (Svelte 5 runes).
  `ssr = false` and `prerender = false` — all data access is client-side via `supabase-js`.
- **Backend (designed):** Supabase — PostgreSQL with Row-Level Security, Auth, Realtime,
  Storage, Edge Functions, and Cron. PostgREST for CRUD; Edge Functions for anything
  needing secrets or privilege (AI calls, third-party lookups, privileged writes).
- **Online-first:** the server is authoritative; clients keep a local read cache and
  optimistic UI. No offline write queue or sync engine. Realtime is best-effort.
- **Reminders:** server-side via Supabase Cron → Pushover (no Web Push).
- **Hosting:** static build served by self-hosted **Caddy**; backend stays managed Supabase.

See [`docs/`](docs/) for the full design set:

- `nexus-kitchen-differentiator.md` — the product thesis (read first)
- `nexus-kitchen-requirements.md` — full SRS (`REQ-*` IDs)
- `nexus-kitchen-domain-specification.md` — domain model
- `nexus-kitchen-logical-architecture.md` — system/component design, data flows
- `nexus-kitchen-invariants.md` — domain/data/security invariants (`INV-*`)
- `nexus-kitchen-design-system.md` — design tokens and components
- `docs/ADR/ADR-0001..0003` — stack, online-first, managed cloud decisions

## Getting started

The package manager is **bun**.

```sh
bun install
bun run dev          # Vite dev server
bun run dev -- --open
```

## Commands

```sh
bun run dev          # Vite dev server
bun run build        # static SPA → build/
bun run preview      # serve the production build
bun run check        # svelte-kit sync && svelte-check (typecheck)
bun run lint         # prettier --check . && eslint .
bun run format       # prettier --write .
bun run test:unit    # vitest (watch)
bun run test         # unit (--run) then e2e
bun run test:e2e     # playwright install && playwright test
```

## Conventions

- **Svelte 5 runes** are enforced project-wide — use runes, not legacy reactivity.
- **SPA only** — no SSR or server load functions; data is fetched client-side.
- **Design tokens first** — use the `var(--token)` / `.nk-*` primitives in
  `src/lib/styles/` (prefer semantic aliases like `var(--primary)`) before any raw value.
- **Tests** run in two vitest projects: _client_ tests (`*.svelte.{test,spec}.{js,ts}`) in
  a real chromium browser, _server_ tests in node. Put server-only code in
  `src/lib/server/**`. Every test must make an assertion.
- **Prettier:** tabs, single quotes, no trailing comma, `printWidth` 100.
- **Data rules** (once the backend exists): UUID PKs; `timestamptz` in UTC; RLS enabled
  default-deny before any table is exposed; schema changes via Supabase CLI migrations;
  client types via `supabase gen types`. The anon key is public; the service-role key is
  server-only (Edge Functions). Treat AI output as untrusted; never use unchecked `{@html}`.

## License

Copyright (C) 2026 Robert Hamilton

Nexus Kitchen is free software: you can redistribute it and/or modify it under the terms of
the **GNU Affero General Public License** as published by the Free Software Foundation,
either version 3 of the License, or (at your option) any later version. See
[`LICENSE`](LICENSE) for the full text.
