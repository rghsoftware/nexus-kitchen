# Tech Stack - nexus-kitchen

**Last Updated**: 2026-06-07
**Auto-Generated**: Yes (extracted from spec corpus + package.json by `/ss:init`)

<!--
  Sections wrapped in the `ss:user-additions` ... `ss:end` HTML comment markers
  (see below) are preserved verbatim when /ss:init is re-run. Edit freely inside
  those blocks. The rest of the file is regenerated from project detection on
  each /ss:init.
-->

---

## Core Technologies

### Framework

- **SvelteKit (Svelte 5)** @sveltejs/kit ^2.57.0, svelte ^5.55.2
  - Notes: One client-rendered SPA with `adapter-static`; Svelte 5 runes forced project-wide.
  <!-- source: docs/ADR/ADR-0001-technology-stack.md:19; package.json:23, confidence=high -->

### Language

- **TypeScript** ^6.0.2
  - Notes: `strict` on, with `allowJs` + `checkJs` so JS files are type-checked too.
  <!-- source: package.json:41; tsconfig.json:3, confidence=high -->

### Build Tool

- **Vite** ^8.0.7
  - Notes: `@sveltejs/adapter-static` ^3.0.10 emits a static SPA to `build/` with an `index.html` fallback; `@sveltejs/vite-plugin-svelte` ^7.0.0.
  <!-- source: svelte.config.js:10; package.json:43, confidence=high -->

---

## State Management

- **Client-side Svelte stores / runes** with a local read cache, optimistic UI, and server reconciliation.
  - No offline write queue or sync engine. Server (Supabase Postgres) is authoritative; clients cache recent data, apply optimistic updates, and reconcile against the server response. Realtime is best-effort.
  <!-- source: docs/nexus-kitchen-logical-architecture.md:100, confidence=high -->

---

## Styling

- **Tailwind CSS v4** (^4.2.2 via `@tailwindcss/vite`) + project CSS design tokens ("Warm Kitchen").
  - Use semantic `var(--token)` aliases and `.nk-*` component classes before any raw value. Tokens live in `src/lib/styles/` (`colors.css`, `spacing.css`, `typography.css`, `fonts.css`, `base.css`). Official plugins: `@tailwindcss/forms` ^0.5.11, `@tailwindcss/typography` ^0.5.19.
  <!-- source: docs/nexus-kitchen-design-system.md:57; package.json:25, confidence=high -->

---

## Testing

### Unit Testing

- **Vitest** ^4.1.3 (two projects)
  - Purpose: Component and function unit tests. Client project runs `*.svelte.{test,spec}.{js,ts}` in a real chromium browser via `@vitest/browser-playwright` + `vitest-browser-svelte`; server project runs the rest in node. `expect.requireAssertions` is on.
  <!-- source: CLAUDE.md:Tests, confidence=high -->

### Integration Testing

- **Vitest (server project, node)**
  - Purpose: Non-component / server-side logic. `src/lib/server/**` is excluded from the client project.
  <!-- source: CLAUDE.md:Tests, confidence=medium -->

### End-to-End Testing

- **Playwright** ^1.60.0
  - Purpose: Full application flow testing. `test:e2e` runs `playwright install && playwright test`.
  <!-- source: package.json:21, confidence=high -->

---

## Approved Libraries

### Runtime

- **@supabase/supabase-js** ^2.107.0 — Auth, PostgREST CRUD, Realtime, Storage (sole runtime dependency; client data access against managed Supabase)
- **Supabase Edge Functions (Deno)** — anything needing secrets / service-role privilege: AI calls, third-party lookups, privileged writes
- **Supabase Cron (pg_cron) → Pushover** — server-side reminders / scheduled tasks
- **Browser BarcodeDetector API** (with JS fallback) — camera-based barcode scanning; lookups go through Edge Functions
- **Cloud AI providers (Anthropic / OpenAI / Gemini)** via Edge Functions, behind a capability router — cloud AI default; key safety enforced server-side

### Build / Adapter

- **@sveltejs/adapter-static** ^3.0.10 — static SPA build adapter
- **tailwindcss** ^4.2.2 with `@tailwindcss/vite`, `@tailwindcss/forms` ^0.5.11, `@tailwindcss/typography` ^0.5.19

### Tooling

- **prettier** ^3.8.1 with `prettier-plugin-svelte` ^3.5.1 and `prettier-plugin-tailwindcss` ^0.7.2 — tabs, single quotes, no trailing comma, printWidth 100
- **eslint** ^10.4.0 with `typescript-eslint` ^8.58.1, `eslint-plugin-svelte` ^3.17.0, `eslint-config-prettier` ^10.1.8 — flat config (`eslint.config.js`)
- **svelte-check** ^4.4.6 — typecheck / diagnostics via `bun run check`

### Hosting

- **Caddy** (self-hosted) serves the static frontend; backend stays managed Supabase

<!-- ss:user-additions -->
<!-- Add project-specific approved libraries below. Content here is preserved on /ss:init re-run. -->
<!-- Planned but not yet dependencies (per design system): Bits UI (interactive component behavior/a11y), Phosphor Icons (regular + fill, self-hosted in production). -->
<!-- ss:end -->

---

## Prohibited Technologies

The following technologies/patterns are **NOT** approved for this project:

### Architecture

- ❌ **Native apps** (no Tauri, Rust, Flutter, Kotlin/native) for MVP — static SPA kept so Tauri stays a drop-in option later
- ❌ **SSR / prerendering** — root `+layout.ts` sets `ssr=false` and `prerender=false`; no server load functions, no `+server.ts` / `+page.server.ts` / `+layout.server.ts`
- ❌ **Offline write queue / conflict-resolution / sync engine** (no PowerSync, ElectricSQL, or custom sync)
- ❌ **Web Push / native push layer** — reminders use Pushover only
- ❌ **Self-hosting Supabase** for MVP (managed cloud); self-host kept only as an escape hatch
- ❌ **PWA / installable web app** for MVP

### Security

- ❌ **Unchecked `{@html}`** — treat AI output as untrusted; rely on Svelte output escaping
- ❌ **Service-role key in the client** — only the public anon key ships to the browser; security rests on RLS + Auth
- ❌ **String-built SQL in Edge Functions** — use PostgREST / parameterized queries

### Svelte

- ❌ **Runes mode opt-out in app code** — Svelte 5 runes forced project-wide (except `node_modules`)

<!-- ss:user-additions -->
<!-- Add project-specific prohibited patterns below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

## Open Decisions

- `[OPEN]` Local / on-device AI is optional and out of scope for MVP (provider set may expand). <!-- source: docs/ADR/ADR-0003-managed-cloud.md:17, confidence=low -->
- `[OPEN]` Bits UI and Phosphor Icons are designed/planned but not yet added as dependencies (no `src/` implementation yet). <!-- source: docs/nexus-kitchen-design-system.md:71, confidence=low -->
- `[OPEN]` Reaction implementation (cross-aggregate effects) chosen per case among Postgres trigger / Edge Function / transactional client logic; kept idempotent. <!-- source: docs/nexus-kitchen-logical-architecture.md:130, confidence=low -->

---

## Guidelines

### Adding New Dependencies

Before adding a new dependency:

1. Check if existing approved libraries can solve the problem
2. Verify the library is actively maintained
3. Check bundle size impact (static SPA — initial load matters)
4. Ensure TypeScript support
5. Confirm it works client-side only (no Node/server runtime exists in this deployment)

### Version Updates

- Follow semver for all dependencies
- Test thoroughly before updating major versions
- Document breaking changes in this file
- Regenerate Supabase types (`supabase gen types`) after schema changes

---

## Notes

- This file was extracted from the spec corpus (ADRs, architecture, design system) and `package.json` by `/ss:init`.
- Package manager is **bun** (the `npm` lines in `README.md` are scaffold leftovers).
- Update this file when adding new technologies or patterns; re-run `/ss:init` to refresh against project state.

<!-- ss:user-additions -->
<!-- Add project-specific notes below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

**Tech Stack Enforcement**: This file is used by SpecSwarm to prevent technology drift. Commands like `/ss:build` and `/ss:implement` will reference this file to ensure consistency across features.
