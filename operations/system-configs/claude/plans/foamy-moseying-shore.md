# Plan: awesome-design-md Integration into Brain

## Context

User builds SaaS products (proofly, xgrow, statuslink), landing pages, funnels, and faith-based web properties (says-the-bible, openfund, Yeshua Academy) — all using Next.js + Tailwind + shadcn/ui. 

awesome-design-md provides plain-text DESIGN.md design systems (no MCP, no tokens wasted, any AI reads markdown). It becomes the default design tool. Stitch (currently active MCP in Codex) becomes explicit fallback only.

prochat.tools is the first project to receive a DESIGN.md for testing.

---

## Files to Create

1. `brain/ai/design-systems/README.md` — AI-agnostic master guide (all tools)
2. `brain/ai/design-systems/library.md` — full catalogue with descriptions, URLs, and project-type recommendations
3. `brain/ai/design-systems/custom/prochat-tools/DESIGN.md` — prochat.tools custom design system (from actual brand tokens)
4. `brain/ai/skills/custom/design-system/SKILL.md` — Claude Code `/design-system` skill
5. `brain/ai/skills/active/design-system` → symlink to `../custom/design-system`
6. `Repos/prochattools/web/prochat/DESIGN.md` — DESIGN.md in project root for testing

## Files to Modify

7. `operations/system-configs/claude/CLAUDE.md` — add `/design-system` to skills list
8. `operations/decision-log.md` — log strategic adoption of awesome-design as default
9. `ai/skills/custom/web-design/SKILL.md` — wire awesome-design as first step in workflow

---

## Step 1: brain/ai/design-systems/README.md

AI-agnostic guide. Three sections:

**For Claude Code:** use `/design-system` skill → pick design → copy DESIGN.md to project root → build with it

**For Codex:** add to AGENTS.md: "Read DESIGN.md in the project root before writing any UI code. Use its color, typography, and component rules." + reference to library.md for picking systems

**For Gemini:** preprocess DESIGN.md + user brief with Flash → compact design spec → hand to Claude/Codex for implementation

**General workflow:**
1. Pick: choose brand style from `library.md` that fits the project's vibe
2. Install: copy DESIGN.md to project root (or use custom/ for project-specific systems)
3. Use: reference in prompts — "Use DESIGN.md for all styling decisions"
4. Customize: extend with project-specific overrides in custom/ subfolder
5. Maintain: update DESIGN.md as brand evolves

---

## Step 2: brain/ai/design-systems/library.md

Full catalogue of all available design systems, organized by:

**Categories:** Productivity/SaaS, Developer Tools, Fintech, Media/Consumer Tech, E-commerce, Automotive

**Per entry:** Brand name, one-line description, URL (`https://getdesign.md/<brand>/design-md`), and **recommended project types from the user's portfolio**:

Highlights for the user's stack:
- **Linear** → SaaS dashboards, developer tools, proofly, xgrow, statuslink
- **Vercel** → API docs, developer landing pages, prochat tools
- **Stripe** → Pricing pages, checkout flows, payment-heavy projects
- **Notion** → Documentation, warm editorial sites
- **Apple** → Premium consumer sites, high-end presentations
- **Resend** → Developer-focused landing pages, minimal SaaS
- **Cal.com** → Clean neutral web apps with open-source feel
- **Airbnb** → Community/marketplace products, warm photography-driven
- **SpaceX** → Faith/inspirational sites (stark black/white, cinematic)

---

## Step 3: prochat.tools DESIGN.md

Created from actual brand tokens extracted from exploration:

- **Font:** Host Grotesk (400–700), tight tracking, 15.5px base
- **Primary:** `#4c6fff` (blue-600), `#5b7cff` (blue-500), `#3e5ae0` (blue-700 pressed)
- **Background:** `#0b1220` (dark default), `#f7f8fa` (light)
- **Text:** `#f3f5fa` (dark mode), `#101828` (light mode)
- **Glow accent:** `#6d83ff` for focus rings, AI radial effects
- **Motion:** 650ms `cubic-bezier(0.22, 1, 0.36, 1)` theme transitions
- **Vibe:** Professional SaaS, AI-product, developer-adjacent, dark-mode-first

Copy to **both**:
- `brain/ai/design-systems/custom/prochat-tools/DESIGN.md` (canonical in brain)
- `Repos/prochattools/web/prochat/DESIGN.md` (active in project)

---

## Step 4: /design-system skill (SKILL.md)

**Trigger description:** Use when starting a new web project, building a landing page, funnel, or website, or when the user asks for design/UI work. Default tool is awesome-design-md. Stitch is fallback only — never use unless user explicitly requests it.

**Body includes:**
- Role: default design orchestrator for all web UI work
- How to pick a design system (use library.md reference table)
- Per-project defaults for the user's portfolio:
  - proofly/xgrow/statuslink → Linear style
  - prochat.tools → custom prochat DESIGN.md
  - says-the-bible/openfund/Yeshua → Apple or SpaceX (cinematic, high-end)
  - New projects → ask user intent → recommend from library
- Install workflow: copy DESIGN.md → set in AGENTS.md → reference in prompts
- Integration with taste-skill, web-design, ui-ux-pro-max
- Stitch fallback rules: only when user says "use Stitch" explicitly

---

## Step 5: Symlink

```bash
ln -s ../custom/design-system brain/ai/skills/active/design-system
```

---

## Step 6: CLAUDE.md update

Add `/design-system` to skills list. Position near `/web-design`.

---

## Step 7: Decision log

Log:
- awesome-design-md is now the default design tool for all web UI work
- Stitch demoted to explicit-only fallback
- prochat.tools is the first project with a live DESIGN.md
- Library catalogued at brain/ai/design-systems/

---

## Verification

- `ls brain/ai/skills/active/design-system` — symlink resolves
- `cat brain/ai/design-systems/library.md` — library readable
- `cat Repos/prochattools/web/prochat/DESIGN.md` — DESIGN.md in project
- Skill appears in Claude Code next session
