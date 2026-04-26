# Design Stack — Six Complementary Skills

One persistent design truth (`DESIGN.md` + `brand-spec.md`), six complementary skills. Each has clear primary ownership; controlled overlap is allowed for handoffs.

---

## The Six Skills

| Skill | Role | Outputs |
|-------|------|---------|
| `/design-system` | Persistent design truth | `DESIGN.md` (9 sections) + `brand-spec.md` (CSS variables) |
| `/web-design` | Implementation-ready specs | Style + layout + tokens + components + motion + accessibility |
| `/huashu-design` | HTML-native artifacts | Prototypes, decks, animations, exports, critiques |
| `/ui-ux-pro-max` | Research support layer | Palette/typography/UX/chart/stack lookup |
| `/taste-skill` | Quality guardrails | Anti-slop rules, premium execution standards |
| `/redesign-skill` | Safe code improvement | Targeted design fixes in existing codebase |

---

## Routing Decisions

### New Web/SaaS Design Spec
→ **`/web-design`**
- Read `DESIGN.md` first (if exists)
- Use `/ui-ux-pro-max` for supplementary research only
- Output: spec, not code or artifact
- If artifact requested: hand off to `/huashu-design`

### Persistent Design System Needed
→ **`/design-system`**
- Create `DESIGN.md` (9-section reusable system)
- Create `brand-spec.md` (factual brand tokens as CSS variables)
- Use with: official brand assets (not guesses)
- Consumed by: all other skills when producing output

### HTML Artifact / Visual Production
→ **`/huashu-design`**
- Prototype, deck, animation, infographic, export, critique
- Reads `DESIGN.md` and `brand-spec.md` if present
- Tool honesty: verify export tools before claiming success
- Reference: `references/` folder for detailed workflows

### Vague "Design" Request (Ambiguous)
- **Vague design spec request** (e.g., "design a landing page") → `/web-design` style selection
- **Vague artifact request** (e.g., "show me an idea") → `/huashu-design` direction consultant
- **Vague brand/system request** (e.g., "make it cohesive") → `/design-system`

### Existing Codebase Improvement
→ **`/redesign-skill`**
- Fix generic patterns, update styling, improve interaction states
- Do not rewrite from scratch
- Test after changes; verify no breakage
- If output should be a prototype: use `/huashu-design` instead

### Design Research / Lookup
→ **`/ui-ux-pro-max`**
- Palette suggestions, typography options, UX patterns, stack guidance
- Supports other skills; does not own persistent brand truth
- Does not route, produce artifacts, or implement code

### Quality Audit / Premium Polish
→ **`/taste-skill`**
- Audit against anti-slop rules
- Enforce `/taste-skill` guardrails on output from other skills
- Does not route; applied to everything

---

## End-to-End Workflows

### New Landing Page

```
1. /design-system
   → Create DESIGN.md + brand-spec.md

2. /web-design
   → Read DESIGN.md
   → Output: style, layout, tokens, components, motion, accessibility

3. Developer or /taste-skill
   → Implement using DESIGN.md guidance
   → Apply taste-skill rules
```

### Redesign Existing Website

```
1. /redesign-skill
   → Audit existing code + design
   → Apply targeted fixes (font, colors, layout, states)
   → Verify no breakage

2. /design-system (if significant changes)
   → Document new system in DESIGN.md

3. Deploy & verify
```

### Interactive Prototype / Proof-of-Concept

```
1. /design-system (if brand matters)
   → Create or use existing DESIGN.md

2. /huashu-design
   → Build clickable prototype
   → Read DESIGN.md + brand-spec.md
   → Iterate based on feedback

3. /taste-skill (final QA)
   → Verify no generic patterns
```

### Product Demo / Launch Animation

```
1. /huashu-design
   → Storyboard key moments
   → Code animation in HTML + CSS/JS
   → Verify smooth on mobile

2. Export (if tools available)
   → Capture frames
   → Stitch into MP4 or GIF
   → Verify playback
```

### Design Critique / Audit

```
1. /huashu-design
   → Audit 5 dimensions (typography, color, layout, motion, branding)
   → Show before/after visuals
   → Document findings and quick wins

(Not the same as redesign; critique identifies issues, does not implement code)
```

---

## Persistence Rules

### DESIGN.md (Persistent System)

- 9-section format: visuals, colors, typography, components, layout, depth, do's/don'ts, responsive, agent guide
- Stored in project root
- Reusable across projects or one-off per project
- Read by all skills; modified by `/design-system` and `/redesign-skill`
- Versioned in git; shared with team

### brand-spec.md (Factual Brand Tokens)

- CSS variables (`--brand-primary`, `--brand-surface`, `--brand-text`, etc.)
- Extracted from official brand assets, never guesses
- Stored beside `DESIGN.md`
- Consumed by all skills when producing artifacts
- Source of truth for brand consistency

---

## Anti-Confusion Rules

1. **Do not duplicate brand truth.** One `DESIGN.md`, one `brand-spec.md`; all skills link to, not copy.

2. **Do not claim exports without tools.** If Playwright/ffmpeg/python-pptx missing, provide export-ready source + commands.

3. **Do not make artifacts in `/web-design`.** It produces specs, not prototypes. Route to `/huashu-design`.

4. **Do not use `/ui-ux-pro-max` as main router.** It is research support, not decision-maker.

5. **Do not skip `/design-system` for persistent projects.** Even one-off brands need documented tokens.

6. **Do not use `/taste-skill` as entry point.** It is a quality layer, applied on top of other skills' work.

7. **Do not redesign code with `/huashu-design`.** Use `/redesign-skill` for code changes; use `/huashu-design` for prototypes/artifacts.

---

## Quick Decision Tree

```
Does the project need persistent design tokens, or lack DESIGN.md/brand-spec.md with brand consistency needed?
  → Yes: /design-system
  → No: Continue

Is it a visual artifact (prototype, deck, animation, export)?
  → Yes: /huashu-design
  → No: Continue

Is it an implementation-ready web UI spec?
  → Yes: /web-design
  → No: Continue

Is it existing code that needs improvement?
  → Yes: /redesign-skill
  → No: Continue

Is it research, lookup, or pattern reference?
  → Yes: /ui-ux-pro-max
  → No: Apply /taste-skill as quality bar to results
```

---

## Summary

- **One persistent truth:** `DESIGN.md` + `brand-spec.md`
- **Clear boundaries:** Each skill has one role; no overlap
- **Safe handoffs:** Skills coordinate; never duplicate
- **Tool honesty:** Export tools verified; export-ready fallback always provided
- **Quality everywhere:** `/taste-skill` applied to all output

Every design task maps to exactly one primary skill. Coordinate across skills as needed.
