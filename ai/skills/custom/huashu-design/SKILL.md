---
name: huashu-design
description: Use for HTML-native visual production artifacts — clickable prototypes, HTML demos, slide decks, animations, infographics, visual variants, critique reports, and export-ready sources. Do not use as default web-design planning; use /web-design or /design-system for web UI specs and persistent design systems.
---

# huashu-design — HTML-Native Visual Production

**Purpose:** Turn design decisions into tangible visual artifacts. Complements `/web-design` (planning) and `/design-system` (persistent brand truth).

## Use When

- ✅ Clickable prototype or interactive demo
- ✅ HTML slide deck or presentation
- ✅ Product animation or cinematic demo video
- ✅ Infographic or data visualization
- ✅ Side-by-side visual variants or A/B comparison
- ✅ 5-dimension design critique (with visual examples)
- ✅ Export-ready source (for PDF, PNG, GIF, MP4, PPTX workflows)

## Do Not Use When

- ❌ Goal is a web/SaaS design spec only → use `/web-design`
- ❌ Goal is persistent design tokens/system → use `/design-system`
- ❌ Goal is lookup or research → use `/ui-ux-pro-max`
- ❌ Task is modifying existing code → use `/redesign-skill`
- ❌ Task is quality audit without artifact → use `/taste-skill`

## Core Rules

### 1. HTML as Native Canvas
- Design directly in HTML + CSS + JS
- Show early, iterate often
- Build visible drafts fast; verify in browser

### 2. Brand Asset Protocol
- Ask for official brand assets first
- Extract colors from real sources, never guess
- Store factual tokens in `brand-spec.md` with CSS variables
- Read `DESIGN.md` and `brand-spec.md` if present

### 3. Tool Honesty
- **Check for dependencies before use** (Playwright, ffmpeg, python-pptx, Framer Motion, etc.)
- **Never claim export success without generated files**
- **If tools are missing, produce export-ready HTML + exact commands**

### 4. Anti-Slop Quality Bar
- No generic purple AI gradients
- No emoji-as-icons; use Phosphor, Heroicons, or custom SVG
- Avoid left-border accent card pattern
- No fake SVG people/faces; use real photography placeholders
- Prefer CSS Grid for layout; use `text-wrap: pretty/balance`
- Apply `/taste-skill` guardrails

## Default Workflow

1. **Intake** — What artifact? Brand? Assets?
2. **Direction** (if vague) — Show 3 distinct visual directions; user picks
3. **Brand capture** — Ask for assets or invoke `/design-system`
4. **Build** — Generate HTML + CSS + JS; show in browser
5. **Iterate** — Refine based on feedback
6. **Verify** — Test responsiveness, interactions, performance
7. **Export** — Only if tools verified; else provide export instructions

## Reference Docs

For artifact-specific details, see:
- `references/prototypes.md` — clickable demos and device mockups
- `references/decks.md` — HTML slide decks and PPTX export caveats
- `references/animation.md` — storyboard to keyframes to HTML workflow
- `references/exports.md` — export principles and tooling checks
- `references/critique.md` — 5-dimension critique format

## Integration Points

- **Read `DESIGN.md`** if present (color, typography, spacing rules)
- **Use `brand-spec.md`** for factual brand tokens (CSS variables)
- **Call `/design-system`** if brand tokens missing but needed
- **Apply `/taste-skill`** quality guardrails to all output
- **Use `/ui-ux-pro-max`** only for supplementary style research
- **Do not override `/redesign-skill`** for code-based redesigns

## Escalate to Other Skills

- **To `/design-system`:** Project needs persistent brand system
- **To `/web-design`:** Artifact should become implementation code
- **To `/taste-skill`:** Artifact has pervasive generic AI patterns
- **To `/redesign-skill`:** Goal is improving existing codebase, not artifact

---

**Key principle:** Produce visible artifacts early. Verify in browser. Export only when tools are available. Coordinate with other design skills; do not duplicate their roles.
