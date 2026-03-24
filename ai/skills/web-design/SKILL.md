---
name: web-design
description: Use when the user asks for web design work (landing pages, SaaS apps, dashboards, funnels, marketing sites, UX/UI direction, visual systems). Provide a style choice, layout plan, and implementation-ready design spec aligned to the Next.js + Tailwind + shadcn/ui stack. Triggers on requests like: design a landing page, web design for my SaaS, create a funnel page, dashboard UI, redesign this website, choose a visual style.
---

# Web Design

## References to load when needed
- Style catalog: `references/styles.md`
- Component map: `references/components.md`
- Stack + constraints: `personal/style.md`, `personal/profile.md`, `organisations/prochat/playbooks/saas-reference.md`
- Existing prompt (AI analytics landing): `ai/prompts/webdesign.md`
- UI-UX Pro Max overview: `../ui-ux-pro-max/references/overview.md`

## Core behavior
- Design for B2B micro-SaaS, marketing funnels, and web apps.
- Align output to the fixed stack: Next.js, TypeScript, TailwindCSS, shadcn/ui.
- Avoid dark patterns or manipulative UX.

## Default workflow (out-of-the-box)
If UI-UX Pro Max data is available, always:
1) Generate a design system with UI-UX Pro Max.
2) Apply its style + palette + typography to the output spec.
If the catalog is missing, fall back to the local style catalog.

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

## UI-UX Pro Max integration
Design-system command:
```
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "<Project Name>"
```
Then apply its style + palette + typography outputs to this spec.

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
