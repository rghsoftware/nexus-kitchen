# Nexus Kitchen — Design System

**Document Version:** 1.0
**Date:** June 4, 2026
**Source:** Design bundle produced in Claude Design (`styles.css`, `tokens/*.css`, `tokens/base.css`, `screens/*.html`, plus the Design System and Mockups showcase pages). This document is the spec; those files are the implementation.

> The design system is **stack-agnostic** — it's CSS tokens and component classes that drop straight into the SvelteKit SPA. (The bundle's own readme mentions "Tauri"; that predates the web-only decision in ADR-0001 and does not apply.)

This is the concrete realization of the visual and voice requirements: **REQ-UX-006–010** (shame-free), **REQ-VD-001–005** (visual design), **REQ-AC-001–005** (accessibility), **REQ-CFG-003** (shame-free is non-configurable).

---

## 1. Voice & Tone — calm, warm, shame-free

Shame-free is **not a setting** (REQ-CFG-003); it's embedded everywhere.

- **Second person, gentle:** "Today I feel…", "No rush — you can tweak this later."
- **Never name ADHD or clinical concepts** in the UI. Everything is framed as personal preference ("I sometimes forget to eat"). (Matches the memory principle: ADHD accommodations live in the UX, never as user-facing labels.)
- **Gaps shown without judgment** (REQ-UX-007): empty slots say "Add", never "You skipped". No streak-shaming.
- **A graceful exit ramp in every flow** (REQ-UX-009): "Skip for now", "Save & finish later", a clear close.
- **Numbers are neutral information, never a verdict** (REQ-UX-008): "Here's the nutrition, just as info."
- **Casing:** sentence case everywhere, except short ALL-CAPS section eyebrows.
- **Emoji is not UI.** Icons carry meaning and always pair with a text label.

---

## 2. The Energy Scale — the signature element

A **1–5 energy scale** rendered as a deliberately **calm cool→warm ramp**. This is what makes the app feel non-judgmental and is the core accessibility move (REQ-AC-003: color is never the only signal).

| Level | Meaning | Hue | Token |
|-------|---------|-----|-------|
| 1 | Running low | restful periwinkle | `--energy-1` |
| 2 | Low | soft blue | `--energy-2` |
| 3 | Steady | teal-sage | `--energy-3` |
| 4 | Good | green-gold | `--energy-4` |
| 5 | Energized | warm amber | `--energy-5` |

- **No red, no green, no good-vs-bad.** Low energy reads as *rest*, not failure.
- Always shown as **filled dots/cores (1–5) + a word** ("Steady", "Low") — never color alone (`.nk-energy` + `.nk-energy__dots`).
- Each level has a soft background pair (`--energy-N-soft`) for tinted surfaces and food tiles.

---

## 3. Visual Foundations

- **Palette — "Warm Kitchen, Calm Mind":** warm oat/cream paper, **garden-sage** primary (`--primary`), **clay/terracotta** accent (`--secondary`). Warm-tinted neutrals throughout (the `oat` ramp) — never cold grey.
- **Status is calm:** "expires soon" uses a warm ochre `--attention`, **never alarm-red**, always paired with icon + text (REQ-AC-003).
- **Shape:** generous soft radii (cards 14–20px, **pill** buttons), 4px spacing rhythm, lots of breathing room.
- **Elevation:** low, **warm-tinted** shadows (`--shadow-sm…xl`). Cards = 1px border + soft shadow on `--surface`.
- **Backgrounds:** flat warm paper; at most a very soft radial wash on hero surfaces. No heavy gradients or textures.
- **Motion:** quick 160ms ease (`--transition`); press = `translateY(1px) scale(0.99)`. Nothing bouncy.
- **Light + dark** both ship (REQ-VD-003); dark is a warm charcoal mirror via `[data-theme="dark"]`.

---

## 4. Tokens (the concrete values live in `tokens/*.css`)

**Type** (`typography.css`) — Bricolage Grotesque (600/700) for headings (`--font-display`); Hanken Grotesk (400–700) for body/UI (`--font-sans`). Scale runs `--text-2xs` 11px → `--text-5xl` 60px; **16px minimum body** (kitchen-readable).

**Color** (`colors.css`) — OKLCH ramps (`herb`, `clay`, `oat`, `energy-1…5`) behind semantic aliases: `--bg`, `--surface`, `--text`, `--text-secondary`, `--primary`, `--secondary`, `--attention`, `--border`, `--focus-ring`. Use the **semantic aliases**, not the raw ramps.

**Spacing & shape** (`spacing.css`) — 4px base (`--space-1…12`); radii `--radius-xs…xl` + `--radius-pill`; **`--tap-min: 44px`** (REQ-AC-002); `--container: 1240px`.

**Entry point** — consumers link `styles.css`, which pulls fonts + all tokens + `base.css`.

---

## 5. Component Vocabulary (`tokens/base.css`)

Prefixed `.nk-*`, to be ported into Svelte components (with Bits UI providing behavior/a11y where interactive):

| Class | Role |
|-------|------|
| `.nk-eyebrow` | Short ALL-CAPS section label |
| `.nk-btn` (+ `--primary` / `--secondary` / `--ghost` / `--lg` / `--sm` / `--block`) | Pill buttons; ≥44px, focus-visible ring, press-scale |
| `.nk-card` | Surface + 1px border + soft shadow |
| `.nk-chip` | Tags / filters |
| `.nk-energy` (+ `__dots`, `__dot`, `--1…5`) | The energy pill: dots + word + soft tint |
| `.nk-tile` | **Food tile** — energy-tinted background + food glyph; the no-photo fallback so the app looks complete with zero user images |
| `.nk-note` | Calm status/attention note |
| `.nk-stack` / `.nk-row` / `.nk-scroll` | Layout utilities |

---

## 6. Iconography

- **Phosphor Icons** (regular + fill) — calm, consistent line set with a matching fill weight for active states.
- **Icons always pair with a text label** (REQ-VD-004); standalone icon buttons get `aria-label`.
- **No emoji in product UI.** (The domain spec's ASCII flows use emoji as shorthand; production replaces them with Phosphor + colored food tiles.)
- **No-photo resilience:** food is represented by `.nk-tile` colored swatches, so nothing looks broken before user photography exists.

---

## 7. Screen Inventory

Designed (HTML mockups exist for web / tablet / mobile as noted):

| Surface | web | tablet | mobile |
|---------|-----|--------|--------|
| Today | ✓ | ✓ | ✓ |
| Planning calendar | ✓ | ✓ | ✓ |
| Meal prep wizard | ✓ | ✓ | ✓ |
| Energy | ✓ | — | ✓ |
| Cook mode (step / checklist) | — | ✓ | — |
| Log | — | — | ✓ |
| Reminder + reminder setup | — | — | ✓ |

**Priority flows fully worked:** planning calendar + meal prep. **Scaffolded in nav but not yet designed:** Recipes, Pantry, Shopping, onboarding. Each screen reads `?theme=light|dark`.

---

## 8. Production Notes (action items, not decisions)

- **Fonts** are Google Fonts via CDN in the mockup. **Self-host woff2** for production (performance, no third-party dependency).
- **Icons** are Phosphor via CDN. Self-host or bundle for production.
- Tokens are authored for a build that supports **OKLCH** (all current target browsers do); no fallback ramp is provided.
