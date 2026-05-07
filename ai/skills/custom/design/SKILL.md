---
name: design
description: Master design orchestrator. The single entry point for ALL design work. Accepts natural language. Detects scenario (new project / screenshot mimic / existing upgrade), project type (SaaS / website / funnel / landing page), and sequences the full design pipeline automatically — brand foundation, spec, review, motion audit, visual QA, and polish. No commands to remember. Just describe what you need.
---

# Design — Master Orchestrator

You are the **single entry point** for all design work. When the user says anything design-related — **this skill runs**. No other skill needs to be named by the user.

**Natural language triggers (non-exhaustive):**
- "design a landing page for my SaaS"
- "I have a screenshot of a site I want to mimic"
- "my website looks outdated, fix it"
- "build me a funnel"
- "make this look premium"
- "I need a design system"
- "the animations feel off"
- "redesign my app"
- "make it look like Stripe / Linear / Vercel"

---

## Step 0: Intake (One Question)

Ask ONE question that covers all routing information:

> **"Tell me about your design task:**
> 1. **What are you building?** (landing page / SaaS app / website / funnel / something else)
> 2. **Starting point?**
>    - A) New project — starting from scratch
>    - B) Reference/screenshot — you have a site you want to mimic or a vibe reference
>    - C) Existing project — you have code or a live site to improve
> 3. **Vibe?** (e.g., minimal and clean / bold and loud / enterprise / playful / premium luxury)
> 4. **Primary goal?** (e.g., sign-ups / explain a product / sell something / build credibility)"

Wait for response before routing.

---

## Step 1: Classify Scenario + Project Type

From the intake, determine:

**Scenario (pick one):**
- `NEW` — no existing code or design
- `MIMIC` — has screenshot, URL, or "like X" reference
- `UPGRADE` — has existing code or live site

**Project type (pick one):**
- `SAAS` — dashboard, app, tool, productivity product
- `LANDING` — single-page: hero + feature sections + CTA
- `FUNNEL` — multi-step conversion flow (opt-in, checkout, waitlist)
- `WEBSITE` — multi-page brand or marketing site

**Motion defaults by project type** (used when running `/design-motion-principles`):

| Type | Primary motion lens | Secondary | Rationale |
|------|--------------------|-----------| ---------|
| SAAS | Emil (restraint, speed) | Jakub (polish) | High-frequency interactions |
| LANDING | Jakub (polish) | Jhey (delight, selective) | Impression-first |
| FUNNEL | Emil (fast, minimal) | Jakub (trust signals) | Reduce friction |
| WEBSITE | Jakub (polish) | Emil or Jhey (by brand) | Brand-driven |

---

## Workflow A: New Project

**Trigger:** Scenario = NEW

Execute these steps in order. Each step completes before the next begins.

### A1. Brand Foundation → `/design-consultation`
- Builds the complete design system through conversation
- Proposes aesthetic, typography, color, spacing, motion as one coherent package
- Produces `DESIGN.md` at project root + HTML preview page
- **STOP:** User approves DESIGN.md before proceeding

### A2. Design Spec → `/web-design`
- Reads `DESIGN.md` tokens
- Produces section-by-section layout + component list + motion plan
- Output: implementation-ready spec (7 sections: direction, layout map, visual tokens, component list, motion plan, accessibility, build notes)
- Apply project type context from Step 1

### A3. Pre-Build Gate → `/plan-design-review`
- Reviews spec before any code is written
- Audits across 7 dimensions: IA, interaction states, journey, AI slop, design system, responsive/a11y, unresolved decisions
- Reaches 10/10 on all dimensions before marking complete
- Hard stop: do not build until design-review passes

### A4. Build
- Implementation by user or AI
- `/taste-skill` guardrails applied throughout
- `/output-skill` for full code generation if needed
- `/huashu-design` if prototype, HTML demo, or deck needed at any point

### A5. Motion Audit → `/design-motion-principles`
- Run after first working build
- Use project type → motion defaults table from Step 1
- Performs: context reconnaissance → motion gap analysis → per-designer audit (Emil / Jakub / Jhey)
- MANDATORY: checks `prefers-reduced-motion` support
- **STOP:** User approves motion direction before fixes are applied

### A6. Visual QA → `/design-review`
- Full 80-item visual audit on live/running site
- Phases: first impression → design system extraction → page-by-page audit → interaction flow → cross-page consistency → fix loop (atomic commits)
- Produces Design Score (A-F) + AI Slop Score (A-F)

### A7. Final Polish (optional)
- `/soft-skill` — if user wants agency-tier $150k+ look
- `/taste-skill` — final quality pass

---

## Workflow B: Screenshot / Reference Mimic

**Trigger:** Scenario = MIMIC

### B1. Reference Analysis
- If URL: scrape and screenshot with `/firecrawl`
- If image: analyze visually
- Extract and state clearly: color palette, typography, spacing rhythm, layout pattern, motion style
- Identify what to mimic vs. what to improve (apply taste-skill filter: remove AI slop even if present in source)

### B2. Brand Capture → `/design-system`
- Documents extracted tokens in `DESIGN.md` and `brand-spec.md`
- Marks observed tokens vs. inferred
- Fast-track (skip full consultation): reference is the guide

### B3. Design Spec → `/web-design`
- Uses reference + `DESIGN.md` as direction
- Applies project type context from Step 1
- `/taste-skill` guardrails applied

### B4. Prototype → `/huashu-design`
- Builds matching HTML prototype for approval before full build
- **STOP:** User approves prototype direction before full implementation

### B5. Build
- Implementation by user or AI
- `/output-skill` for full code generation if needed

### B6. Motion Audit → `/design-motion-principles`
- Focus: does motion match the reference's intent?
- Motion defaults: use project type table from Step 1
- Motion gap analysis (find conditional renders without animation)
- MANDATORY: `prefers-reduced-motion` check

### B7. Visual QA → `/design-review` (after full build)
- Same as Workflow A Step A6

---

## Workflow C: Existing Site Upgrade

**Trigger:** Scenario = UPGRADE

### C1. Current State Audit → `/design-review`
- Full visual audit on existing live site or codebase
- First impression → systematic 80-item audit → interaction flow → consistency
- Produces Design Score (A-F) + AI Slop Score (A-F)
- Triages findings by High / Medium / Polish impact
- **STOP:** User reviews triage list before fixes begin

### C2. Motion Audit → `/design-motion-principles`
- Run AFTER visual audit (C1), BEFORE making fixes
- Use project type → motion defaults table from Step 1
- Critical: motion gap analysis (finds conditional renders without AnimatePresence)
- Outputs motion findings alongside visual findings from C1

### C3. Targeted Fixes → `/redesign-skill`
- Applies findings from C1 + C2
- Fix priority: font → color → hover/active states → layout/spacing → component patterns → loading/empty/error states → typography polish
- NEVER rewrites entire codebase — targeted changes only
- Works with existing stack; never migrates frameworks

### C4. Premium Polish (optional) → `/soft-skill`
- Only if user explicitly asks for agency-tier uplift
- Applied after `/redesign-skill` — final layer only

### C5. Quality Verification → `/taste-skill`
- Final guardrail pass confirming nothing regressed

---

## Design Skill Reference (Full Map)

| Skill | Runs in | What it does |
|-------|---------|--------------|
| `/design-consultation` | A1 | Creates DESIGN.md + HTML preview from scratch via consultation |
| `/design-system` | B2, all scenarios as needed | Copies/updates DESIGN.md brand tokens |
| `/web-design` | A2, B3 | Section-by-section design spec |
| `/plan-design-review` | A3 | Pre-build 7-dimension design audit (reaches 10/10) |
| `/design-review` | A6, B7, C1 | Post-build 80-item visual QA + fix loop |
| `/design-motion-principles` | A5, B6, C2 | Motion audit via Emil / Jakub / Jhey lenses |
| `/redesign-skill` | C3 | Targeted code improvements from audit findings |
| `/taste-skill` | A4+A7, B3+B5, C5 | Premium quality guardrails (applied throughout) |
| `/soft-skill` | A7, C4 (optional) | Agency-tier $150k+ visual uplift |
| `/huashu-design` | A4, B4 | HTML-native prototypes, demos, decks, animations |
| `/output-skill` | A4, B5 | Prevents lazy code truncation |
| `/ui-ux-pro-max` | A2, B3 (supplementary) | Design pattern research, stack-specific rules |

---

## AI-Agnostic Operation

This orchestrator is plain markdown. All chained skills are plain markdown. All outputs are markdown (`DESIGN.md`, design specs, audit reports) or HTML (prototypes, preview pages). Nothing requires MCP, specific IDE plugins, or proprietary tooling.

**Works identically on:**
- **Claude Code** — invoke `/design` or talk naturally; hooks auto-inject `DESIGN.md` context via handoff system
- **Codex CLI** — invoke `/design` or natural language; reads `.ai/current.md` for session context
- **Gemini CLI** — invoke `/design`; especially useful for B1 reference analysis (1M token context window handles large screenshots and reference sites)
- **Cursor, Kiro, any IDE** — all skills synced via `brain/ai/skills/active/`

**Source of truth:** `DESIGN.md` at project root — any AI reads it, any AI updates it, same format always.

**No memory required.** Just say what you want. The orchestrator handles routing.
