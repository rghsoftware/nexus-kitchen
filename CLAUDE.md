# Nexus Kitchen

A responsive **SvelteKit SPA** (`adapter-static`, client-rendered) — an ADHD-friendly
meal planner (recipes, planning, pantry/prepped inventory, shopping, energy-aware
suggestions). One web app for desktop + mobile; **no native apps**.

> **Status:** early scaffold. `src/` is still the minimal template and there is no
> `supabase/` directory yet — the backend below is the _designed_ target, not yet built.

## Commands

Package manager is **bun** (the `npm` lines in `README.md` are scaffold leftovers).

```bash
bun install
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

## Architecture

- **Backend (designed):** Supabase — PostgreSQL + Row-Level Security, Auth, Realtime,
  Storage, Edge Functions, Cron. PostgREST for CRUD; Edge Functions for anything needing
  secrets/privilege (AI calls, third-party lookups, privileged writes).
- **Hosting:** static build served by **Caddy** (self-hosted); backend stays managed Supabase.
- **Online-first:** server is authoritative; clients keep a local read cache + optimistic UI.
  No offline write queue / sync engine. Realtime is best-effort (clients can re-fetch).
- **Reminders:** server-side — Supabase Cron → Pushover (no Web Push).

**Design docs live in `docs/` — read these before non-trivial work:**

- `nexus-kitchen-requirements.md` — full SRS (REQ-\* IDs)
- `nexus-kitchen-logical-architecture.md` — system/component design, data flows, modules
- `nexus-kitchen-invariants.md` — domain/data/security invariants (INV-\* with formal expressions)
- `ADR/ADR-0001..0003` — stack (SvelteKit+Supabase, web-only), online-first, managed cloud

## Conventions & gotchas

- **Svelte 5 runes are forced project-wide** (`svelte.config.js`, except `node_modules`). Use runes.
- **SPA only:** root `src/routes/+layout.ts` sets `ssr = false` and `prerender = false`.
  No SSR / server load functions — data access is client-side via supabase-js.
- **Tests (vitest, two projects):** _client_ runs in a real browser (chromium) over
  `*.svelte.{test,spec}.{js,ts}`; _server_ runs in node over the rest. `src/lib/server/**`
  is excluded from the client project — put server-only code there. `expect.requireAssertions`
  is **on**: every test must make an assertion.
- **Design tokens first:** styles in `src/lib/styles/` (`colors.css`, `spacing.css`,
  `typography.css`, `fonts.css`, `base.css`) MUST be used before any custom value. Reach for
  the existing `var(--token)` / `.nk-*` primitives — prefer semantic aliases (`var(--primary)`,
  not `var(--herb-500)`) — before writing a raw color/spacing/radius/font-size/shadow. Add a
  new raw value only when no suitable token exists.
- **Prettier:** tabs, single quotes, no trailing comma, `printWidth` 100. Run `bun run format`.
- **Data rules (when the backend exists):** UUID PKs; timestamps `timestamptz` in UTC;
  RLS enabled default-deny before any table is exposed; schema changes are Supabase CLI
  migrations; client types via `supabase gen types`. The anon key is **public**; the
  service-role key is **server-only** (Edge Functions). Treat AI output as untrusted;
  never use unchecked `{@html}`.

---

## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, mcp

---

You are able to use the Svelte MCP server, where you have access to comprehensive Svelte 5 and SvelteKit documentation. Here's how to use the available tools effectively:

## Available Svelte MCP Tools:

### 1. list-sections

Use this FIRST to discover all available documentation sections. Returns a structured list with titles, use_cases, and paths.
When asked about Svelte or SvelteKit topics, ALWAYS use this tool at the start of the chat to find relevant sections.

### 2. get-documentation

Retrieves full documentation content for specific sections. Accepts single or multiple sections.
After calling the list-sections tool, you MUST analyze the returned documentation sections (especially the use_cases field) and then use the get-documentation tool to fetch ALL documentation sections that are relevant for the user's task.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues and suggestions.
You MUST use this tool whenever writing Svelte code before sending it to the user. Keep calling it until no issues or suggestions are returned.

### 4. playground-link

Generates a Svelte Playground link with the provided code.
After completing the code, ask the user if they want a playground link. Only call this tool after user confirmation and NEVER if code was written to files in their project.
