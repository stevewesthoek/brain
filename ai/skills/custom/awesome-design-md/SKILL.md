---
name: awesome-design-md
description: Dormant AI-agnostic design reference library for automatically selecting public-brand DESIGN.md inspiration during broad design, web-design, reference mimic, or design-system work. Use through the design and web-design orchestrators; users should not need to invoke it manually.
---

# Awesome DESIGN.md

## What It Is

`awesome-design-md` is a dormant reference capability for using the public VoltAgent Awesome DESIGN.md collection as design inspiration.

Source:

```text
https://github.com/VoltAgent/awesome-design-md
```

The upstream repository contains public-brand `DESIGN.md` analyses for developer tools, AI platforms, SaaS products, consumer brands, fintech, retail, media, automotive, and retro web references.

## Operating Rule

This capability is automatic, not user-facing.

Users should not need to know the skill name, activate it manually, or ask for it directly. The `/design` and `/web-design` orchestrators decide when to consult this reference based on the task.

Manual invocation is allowed for maintenance or direct inspection, but normal design work must route through `/design` or `/web-design`.

## When To Use Automatically

Use this reference when any of these are true:

- The user asks for a broad design direction and no strong `DESIGN.md` exists yet.
- The user names a reference brand covered by the collection, such as Linear, Claude, Stripe, Vercel, Apple, Airbnb, Shopify, Nike, Ferrari, Notion, Supabase, or Raycast.
- The task is a `MIMIC` or vibe-reference workflow and the reference is a public brand rather than a specific URL that must be freshly analyzed.
- `/web-design` needs 2-3 style candidates grounded in concrete public-brand systems.
- `/design-system` needs inspiration for tokens, typography, component styling, or mood, but project-specific brand truth is not yet established.

## When Not To Use

Do not use this reference when:

- The project already has a complete, approved `DESIGN.md` and `brand-spec.md`.
- The user provides a specific URL or screenshot that should be analyzed directly through `/dembrandt`, `/web`, or visual inspection.
- The requested brand/reference is not represented in the upstream collection and live research would be more accurate.
- The task is product UI refinement where existing code and live QA findings are more relevant than external inspiration.
- Using a known brand too directly would create trademark, confusion, or client-identity risk.

## Selection Heuristic

Pick at most 1-3 references. Prefer one primary reference plus one contrast reference.

Use this mapping as a starting point:

- Developer platform, deployment, infra: Vercel, Linear, Supabase, HashiCorp, ClickHouse.
- AI product or AI assistant: Claude, Cohere, ElevenLabs, Mistral AI, Runway, Together AI, xAI.
- Fast productivity SaaS: Linear, Superhuman, Raycast, Notion, Cal.com.
- Trust-focused fintech or payments: Stripe, Wise, Coinbase, Mastercard, Revolut.
- Marketplace or consumer booking: Airbnb, Uber, Pinterest.
- Retail and lifestyle: Apple, Nike, Shopify, Starbucks, Spotify.
- Editorial or media: The Verge, WIRED.
- Premium/luxury automotive: BMW, Ferrari, Lamborghini, Bugatti, Tesla.
- Retro or intentionally nostalgic web: Dell 1996.

## Guardrails

Treat every upstream `DESIGN.md` as inspiration, not canonical project truth.

- Extract principles, token ranges, layout patterns, component behavior, and mood.
- Do not copy a complete brand system into a production project unless the user explicitly asks for a private/internal mimic and accepts the risk.
- Always run the design orchestrator's standing laws after applying any reference.
- Override upstream tokens that conflict with Brain design laws, accessibility, project brand truth, or legal/trademark safety.
- Flag proprietary fonts as references only; choose available or licensed alternatives.
- Convert hex colors to project-safe OKLCH variables when generating implementation tokens.

## Expected Output To Parent Orchestrator

When consulted, return a compact reference note:

```markdown
### Awesome DESIGN.md Reference Note
- Primary reference: {brand} — {why it fits}
- Optional contrast reference: {brand} — {what it prevents}
- Extracted principles: {3-6 bullets}
- Token cues: {palette/type/radius/spacing summary}
- Borrow: {what to adapt}
- Avoid: {brand-specific or banned patterns}
- Integration: {how this changes DESIGN.md or the web-design spec}
```

Do not expose this internal note unless it materially helps the user understand a design decision.

## Upstream Maintenance

The upstream collection is external and may change. If exact coverage matters, inspect the current repository before relying on a brand list:

```bash
git ls-remote https://github.com/VoltAgent/awesome-design-md.git HEAD
```

For full local inspection, clone to a temporary directory, not into `ai/skills/active/`:

```bash
rm -rf /tmp/awesome-design-md
git clone --depth 1 https://github.com/VoltAgent/awesome-design-md.git /tmp/awesome-design-md
find /tmp/awesome-design-md/design-md -mindepth 2 -maxdepth 2 -name DESIGN.md
```

Do not vendor a large upstream snapshot unless there is a deliberate maintenance decision to pin references.

