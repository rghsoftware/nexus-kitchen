---
name: project-conventions
description: >-
  Nexus Kitchen project conventions and gotchas — design-token usage, Svelte 5
  runes, SPA-only rules, the two-project test setup, formatting, and Supabase
  data rules. Load this as background before writing or editing code in this repo.
user-invocable: false
---

# Nexus Kitchen conventions

Background knowledge for working in this repo. The authoritative source is
`CLAUDE.md` and `docs/`; this is the fast-recall summary of the things that bite.

## Design tokens come first (hard rule)

Design tokens live in `src/lib/styles/`:

- `colors.css` — brand ramps (`--herb-*`, `--clay-*`, `--oat-*`), the energy
  scale (`--energy-1..5`, `--energy-*-soft`), status (`--attention`, `--fresh`,
  `--info`), and **semantic aliases**: `--bg`, `--surface`, `--surface-2/3`,
  `--border`, `--text`, `--text-secondary`, `--text-muted`, `--primary`,
  `--primary-hover`, `--secondary`, `--focus-ring`, `--shadow-sm..xl`. Dark mode
  is `[data-theme="dark"]` — use the semantic aliases so theming just works.
- `spacing.css` — `--space-1..12`, `--radius-xs..xl`, `--radius-pill`,
  `--tap-min` (44px), `--container`, `--transition`, `--transition-slow`.
- `typography.css` / `fonts.css` — `--font-sans`, `--font-display`, `--text-*`,
  `--weight-*`, `--leading-*`, `--tracking-*`.
- `base.css` — shared primitive classes (`.nk-btn`, `.nk-card`, `.nk-chip`,
  `.nk-energy`, `.nk-tile`, etc.).

**Tokens MUST be used before introducing custom values.** Reach for the existing
`var(--token)` (and the `.nk-*` primitives) before writing a raw hex/oklch/rgb
color, a pixel/rem spacing value, a radius, a font size, or a shadow. Prefer the
**semantic alias** over the raw ramp (`var(--primary)`, not `var(--herb-500)`).
Introduce a new raw value only when no suitable token exists — and when you do,
consider whether it should become a token instead. Color is never the only
signal of state (pair it with text/icon); never use red=bad / green=good.

## Svelte 5 runes (forced)

Runes are enforced project-wide in `svelte.config.js`. Use `$state`, `$derived`,
`$props`, `$effect`, `{@render}` / `Snippet`. No `export let`, no `$:`, no
`createEventDispatcher`, no `<slot>`. When unsure, use the `svelte` MCP server
(`list-sections` → `get-documentation`) and the `svelte-autofixer`.

## SPA only — no server runtime

Root `src/routes/+layout.ts` sets `ssr = false` and `prerender = false`. There
are **no** `+page.server.ts` / `+layout.server.ts` / `+server.ts` files and no
server `load`. Data access is client-side via `supabase-js`
(`src/lib/supabaseClient.ts`). Anything needing secrets or privilege goes in a
Supabase **Edge Function**, not SvelteKit. Server-only TS belongs in
`src/lib/server/**` (excluded from the client test project).

## Tests (Vitest, two projects)

- **Client** project runs in a real browser (chromium) over
  `*.svelte.{test,spec}.{js,ts}`.
- **Server** project runs in node over everything else; `src/lib/server/**` is
  excluded from the client project.
- `expect.requireAssertions` is **on** — every test must make at least one
  assertion or it fails.
- Commands: `bun run test:unit` (watch), `bun run test` (unit `--run` then e2e),
  `bun run test:e2e` (Playwright).

## Formatting & lint

Prettier: **tabs**, **single quotes**, **no trailing comma**, `printWidth` 100,
with `prettier-plugin-svelte` and `prettier-plugin-tailwindcss`. A PostToolUse
hook auto-formats edited files; `bun run lint` is prettier-check + eslint,
`bun run check` is `svelte-kit sync && svelte-check`.

## Supabase / data rules

UUID PKs; `timestamptz` in UTC; RLS enabled **default-deny** before any table is
exposed; schema changes are CLI migrations (`/db-migration` skill); client types
via `bunx supabase gen types`. The anon key is **public**; the service-role key
is **server-only** (Edge Functions). Treat AI/third-party output as untrusted;
never use unchecked `{@html}`. See `docs/nexus-kitchen-invariants.md` for INV-\*.

## Tooling

Package manager is **bun** (ignore the `npm` lines in `README.md`). Supabase CLI
runs via `bunx supabase`.
