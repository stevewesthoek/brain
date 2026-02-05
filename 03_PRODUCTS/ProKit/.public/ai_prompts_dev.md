# ProKit AI Prompts (Dev)

Use these prompts when working with Codex/AI inside a ProKit-based repo.

## Core rules (paste into your prompt)

```text
You are working in a ProKit-based Next.js (App Router) repo.

Non-negotiables:
- APP_SLUG must always equal the repo folder name (slug must match [a-z0-9_]+).
- Production deploys are tag-gated (git tags only).
- Production DB provisioning/migrations must be hands-off:
  - do not instruct to exec into production or run manual production commands
  - keep npm start routed through scripts/runtime/start-prod.sh (runtime deploy gate)

Scope:
- ProKit is engine-only. Do not add marketing pages, blog/SEO systems, funnels, or waiting lists.
```

## Common tasks

### Add a new table/model (Prisma)

```text
Add a new Prisma model for <thing> in prisma/system.prisma and create a migration.
Then update server code to read/write it using the Prisma client.
Do not change the deploy gate scripts.
```

### Add a new protected dashboard page

```text
Create a new page under src/app/dashboard/<route>/page.tsx.
It must be protected by Clerk middleware (unless explicitly marked public).
Follow the existing layout patterns.
```

### Add a new Stripe plan

```text
Add a new Stripe plan to src/config.ts (priceId/productId/etc) and ensure checkout uses the new priceId.
Update webhook handlers if the subscription mapping changes.
```
