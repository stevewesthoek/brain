---
name: web-design
description: "Use when the user asks for web design work (landing pages, SaaS apps, dashboards, funnels, marketing sites, UX/UI direction, visual systems). Provide a style choice, layout plan, and implementation-ready design spec aligned to the Next.js + Tailwind + shadcn/ui stack. Triggers on requests such as: design a landing page, web design for my SaaS, create a funnel page, dashboard UI, redesign this website, choose a visual style."
---

# Web Design

## References to load when needed
- Style catalog: `references/styles.md`
- Component map: `references/components.md`
- Stack + constraints: mind/06-resources/personal-references/style.md, mind/05-areas/personal-identity/profile.md, mind/02-strategy/organisations/prochat/playbooks/saas-reference.md
- Existing prompt (AI analytics landing): `ai/prompts/webdesign.md`
- UI-UX Pro Max overview: `../ui-ux-pro-max/references/overview.md`

## Core behavior
- Design for B2B micro-SaaS, marketing funnels, and web apps.
- Align output to the fixed stack: Next.js, TypeScript, TailwindCSS, shadcn/ui.
- Avoid dark patterns or manipulative UX.

## Skill Routing

- **Use `/design-system`** to establish persistent design tokens if missing
- **Use `/ui-ux-pro-max`** only for supplementary research (palette, type, UX rules)
- **Apply `/taste-skill` guardrails** to avoid generic patterns and maintain quality
- **Use `/redesign-skill`** instead for existing codebase improvements
- **Hand off to `/huashu-design`** when user asks for artifacts (prototype, deck, animation, export, critique)

## Default Workflow

1. **Check for `DESIGN.md`** — read existing tokens if present
2. **Check for `brand-spec.md`** — use brand-token truth if present
3. **Call `/design-system`** if brand consistency needed but no tokens exist
4. **Use `/ui-ux-pro-max`** only for supplementary research
5. **Apply `/taste-skill`** quality guardrails to output
6. **Route to `/huashu-design`** if user wants artifact (prototype, deck, animation, export, critique)

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

## Common pitfalls to avoid
- Overloading with effects; keep hierarchy clear.
- Purple-on-white defaults and generic theme choices.
- Accessibility regressions (low contrast, motion overload).
