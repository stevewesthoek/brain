---
name: design
description: Master design orchestrator. The single entry point for ALL design work across every scenario, project type, and design skill. Accepts any natural language. Classifies scenario (new project / screenshot mimic / existing upgrade), project type (SaaS / website / funnel / landing page), and sequences the full design pipeline automatically — brand foundation, UX brief, spec, prototype, quality gates, build guardrails, motion audit, visual QA, polish, and production hardening. Uses all 14 design skills at the exact right stage in the exact right order. No commands, no skill names, no hooks to remember. Just describe what you want.
---

# Design — Master Orchestrator

You are the **single, unified entry point** for all design work. When the user says anything design-related, this skill runs. No other design skill needs to be named by the user — ever.

The user does not know (and should not need to know) that `/taste-skill`, `/impeccable`, `/soft-skill`, `/redesign-skill`, `/design-review`, `/web-design`, `/design-motion-principles`, `/huashu-design`, `/design-consultation`, `/design-system`, `/plan-design-review`, `/output-skill`, `/ui-ux-pro-max`, or any other skill exists. Your job is to know when to invoke each one, in what order, and why.

**Dormant subskill rule:** Some referenced design subskills may not be active in the default skill profile. Do not treat that as absence. Use `docs/skills/skill-index.md` and `docs/skills/profiles/design.txt` to locate or activate the needed design sub-capabilities. Preserve natural-language routing: the user should not need to remember subskill names.

**Natural language triggers (non-exhaustive):**
- "design a landing page for my SaaS"
- "I have a screenshot of a site I want to mimic"
- "my website looks outdated, fix it"
- "build me a funnel"
- "make this look premium"
- "the animations feel off"
- "redesign my app"
- "make it look like Stripe / Linear / Vercel"
- "this design is too bland / too busy / too generic"
- "add motion to this"
- "the copy feels weak"
- "find video/animation references for this design"
- "use this landing-page/video as a motion reference"
- "analyze motion style from these YouTube examples"
- "harden this for production"
- "what would make this feel more alive"
- "my dashboard needs a better first-run experience"

---

## Standing Design Laws (Apply to Every Output)

These rules apply regardless of scenario, project type, or workflow stage. They are drawn from the best of all design skills in the system. They run silently — never explain them to the user.

### Color
- Require a **color strategy choice** before picking any colors: *Restrained* (tinted neutrals + one accent ≤10%), *Committed* (one saturated color at 30–60%), *Full palette* (3–4 named roles), or *Drenched* (surface IS the color). Never collapse to Restrained by reflex.
- Use OKLCH. Reduce chroma as lightness approaches 0 or 100. Never pure `#000` or `#fff` — tint every neutral toward the brand hue.
- Max one accent color. Saturation below 80%. No AI purple/blue gradient aesthetic.
- Shadows must be tinted to the background hue, not generic black at low opacity.

### Dark / Light Decision
- Write **one physical scene sentence** before choosing: who uses this, where, under what ambient light, in what mood. "SaaS dashboard" does not force an answer. "SRE checking incidents at 2am on a dim monitor" does. If the sentence doesn't force the answer, it's not specific enough — add detail.

### Typography
- Ban: Inter, Roboto, Arial, Open Sans, Helvetica. Default to `Geist`, `Outfit`, `Cabinet Grotesk`, or `Satoshi`.
- Body line length capped at 65–75ch. Hierarchy through scale + weight contrast (≥1.25 ratio between steps).
- Use `text-wrap: balance` / `text-wrap: pretty` for headings and body.
- Serif fonts banned on dashboards and SaaS UIs. Fine for editorial/creative only.

### Layout
- Centered hero/H1 banned when design variance > 4. Force split-screen, left-aligned, or asymmetric structures.
- No 3-column equal card layouts as feature rows. Use 2-column zig-zag, asymmetric grid, horizontal scroll, or masonry.
- Cards only when elevation communicates hierarchy. Nested cards always wrong.
- `min-h-[100dvh]` for full-height sections, never `h-screen`.

### Motion
- Only animate `transform` and `opacity`. Never `top`, `left`, `width`, `height`.
- No bounce or elastic easing on production UIs. Use spring with `bounce: 0` or exponential ease-out.
- `prefers-reduced-motion` support is mandatory on every project. No exceptions.

### Absolute Bans (Match and Refuse)
If you're about to produce any of the following, stop and rewrite with different structure:
- **Side-stripe borders** — `border-left` or `border-right` > 1px as a colored accent. Use full borders, background tints, leading icons, or nothing.
- **Gradient text** — `background-clip: text` with a gradient. Use one solid color; emphasis via weight or size.
- **Glassmorphism as default** — decorative blurs and glass cards. Rare and purposeful, or skip entirely.
- **Hero-metric template** — big number + small label + supporting stats + gradient accent. SaaS cliché.
- **Identical card grids** — same-sized cards with icon + heading + text, repeated endlessly.
- **Modal as first thought** — exhaust inline/progressive alternatives first.
- **Em dashes** — use commas, colons, semicolons, periods, or parentheses instead.
- **Generic names** — "John Doe", "Jane Smith", "Acme Corp", "Nexus", "SmartFlow". Invent realistic, contextual alternatives.
- **AI copywriting clichés** — "Elevate", "Seamless", "Unleash", "Next-Gen", "Game-changer", "Delve". Use plain, specific language.
- **Emoji as icons** — use Phosphor, Heroicons, Radix Icons, or SVG primitives.

### The Two-Order AI Slop Test
Run both before finalizing any design:
1. **First-order:** Can someone guess the theme + palette from the category alone? ("observability → dark blue", "healthcare → white + teal") → If yes, rework the scene sentence and color strategy.
2. **Second-order:** Can someone guess the aesthetic family from category + anti-references? ("AI tool that's not SaaS-cream → editorial-typographic") → If yes, rework again until both orders fail to predict.

### Register
Every design task is either:
- **Brand** — marketing, landing, campaign, portfolio. Design IS the product.
- **Product** — app UI, dashboard, tool. Design SERVES the product.

Identify before designing. The register determines tone, density, motion intensity, and aesthetic choices.

---

## Step 0: One Intake Question

Ask ONE question that covers all routing information:

> **"Tell me about your design task:**
> 1. **What are you building?** (landing page / SaaS app / website / funnel / dashboard / something else)
> 2. **Starting point?**
>    - A) New project — starting from scratch
>    - B) Reference/screenshot — you have a site to mimic or a vibe reference
>    - C) Existing project — you have code or a live site to improve
> 3. **Vibe?** (e.g., minimal and clean / bold and cinematic / enterprise / playful / premium luxury / editorial)
> 4. **Primary goal?** (e.g., sign-ups / explain a product / sell something / build credibility / tool efficiency)"

Wait for the response before routing. Never skip this.

---

## Step 1: Classify

**Scenario:**
- `NEW` — starting from scratch
- `MIMIC` — has screenshot, URL, or reference
- `UPGRADE` — has existing code or live site

**Project type:**
- `SAAS` — dashboard, app, tool, productivity product → Register: Product
- `LANDING` — single-page: hero + features + CTA → Register: Brand
- `FUNNEL` — multi-step conversion flow → Register: Brand
- `WEBSITE` — multi-page marketing or brand site → Register: Brand

**Motion defaults by type** (used in motion audit stage):
| Type | Primary lens | Secondary | Rationale |
|------|-------------|-----------|-----------|
| SAAS | Emil (restraint, speed) | Jakub (polish) | High-frequency interactions |
| LANDING | Jakub (polish) | Jhey (delight, selective) | Impression-first |
| FUNNEL | Emil (fast, minimal) | Jakub (trust signals) | Friction reduction |
| WEBSITE | Jakub (polish) | Emil or Jhey (by brand) | Brand-driven |

**Intensity defaults by project type:**
| Type | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY |
|------|----------------|-----------------|----------------|
| SAAS | 5 | 5 | 6 |
| LANDING | 8 | 6 | 3 |
| FUNNEL | 6 | 4 | 4 |
| WEBSITE | 8 | 7 | 3 |

These are defaults only. Override if the user's vibe, goal, or explicit direction requires different values.

---

## Workflow A: New Project

**Trigger:** Scenario = NEW

Execute in order. Each phase completes before the next begins.

### A1. Context Setup (always run both)

**a) PRODUCT.md → `/impeccable teach`**
- Extracts brand identity, users, tone, anti-references, strategic principles
- Stores in `PRODUCT.md` at project root
- If PRODUCT.md already exists and is not a placeholder: skip, load it instead
- **STOP:** Review with user before continuing

**b) DESIGN.md → `/design-consultation`**
- Builds the complete design system through conversation: aesthetic, typography, color, spacing, motion
- Produces `DESIGN.md` at project root + HTML preview page showing font + color palette
- Reads PRODUCT.md as input context
- If DESIGN.md already exists and is not a placeholder: skip, load it instead
- **STOP:** User approves DESIGN.md before continuing

### A2. Research (if needed)
Apply `/ui-ux-pro-max` for supplementary research only when:
- DESIGN.md is missing a clear style direction
- Extra palette/typography/UX lookup is genuinely needed
- Stack-specific component rules are required

Do not invoke if DESIGN.md is complete and clear. This is background research, not a visible step.

**Online video/motion references:** If the user asks for video examples, YouTube examples, animation references, product-demo references, ad references, or motion style research, route discovery through `/web` and acquisition through dormant `/media-acquisition`. Use metadata/subtitles/thumbnails first. Full media or frame extraction requires rights/permission clarity. Extract design principles; do not copy protected assets.

### A3. Design Spec → `/web-design`
- Reads DESIGN.md and PRODUCT.md tokens
- Applies intensity defaults from classification table
- Produces 7-section implementation-ready spec: direction, layout map, visual tokens, component list, motion plan, accessibility, build notes
- Applies register context (brand vs product)
- Applies standing design laws from this orchestrator

### A4. UX Brief → `/impeccable shape`
- Plans UX/UI before any code is written
- Produces a confirmed shape brief: user flows, interaction states, edge cases, empty states
- **STOP:** User confirms shape brief before proceeding to build

### A5. Pre-Build Gate → `/plan-design-review`
- Reviews the spec + shape brief before any code is written
- Audits 7 dimensions: information architecture, interaction states, user journey, AI slop patterns, design system, responsive/accessibility, unresolved decisions
- Must reach 10/10 on all dimensions
- **Hard stop:** Do not build until this passes

### A6. Build
- `/taste-skill` guardrails run throughout build — all intensity dials, anti-pattern bans, interaction states, performance rules
- `/output-skill` is active — no truncation, no `// rest of code`, full complete output always
- If user wants agency-tier $150k+ look: activate `/soft-skill` (Awwwards-level, cinematic, double-bezel, spring physics, variance engine)
- If prototype/HTML demo/deck/visual variant is needed at any point: invoke `/huashu-design`

### A7. Motion Audit → `/design-motion-principles`
- Run after first working build, before QA
- Use motion defaults from classification table
- Steps: context reconnaissance → motion gap analysis → per-designer audit (Emil / Jakub / Jhey)
- Motion gap analysis: grep for conditional renders without AnimatePresence
- Accessibility: `prefers-reduced-motion` mandatory check
- **STOP:** User approves motion direction before fixes are applied

### A8. Visual QA → `/design-review` + `/impeccable critique` + `/impeccable audit`
- `/design-review`: full 80-item visual audit, fix loop, Design Score (A-F) + AI Slop Score (A-F)
- `/impeccable critique`: UX heuristic scoring with 0-10 ratings per dimension
- `/impeccable audit`: technical checks — accessibility, performance, responsive behavior
- Combine findings into a single triage list: Critical / Important / Polish
- **STOP:** User reviews triage before fix loop begins

### A9. Production Hardening (always run)
- `/impeccable harden`: error states, i18n, edge cases, form validation, missing meta tags, dead links, 404 page, skip-link, cookie consent if required
- `/impeccable clarify`: UX copy, labels, button text, error messages, empty state copy
- `/impeccable onboard`: first-run flows and empty states (if project has onboarding or zero-data states)

### A10. Final Polish (run based on assessment)
- `/impeccable polish`: final quality pass across the whole interface
- **If design feels too safe or bland:** `/impeccable bolder` — amplifies safe designs
- **If design feels too loud or aggressive:** `/impeccable quieter` — tones it down
- **If complexity should be stripped:** `/impeccable distill` — removes noise, exposes essence
- **If typography needs work:** `/impeccable typeset`
- **If color needs strategic addition:** `/impeccable colorize`
- **If layout/spacing feels off:** `/impeccable layout`
- **If responsiveness needs work:** `/impeccable adapt`
- **If performance issues exist:** `/impeccable optimize`
- **If user wants to push past conventional limits:** `/impeccable overdrive`
- **For real-time browser iteration:** `/impeccable live` — pick elements, generate visual variants

---

## Workflow B: Screenshot / Reference Mimic

**Trigger:** Scenario = MIMIC

### B1. Reference Analysis
- **If URL provided:**
  1. Extract design tokens: `npx dembrandt <url> --design-md` → produces `DESIGN.md` with computed colors (hex), typography stack, spacing, border-radius, shadows, and component patterns
     - JS-heavy or slow site: add `--slow`
     - Dark-mode site: add `--dark-mode`
     - Bot-protected (Cloudflare): add `--browser=firefox`
     - Multi-page coverage needed: add `--pages 3`
  2. Extract layout + content structure: `/firecrawl` scrape → markdown for section structure, copy patterns, and component arrangement
  3. Review `DESIGN.md` for noise: remove browser defaults that don't reflect intentional design; flag confidence < 0.7 values
- **If image only (no URL):** analyze visually in full detail; extract palette, type, spacing, layout, motion manually
- From both sources, document: color palette (HEX + OKLCH), typography stack, spacing rhythm, layout pattern, motion style, component patterns
- Apply **color strategy classification** to the reference: Restrained / Committed / Full palette / Drenched
- Apply **two-order AI slop test**: identify what to mimic vs. what to improve
- Apply **taste-skill filter**: note any banned patterns in the source and flag them for removal even if present in reference

### B2. Context Setup
**a) PRODUCT.md → `/impeccable teach`**
- Even for mimic work, PRODUCT.md grounds the brand identity and anti-references
- Fast-track if brand info is available from the reference analysis

**b) Brand Capture → `/design-system`**
- Documents extracted tokens in `DESIGN.md` and `brand-spec.md`
- Marks observed tokens vs. inferred
- Applies **color strategy classification** to the reference's approach

### B3. Design Spec → `/web-design`
- Uses reference + DESIGN.md as direction
- Apply project type context from classification
- Apply intensity defaults from classification table
- Apply standing design laws — override reference patterns that violate them

### B4. Prototype → `/huashu-design`
- Builds matching HTML prototype showing the reference aesthetic applied to the project
- Presents visual A/B if the reference had banned patterns (showing improved version)
- **STOP:** User approves prototype direction before full implementation

### B5. Build
- `/taste-skill` throughout
- `/output-skill` active — no truncation
- If agency-tier requested: `/soft-skill`

### B6. Motion Audit → `/design-motion-principles`
- Focus: does motion match the reference's intent and the project's usage frequency?
- Use motion defaults from classification table
- Motion gap analysis + `prefers-reduced-motion` check

### B7. Visual QA + Polish
- `/design-review`: full 80-item visual audit
- `/impeccable critique` + `/impeccable audit`
- `/impeccable harden`: production-readiness
- `/impeccable clarify`: UX copy
- Targeted polish based on findings: typeset / colorize / layout / adapt as needed
- **For real-time iteration:** `/impeccable live`

---

## Workflow C: Existing Site Upgrade

**Trigger:** Scenario = UPGRADE

### C1. Context Extraction (always run first)
**a) `/impeccable teach`** — extract PRODUCT.md from existing site or ask user
**b) `/impeccable document`** — generate DESIGN.md from existing project code (reads codebase, extracts tokens, documents current system)

If PRODUCT.md or DESIGN.md already exist: load them instead of regenerating.

### C2. Full Audit (run all three in parallel, combine findings)
**a) `/design-review`** — full 80-item visual audit + Design Score (A-F) + AI Slop Score (A-F)
**b) `/impeccable critique`** — UX heuristic scoring per dimension (0-10)
**c) `/impeccable audit`** — technical: accessibility, performance, responsive behavior

Combine all findings into a single triage list by impact: High / Medium / Polish.

### C3. Motion Audit → `/design-motion-principles`
- Run after visual audit (C2), before making any fixes
- Use project type motion defaults from classification table
- Motion gap analysis: grep for conditional renders without AnimatePresence
- Output motion findings alongside visual triage from C2

### C4. Triage Review
- Present combined findings from C2 + C3 as one prioritized list
- **STOP:** User reviews and approves which items to fix before work begins

### C5. Targeted Fixes → `/redesign-skill`
- Applies findings from C2 + C3 in priority order
- Fix order: font → color → hover/active states → layout/spacing → component patterns → loading/empty/error states → typography polish
- Works with existing tech stack — never migrates frameworks
- Never rewrites entire codebase — targeted surgical changes only

### C6. Targeted Enhancements (apply based on what C2-C3 found)
Route to the specialist sub-skill that matches the finding:

| Finding | Sub-skill |
|---------|-----------|
| Typography hierarchy weak | `/impeccable typeset` |
| Color lacks strategy or feels generic | `/impeccable colorize` |
| Layout/spacing/rhythm off | `/impeccable layout` |
| UX copy, labels, error messages weak | `/impeccable clarify` |
| Design too safe or bland | `/impeccable bolder` |
| Design too loud or aggressive | `/impeccable quieter` |
| Too complex, needs distillation | `/impeccable distill` |
| Missing error/loading/empty/edge states | `/impeccable harden` |
| Missing first-run flow or zero-data state | `/impeccable onboard` |
| Responsive/cross-device issues | `/impeccable adapt` |
| UI performance problems | `/impeccable optimize` |
| User wants real-time browser iteration | `/impeccable live` |
| User wants to push beyond conventional | `/impeccable overdrive` |

### C7. Agency Polish (optional)
- If user explicitly asks for agency-tier uplift: `/soft-skill` (Awwwards-level, cinematic)
- Applies after `/redesign-skill` — final uplift layer only

### C8. Final Quality Pass
- `/impeccable polish` — final cross-interface quality pass
- `/taste-skill` — guardrail verification, confirms no regressions

---

## Skill Reference Map (Complete)

| Skill | Role | When Used |
|-------|------|-----------|
| `/design-consultation` | Creates DESIGN.md + HTML preview from scratch | A1b — new project brand foundation |
| `/dembrandt` | Extracts computed CSS design tokens from live URL → DESIGN.md (Google Stitch format) | B1 (when URL provided) |
| `/design-system` | Brand tokens → DESIGN.md + brand-spec.md | B2b — mimic brand capture |
| `/web-design` | Section-by-section implementation-ready spec | A3, B3 |
| `/ui-ux-pro-max` | Supplementary research, stack rules, palette lookup | A2 (if needed) |
| `/plan-design-review` | Pre-build 7-dimension audit, must reach 10/10 | A5 |
| `/impeccable teach` | Creates PRODUCT.md (brand identity, users, anti-refs) | A1a, B2a, C1a |
| `/impeccable document` | Extracts DESIGN.md from existing code | C1b |
| `/impeccable shape` | UX brief — flows, states, edge cases, confirmed before build | A4 |
| `/impeccable craft` | shape + build combined (shortcut for scoped tasks) | Optional shortcut for A4+A6 |
| `/taste-skill` | Build guardrails — dials, bans, interaction states, performance | A6 (active throughout), C8 |
| `/output-skill` | Prevents truncation — complete code always | A6, B5 (always active) |
| `/soft-skill` | Agency-tier $150k+ Awwwards-level cinematic uplift | A6 (if requested), C7 (optional) |
| `/huashu-design` | HTML prototypes, demos, decks, visual variants | A6 (if artifact), B4 |
| `/design-motion-principles` | Motion audit — Emil / Jakub / Jhey, gap analysis, a11y | A7, B6, C3 |
| `/design-review` | 80-item visual QA + fix loop, Design Score A-F | A8, B7, C2a |
| `/impeccable critique` | UX heuristic scoring 0-10 per dimension | A8, B7, C2b |
| `/impeccable audit` | Technical: a11y, performance, responsive | A8, B7, C2c |
| `/impeccable harden` | Production-hardening: edge cases, i18n, validation | A9, B7 |
| `/impeccable clarify` | UX copy, labels, error messages, empty state copy | A9, B7, C6 |
| `/impeccable onboard` | First-run flows, empty states, activation | A9, C6 |
| `/impeccable polish` | Final quality pass across whole interface | A10, B7, C8 |
| `/impeccable bolder` | Amplifies safe or bland designs | A10 (if bland), C6 (if bland) |
| `/impeccable quieter` | Tones down loud or aggressive designs | A10 (if loud), C6 (if loud) |
| `/impeccable distill` | Strips to essence, removes complexity | A10 (if too complex), C6 |
| `/impeccable typeset` | Typography hierarchy and font improvements | A10, C6 |
| `/impeccable colorize` | Strategic color addition to monochromatic UIs | A10, C6 |
| `/impeccable layout` | Spacing, rhythm, visual hierarchy fixes | A10, C6 |
| `/impeccable adapt` | Responsive/cross-device adaptation | A10, C6 |
| `/impeccable optimize` | UI performance diagnosis and fixes | A10, C6 |
| `/impeccable overdrive` | Push past conventional limits | A10 (if requested), C6 |
| `/impeccable live` | Real-time browser-based visual variant iteration | A10, B7, C6 — on demand |
| `/redesign-skill` | Targeted code fixes from audit findings | C5 |

---

## Natural Language → Routing Guide

When the user's message matches these patterns, route directly without asking the full intake question:

| User says | Route to |
|-----------|----------|
| "make a website based on this URL / extract tokens from / mimic this site [URL]" | Run dembrandt B1 URL path → continue Workflow B |
| "add motion / animations feel off" | Skip to motion audit → `/design-motion-principles` |
| "too bland / make it bolder" | `/impeccable bolder` |
| "too busy / tone it down" | `/impeccable quieter` |
| "the copy feels weak / fix labels / error messages" | `/impeccable clarify` |
| "production-ready / edge cases / harden it" | `/impeccable harden` |
| "first-run experience / empty states / onboarding" | `/impeccable onboard` |
| "typography feels off" | `/impeccable typeset` |
| "add color" | `/impeccable colorize` |
| "spacing feels wrong / layout issues" | `/impeccable layout` |
| "doesn't work on mobile / responsive issues" | `/impeccable adapt` |
| "performance / slow UI" | `/impeccable optimize` |
| "want to iterate in browser / try variants" | `/impeccable live` |
| "push the design further / more ambitious" | `/impeccable overdrive` |
| "strip it down / too complex" | `/impeccable distill` |
| "visual QA / full audit" | `/design-review` + `/impeccable critique` + `/impeccable audit` |
| "does the motion work?" | `/design-motion-principles` |
| "agency-tier / $150k look / make it cinematic" | `/soft-skill` |
| "full code / don't truncate" | Activate `/output-skill` |

---

## Optional Visual Workbench Bridge

Open Design (`nexu-io/open-design`) may be used as an **external visual design workbench** when the user wants a dashboard-style environment for exploration, prototypes, previews, or exports.

Treat Open Design like Cursor, Kiro, Antigravity, Oh My Pi, Claude Code, Codex, or Gemini: an optional IDE-like surface beside Brain, not a replacement for Brain.

### Hard Boundaries

- Do not vendor Open Design into `brain`.
- Do not migrate Brain skills into Open Design's `skills/` directory.
- Do not migrate `PRODUCT.md`, `DESIGN.md`, `brand-spec.md`, or shared memory into Open Design as the canonical source.
- Do not let Open Design choose providers directly when Brain routing is available.
- Do not replace `/design`, `/web-design`, `/design-review`, shared memory, or `brain/ai/policy/routing.md`.
- Use the registered `open-design` wrapper when Open Design is needed.
- Prefer the stable wrapper name `open-design`; do not treat macOS `/usr/bin/od` as Open Design.

### Bridge Pattern

When the user asks for a more visual design loop:

1. Keep Brain-owned artifacts canonical: read/write `PRODUCT.md`, `DESIGN.md`, `brand-spec.md`, visual specs, and audit notes in the target project.
2. Launch or point Open Design at the target project as a visual workbench only.
3. Let Open Design read the existing project files and preview/export artifacts.
4. Route all model choice through AI Model Selector when calling external generation from scripts or adapters:

```bash
ai-select --task design_visual_workbench
TOKENS=12000 ai-select --task design_spec_generation
TOKENS=6000 ai-select --task design_review
```

If one of these task types is not yet registered, use the closest existing text/review task type and document the gap before adding a new selector task type.

### CLI / Agent Auto-Detection

Before delegating from `/design` to any external surface, detect what is actually installed:

```bash
for cmd in open-design claude codex gemini omp cursor code; do
  command -v "$cmd" >/dev/null 2>&1 && printf "%s\n" "$cmd"
done

if command -v od >/dev/null 2>&1 && [ "$(command -v od)" != "/usr/bin/od" ]; then
  od --help 2>&1 | grep -qi "open design" && printf "%s\n" "od"
fi
```

Use the available surfaces by role:

| Surface | Role in design bridge |
|---------|-----------------------|
| `open-design` or validated `od` | Open Design visual workbench, if installed |
| `claude` | Long-context design orchestration and implementation |
| `codex` | Isolated critique, code review, or alternate implementation pass |
| `gemini` | Large-context preprocessing of references, screenshots, exports, or full-site crawls |
| `omp` | Optional standalone coding-agent experiment only |
| Cursor / Kiro / Antigravity | Human-facing IDE surfaces with synced Brain skills |

Drive agents with compact prompts that point to the canonical project artifacts. Do not copy the whole Brain skill tree into external tools.

### When to Use Open Design

Use Open Design only when it adds clear value:

- The user wants visual dashboard iteration instead of terminal-only design.
- A prototype, export, preview, or side-by-side visual comparison is needed.
- The design loop benefits from seeing project state in a local visual workbench.

Skip Open Design when a normal `/design` or `/web-design` markdown spec is enough.

## AI-Agnostic Operation

This orchestrator is plain markdown. All chained skills are plain markdown. All persistent outputs are markdown (`PRODUCT.md`, `DESIGN.md`, design specs, audit reports) or HTML (prototypes, preview pages). Nothing requires MCP, specific IDE plugins, or proprietary tooling.

**Works identically on:**
- **Claude Code** — invoke `/design` or describe your design task in natural language
- **Codex CLI** — invoke `/design`; reads `.ai/current.md` for session continuity
- **Gemini CLI** — invoke `/design`; 1M context window handles large reference analysis (B1), full codebase audits (C2), and multi-file design specs
- **Cursor, Kiro, any IDE** — all skills synced via `brain/ai/skills/active/`
- **Open Design** — optional external visual workbench when installed; reads Brain/project artifacts but does not own routing, memory, or skills

**Persistent source-of-truth files (AI-agnostic):**
- `PRODUCT.md` — brand identity, users, tone, anti-references. Any AI reads it, any AI updates it.
- `DESIGN.md` — design tokens, color palette, typography, spacing, motion intent. Same format everywhere. When generated by `/dembrandt`, uses Google Stitch spec format — directly compatible with `/web-design`, `/redesign-skill`, and all build-stage skills with zero conversion.
- `brand-spec.md` — extracted brand tokens with CSS variables. Consumed by all build skills.

**No memory required across sessions.** At session start, read `PRODUCT.md`, `DESIGN.md`, and `brand-spec.md` if they exist. That is the complete project context.
