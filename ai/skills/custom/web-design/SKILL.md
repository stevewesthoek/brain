---
name: web-design
description: "Design subskill for implementation-ready web, SaaS, dashboard, landing page, funnel, and marketing-site specs. Produces style direction, layout plan, visual tokens, component plan, motion plan, accessibility checks, and stack-specific build notes."
---

# Web Design

## References to load when needed
- Style catalog: `references/styles.md`
- Component map: `references/components.md`
- Public-brand DESIGN.md inspiration: `../awesome-design-md/SKILL.md` and `../awesome-design-md/references.md`
- Stack + constraints: mind/06-resources/personal-references/style.md, mind/05-areas/personal-identity/profile.md, mind/02-strategy/organisations/prochat/playbooks/saas-reference.md
- Existing prompt (AI analytics landing): `ai/prompts/webdesign.md`
- UI-UX Pro Max overview: `../ui-ux-pro-max/references/overview.md`

## Core behavior
- Design for B2B micro-SaaS, marketing funnels, and web apps.
- Align output to the fixed stack: Next.js, TypeScript, TailwindCSS, shadcn/ui.
- Avoid dark patterns or manipulative UX.

## Subskill Context

`/web-design` is a specialist subskill of `/design`. It converts product context, brand direction, and design-system inputs into an implementation-ready web spec.

- **Use `/design-system`** to establish persistent design tokens if missing
- **Use dormant `/awesome-design-md`** when a broad style direction, public-brand vibe, or concrete `DESIGN.md` inspiration would help, especially before proposing 2-3 style candidates
- **Use `/ui-ux-pro-max`** only for supplementary research (palette, type, UX rules)
- **Apply `/taste-skill` guardrails** to avoid generic patterns and maintain quality
- **Use `/redesign-skill`** instead for existing codebase improvements
- **Hand off to `/huashu-design`** when user asks for artifacts (prototype, deck, animation, export, critique)

## Default Workflow

1. **Check for `DESIGN.md`** — read existing tokens if present
2. **Check for `brand-spec.md`** — use brand-token truth if present
3. **Call `/design-system`** if brand consistency needed but no tokens exist
4. **Consult `/awesome-design-md` automatically** if no approved design truth exists and public-brand inspiration would sharpen the direction
5. **Use `/ui-ux-pro-max`** only for supplementary research
6. **Apply `/taste-skill`** quality guardrails to output
7. **Route to `/huashu-design`** if user wants artifact (prototype, deck, animation, export, critique)

## Intake (ask only what is missing)
Ask for:
- Page type: landing, SaaS app, dashboard, funnel, or marketing site.
- Goal: conversion, demo request, signup, pricing clarity, trust, etc.
- Audience + industry.
- Brand constraints: colors, typography, logo, imagery, existing site.
- Required sections or components.
- Preferred style (if any). If none, propose 2-3 from the style catalog and recommend one.

## Style selection
- Use the catalog in `references/styles.md`.
- When the user asks for a brand-like feel or has no clear style preference, use `/awesome-design-md` to choose 1 primary public-brand reference and optionally 1 contrast reference. Extract principles only; do not copy a full brand system.
- Default for SaaS/enterprise: Minimalism + Swiss (clarity).
- If user wants "modern" and "premium": suggest Glassmorphism or Liquid Glass.
- If user wants "playful": suggest Claymorphism or Vibrant + Block-Based.

## Optional UI-UX Pro Max research
Use only if DESIGN.md is missing, no clear style exists, or extra palette/typography/UX lookup is needed.

Command:
```
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "<Project Name>"
```
Apply output as supplementary research; do not let it override your style direction.

## Output format (strict)
Return a concise, implementation-ready design spec:

1) **Direction**
- One-line summary of the chosen style and why it fits.

2) **Layout map**
- Section list in order (hero, proof, features, pricing, FAQ, CTA, etc.).
- Grid system and spacing rhythm.

3) **Visual tokens**
- Color palette with CSS variables.
- Typography pairing (avoid default system stacks like Inter/Roboto/Arial unless user requests).
- Radius, shadow, border, and spacing scale.

4) **Component list**
- Key UI components (shadcn/ui + Tailwind) to use.

5) **Motion plan**
- 2-4 meaningful animations (page load, staggered reveals, marquee, etc.).
- Always include reduced-motion fallback.
- *After build: run `/design-motion-principles` for a systematic motion audit via Emil Kowalski (restraint), Jakub Krehel (polish), and Jhey Tompkins (delight) lenses — context-weighted to project type.*

6) **Accessibility checks**
- Contrast targets, focus states, keyboard path.

7) **Build notes (stack-specific)**
- Tailwind + shadcn/ui mapping and any small implementation hints.

## Templates (optional)
If the user does not specify sections, pick the closest template:
- `assets/templates/landing-page.md`
- `assets/templates/funnel-page.md`
- `assets/templates/dashboard.md`

## Implementation constraints
- Use CSS variables for theme tokens.
- Avoid generic, default-looking layouts.
- Prefer deliberate type choices and a clear visual direction.
- Use gradients, subtle patterns, or shapes for atmosphere (not flat backgrounds only).

## When to use external tools
- If shadcn MCP is available, use it to pull components.
- Use tweakcn for shadcn theming.
- Use unicorn.studio for 3D background elements if requested.

## Human-facing copy polish

When the output includes landing-page copy, SaaS messaging, CTAs, section headlines, UX copy, or marketing text, apply `operations/standards/human-writing-guardrails.md` after positioning and layout are clear.

Rules:
- Do not use polish to change the offer, audience, or claim strength.
- Replace generic SaaS language with concrete user pain and benefit.
- Avoid AI copywriting clichés such as "seamless", "elevate", "unlock", "next-gen", and "transform" unless the user's brand voice explicitly calls for them.
- Make copy sound like a founder speaking clearly to a specific buyer, not an agency template.

## Common pitfalls to avoid
- Overloading with effects; keep hierarchy clear.
- Purple-on-white defaults and generic theme choices.
- Accessibility regressions (low contrast, motion overload).
- Generic AI-sounding marketing copy that could fit any SaaS.
