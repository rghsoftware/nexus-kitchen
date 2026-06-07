# Nexus Kitchen — Design System

A calm, shame-free design system for **Nexus Kitchen** — **inventory &amp; operations management for meals**. A planned meal is a *requirement* in one of three states (have it / can make it / need to get), and every surface exists to move it to “have it” before it's due. Built for low cognitive load: one clear action per screen, neutral language, and color that supports — never judges. Ships **light + dark**, **web/desktop + mobile**.

> Sources: product specs in `uploads/nk/` — requirements (SRS), domain specification (entities, flows, ASCII mockups), logical architecture, and invariants. The app is a shared SvelteKit SPA delivered to web, desktop (Tauri), and mobile.

---

## Index / manifest

| File | What it is |
|---|---|
| `styles.css` | Entry point — links fonts + all tokens + base classes. Consumers link this. |
| `tokens/fonts.css` | `@font-face` / Google Fonts import (Bricolage Grotesque, Hanken Grotesk) |
| `tokens/colors.css` | Color tokens + semantic aliases + **requirement-state** (have/make/acquire) + **meal-verdict** tokens + dark mode |
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
- **The requirement states (have it / can make it / need to get)** are the signature: a calm distance-from-done ramp — **sage** when a portion's ready, calm **blue** when ingredients are on hand, warm **clay** when you still need to shop. **No red, no green good-vs-bad** — a gap reads as a next step, not a failure. Tokens `--have` / `--make` / `--acquire` (+ `*-soft`, `*-text`); component `.nk-req`, tile tints `.nk-tile--have/make/acquire`. Always paired with an icon + label — color is never the only signal.
- **The meal verdict** is a *separate, retrospective* signal — state is where the meal sits in the supply chain; the verdict is how the *meal* was. A calm 3-way "How was it?" (**Again, please → Keeper** in clay · **It was fine** → quiet/neutral · **Not for me → Set aside**, in a restful periwinkle). It travels with the dish so you remember winners and don't re-cook duds. Asked once after logging, editable anytime, never required. Tokens `--verdict-keep` / `--verdict-rest`; components `.nk-verdict`, `.nk-verdict-mark`.
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
- A meal's **requirement state** is shown as a colored tile + a worded chip (“Have it”, “Can make it”, “Need to get”), never color alone.
- No emoji in the UI. *(The source ASCII mockups used emoji as shorthand; production replaces them with the Phosphor set + colored food tiles.)*
- **No-photo resilience:** food is represented by **colored tiles** (energy-tinted backgrounds + a food glyph), so the app looks complete before any user photography exists.

---

## Caveats / substitutions

- **Fonts** are Google Fonts (Bricolage Grotesque, Hanken Grotesk) loaded via CDN — no binaries are vendored. Swap to self-hosted woff2 for production/offline.
- **Icons** are Phosphor via CDN (substituted, not from a codebase — there was no existing UI). Easy to self-host or swap.
- Mockups cover the priority surfaces (planning calendar, Today, meal prep session, one-tap log, reminders, cooking mode) across web, tablet, and mobile. Other surfaces (Recipes, Pantry, Shopping, onboarding) are scaffolded in the nav but not yet designed.
