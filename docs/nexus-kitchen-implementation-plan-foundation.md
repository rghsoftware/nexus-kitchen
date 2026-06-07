# Nexus Kitchen - Implementation Plan: Foundation Phase

**Document Version:** 1.0
**Date:** June 4, 2026
**Purpose:** Stand up the project and start building. Nothing here needs "proving" - this stack is well-trodden.

> ℹ️ **Note:** Exact CLI flags drift between releases. Treat commands as the shape of each step and confirm against current Svelte, Supabase, and Caddy docs. Commands assume **Bun**.

---

## TL;DR

There's no risky integration to de-risk here - it's a SvelteKit SPA talking to Supabase, served as static files by Caddy. So foundation is just: **scaffold the app, wire Supabase, serve it behind Caddy, and go build the first real feature.** No throwaway skeleton, no fake screens, no premature deploy of nothing.

---

## Prerequisites

| Tool | Why | Check |
|------|-----|-------|
| **Bun** | Runtime + package manager | `bun -v` |
| **Supabase CLI** | Local stack, migrations, types | `supabase --version` |
| **Docker Desktop** | Required by `supabase start` (local stack only) | `docker ps` |
| **Caddy** | Serves the static build over automatic HTTPS | `caddy version` |
| **Accounts** | GitHub, Supabase (Pushover later, for reminders) | logged in |

---

## Repository Shape

One SvelteKit app at the root, plus **`supabase/`** (migrations, Edge Functions, config) and the **design tokens** (`styles.css` + `tokens/`) lifted from the design bundle. Inside the app, give **each bounded context its own module folder** as a slice needs it - don't pre-create empty folders. A module owns its own data access, state, components, and types, and never writes another module's tables.

---

## Steps

### 1. Scaffold the SvelteKit SPA
```bash
bunx sv create nexus-kitchen   # SvelteKit, TypeScript
cd nexus-kitchen && bun install
```

Configure `svelte.config.js` for a static SPA (the `fallback` is required, or the build fails on dynamic routes):

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter({ fallback: 'index.html' }) }
};
export default config;
```

In the root `+layout.ts`:
```ts
export const ssr = false;
export const prerender = false;
```

Delete the scaffolded `src/routes/demo/` routes.

✅ `bun run dev` serves locally; `bun run build` produces a static `build/`.

> ℹ️ **Why static SPA:** keeps a future **Tauri** wrap a drop-in option, and is dead-simple to host behind Caddy.

### 2. Wire Supabase
```bash
bunx supabase init
bunx supabase start        # local stack (Docker)
bunx supabase link --project-ref <your-project-ref>
```

- Install the client: `bun add @supabase/supabase-js`; init it with `PUBLIC_SUPABASE_URL` and the **publishable key** (`sb_publishable_...`).
- Schema changes are **versioned migrations** under `supabase/migrations/`, applied with `bunx supabase db push`.
- Regenerate types whenever the schema changes:
  `bunx supabase gen types typescript --local > src/lib/supabase/database.types.ts`

### 3. Serve behind Caddy
Build (`bun run build`) and point Caddy at the output, with an SPA fallback so deep links / refreshes resolve:

```caddyfile
nexus.example.com {
    root * /var/www/nexus-kitchen
    encode gzip
    try_files {path} /index.html
    file_server
}
```

✅ Caddy provisions HTTPS automatically; the SPA loads and talks to managed Supabase.

### 4. Build the first real feature
Go straight to an ADHD-priority slice - **one-tap meal logging** or **meal reminders** - through the full stack. No skeleton first.

> 🎨 **Design:** lift the design system in early - link `styles.css` + `tokens/*` and build with the `.nk-*` classes (porting them into Svelte components, Bits UI for interactive behavior). Self-host the fonts (Bricolage Grotesque, Hanken Grotesk) and Phosphor icons rather than CDN. See `nexus-kitchen-design-system.md`.

> ℹ️ **Reminders** are server-side: a **Supabase Cron** job finds due reminders and POSTs (via `pg_net` or an Edge Function) to **Pushover**. The Pushover token lives in Edge Function secrets - never in the client.

---

## Secrets & Environment

| Value | Where | Client-visible? |
|-------|-------|-----------------|
| `PUBLIC_SUPABASE_URL` | `.env` / host env | Yes (safe) |
| **Publishable key** (`sb_publishable_...`) | `.env` / host env | Yes (safe - RLS protects data) |
| **Secret key** (`sb_secret_...`) | Edge Functions / server env only | **Never** |
| Pushover token, AI keys | Edge Function secrets | **Never** |

---

## Conventions to Lock In Now

- **RLS default-deny** on every user-data table; explicit policies only.
- **Migrations are the schema source of truth** - no uncaptured Studio edits.
- **Module boundaries** - a module writes only its own tables; cross-context effects via Postgres trigger, Edge Function, or transactional client logic.
- **Append-only logs** - meal logs and portion events are inserted, never overwritten.
- **Optimistic UI** - high-frequency actions update immediately and reconcile.

---

## Out of Scope (Deliberately)

- ❌ **Native apps / app stores** - it's a responsive web app. (Tauri is *deferred, not dead* - the static SPA keeps it a drop-in option.)
- ❌ **Offline sync engine** - online-first with read caching.
- ❌ **Throwaway skeleton / fake data** - first real feature is the first build.
- ❌ **Monorepo tooling** - one app + `supabase/` needs none.

---

## Definition of Done

- [ ] `bun run build` produces a static SPA, served by **Caddy over HTTPS**
- [ ] The app reads/writes **managed Supabase** with **RLS default-deny** in place
- [ ] **Migrations** workflow works (`db push`) and types generate from the schema
- [ ] The **first real feature slice** is underway
