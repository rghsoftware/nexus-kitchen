---
name: nexus-kitchen-design
description: Use this skill to generate well-branded interfaces and assets for Nexus Kitchen, a calm, shame-free, energy-aware meal-planning app, either for production or throwaway prototypes/mocks. Contains design guidelines, color + energy-scale tokens, type, and shared component classes.
user-invocable: true
---

Read `readme.md` in this skill, then explore the token files (`styles.css`, `tokens/*.css`) and the example screens (`screens/*.html`, the two showcase HTML files).

Core rules to honor for this brand:
- **Shame-free voice is non-negotiable.** Neutral framing, gaps without judgment, a graceful exit ramp in every flow, never name ADHD/clinical concepts. See readme "Content fundamentals".
- **The energy scale (1–5) is a calm cool→warm ramp — never red/green good-vs-bad.** Low energy = rest, not failure. Use `--energy-1…5` tokens.
- **Color is never the only signal of state.** Icons always pair with text labels; status uses warm ochre `--attention`, never alarm-red.
- **Warm, generous, legible:** oat paper + sage primary + clay accent, Bricolage Grotesque headings + Hanken Grotesk body, pill buttons, soft radii, ≥44px hit targets, light + dark.

If creating visual artifacts (mocks, prototypes, slides), copy assets/tokens out and produce static HTML that links `styles.css`. If working on production code, lift the tokens and rules directly. If invoked without guidance, ask what to build, ask a few questions, and act as an expert designer who outputs HTML or production code.
