# SaaSKit AI Prompts (Non-Dev)

Use these prompts with an AI coding assistant to customize SaaSKit without breaking the engine contracts.

## Paste this “rules block” into every prompt

```text
You are working in a SaaSKit repo (ProKit engine + marketing layer).

Non-negotiables:
- APP_SLUG must always equal the repo folder name (slug must match [a-z0-9_]+).
- Production deploys are tag-gated (git tags only). No PR preview deploys.
- Production is hands-off:
  - do not instruct me to run commands in production
  - keep npm start routed through scripts/runtime/start-prod.sh (runtime deploy gate)
  - migrations/provisioning run automatically on deploy

Boundaries:
- ProKit is the engine: auth, billing, DB lifecycle, runtime gate, dashboard shell.
- SaaSKit is the marketing + launch layer: landing pages, blog, waiting list, funnels.
- Do not mix marketing concerns into the engine without explicit instruction.
```

## Prompt: Change my landing page copy

```text
Update src/saaskit/marketing/landing/metadata.json to match this offer:
<paste your headline, subheadline, bullets, CTA text, and FAQ>

Do not change any database, auth, or billing code.
```

## Prompt: Change the order/visibility of landing sections

```text
Edit src/saaskit/marketing/landing/App.tsx to:
- remove the <SectionName> section
- move <SectionName> below <OtherSectionName>
- keep the overall layout consistent

Do not change route structure.
```

## Prompt: Update pricing plans

```text
Update src/config.ts (config.stripe.products) with these plans:
<list plans, prices, and Stripe priceId/productId>

Ensure the checkout API continues to use priceId, not hardcoded Stripe links.
```

## Prompt: Enable the waiting list

```text
Make sure the waiting list flow is polished:
- /waiting-list page UI (uses the shared marketing header/footer)
- POST /api/waiting-list behavior and error messaging

If RESEND_API_KEY is missing, the API should return a clear 501 message.
Do not add any new providers.
```

## Prompt: Enable the blog

```text
Ensure the blog routes work cleanly:
- /blog
- /blog/[articleId]

Use WP_REST_ENDPOINT for configuration. If missing, show a helpful empty state.
Keep the marketing layout consistent across blog pages.
```

## Prompt: “I want to ship this safely”

```text
Audit the repo for production safety:
- confirm runtime deploy gate is still wired (npm start -> scripts/runtime/start-prod.sh)
- confirm Dokploy bind mount requirement is documented (/var/backups/pgdump)
- confirm tag-gated deploy flow is documented and no PR preview flow exists
Return a short checklist of what I should verify before tagging a release.
```
