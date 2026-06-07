# Nexus Kitchen — Design System

A calm, shame-free design system for an **energy-aware meal-planning app**. Built for low cognitive load: one clear action per screen, neutral language, and color that supports — never judges. Ships **light + dark**, **web/desktop + mobile**.

> Sources: product specs in `uploads/nk/` — requirements (SRS), domain specification (entities, flows, ASCII mockups), logical architecture, and invariants. The app is a shared SvelteKit SPA delivered to web, desktop (Tauri), and mobile.

---

## Index / manifest

| File | What it is |
|---|---|
| `styles.css` | Entry point — links fonts + all tokens + base classes. Consumers link this. |
| `tokens/fonts.css` | `@font-face` / Google Fonts import (Bricolage Grotesque, Hanken Grotesk) |
| `tokens/colors.css` | Color tokens + semantic aliases + **energy scale** + dark mode |
| `tokens/typography.css` | Type families, scale, weights, leading, tracking |
| `tokens/spacing.css` | Spacing, radii, hit-target, transitions |
| `tokens/base.css` | Shared component classes (`.nk-btn`, `.nk-card`, `.nk-chip`, `.nk-energy`, …) |
| `Nexus Kitchen — Design System.html` | **Foundations showcase** — color, energy scale, type, components, voice |
| `Nexus Kitchen — Mockups.html` | **Presentation board** — both flows, web + mobile, light + dark |
| `screens/web-calendar.html` | Meal planning calendar (desktop) |
| `screens/web-prep.html` | Meal prep session wizard (desktop) |
| `screens/mobile-calendar.html` | Day-focused planning (phone) |
| `screens/mobile-prep.html` | Prep wizard (phone) |

Each screen reads `?theme=light|dark` from its URL.

---

## Content fundamentals (voice & tone)

The voice is **calm, warm, and shame-free** — and shame-free is *not configurable*, it's embedded everywhere (REQ-CFG-003, REQ-UX-006–010).

- **Person:** second person, gentle ("Today I feel…", "No rush — you can tweak this later").
- **Never** name ADHD or clinical concepts in the UI — everything is framed as a personal preference ("I sometimes forget to eat").
- **Gaps shown without judgment.** Empty meal slots say "Add", never "You skipped". No streak-shaming; "breaks are fine".
- **Every flow has a graceful exit ramp** — "Skip for now", "Save & finish later", a clear close.
- **Numbers are neutral information**, never a verdict ("Here's the nutrition, just as info").
- **Casing:** sentence case for everything except short ALL-CAPS section eyebrows (tracked).
- **Emoji:** not used as UI. Iconography carries meaning; icons always pair with a text label.

See the Voice & tone section of the showcase for a do/don't table.

## Visual foundations

- **Palette — "Warm Kitchen, Calm Mind":** warm oat/cream paper, a calm **garden-sage** primary (`--primary`), a **clay/terracotta** accent (`--secondary`). Warm-tinted neutrals throughout (oat ramp), never cold grey.
- **The energy scale (1–5)** is the signature: a deliberately **calm cool→warm ramp** — restful periwinkle at 1 → warm amber at 5. **No red, no green good-vs-bad.** Low energy reads as *rest*, not failure. Tokens `--energy-1…5` + soft backgrounds `--energy-*-soft`.
- **Status is calm:** "expires soon" uses a warm ochre `--attention`, **never alarm-red**, and always pairs with an icon + text (color is never the only signal — REQ-VD-004 / accessibility).
- **Type:** Bricolage Grotesque (700/600) for warm, confident headings; Hanken Grotesk (400–700) for body & UI. Minimum 16px body in product; large, kitchen-readable.
- **Shape:** generous, soft radii (cards 14–20px, **pill** buttons). 4px spacing rhythm with lots of breathing room.
- **Elevation:** low, **warm-tinted** shadows (sm→xl). Cards = 1px border + soft shadow on `--surface`.
- **Backgrounds:** flat warm paper, optional very soft radial wash on hero surfaces. No heavy gradients, no textures.
- **Motion:** quick (160ms) ease for hovers; press = subtle scale-down. Nothing bouncy or attention-grabbing.
- **Hit targets:** ≥ 44px everywhere (`--tap-min`).
- **Hover:** soft surface fill / `--primary-soft`. **Press:** `translateY(1px) scale(0.99)`.

## Iconography

- **Phosphor Icons** (regular + fill), loaded from CDN — clean, calm, consistent line set with a matching fill weight for active/emphasis states.
- **Icons always pair with a text label** in product UI (REQ-VD-004). Standalone icon buttons get `aria-label`.
- Energy is shown as **dots/cores filled 1–5** plus a word ("Steady", "Low"), never color alone.
- No emoji in the UI. *(The source ASCII mockups used emoji as shorthand; production replaces them with the Phosphor set + colored food tiles.)*
- **No-photo resilience:** food is represented by **colored tiles** (energy-tinted backgrounds + a food glyph), so the app looks complete before any user photography exists.

---

## Caveats / substitutions

- **Fonts** are Google Fonts (Bricolage Grotesque, Hanken Grotesk) loaded via CDN — no binaries are vendored. Swap to self-hosted woff2 for production/offline.
- **Icons** are Phosphor via CDN (substituted, not from a codebase — there was no existing UI). Easy to self-host or swap.
- Mockups cover the **two priority flows you chose** (meal planning calendar + meal prep session). Other surfaces (Today, Recipes, Pantry, Shopping, onboarding) are scaffolded in the nav but not yet designed.
