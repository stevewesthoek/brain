# ProKit Overview

ProKit is ProChat's **developer core boilerplate** for building SaaS apps.

It is intentionally lean: ProKit is the engine only (no marketing layer).

## Who it's for

- Developers and technical founders who want a clean SaaS engine
- Teams who want standardized auth, billing, and production-safe migrations

## What ProKit includes

- Next.js (App Router) + TypeScript
- Tailwind + shadcn UI foundation
- Clerk authentication (with a safe mock mode for local dev)
- Stripe billing (checkout + webhooks + customer portal)
- PostgreSQL + Prisma migrations with schema isolation per app (`tenant_<slug>`)
- Hands-off production deploys on Dokploy via a runtime deploy gate (backup + migrate + smoke check)
- Optional wiring for email (Resend)

## What ProKit does not include

- Marketing website pages
- SEO/blog/content systems
- Funnels, waiting lists, newsletters

## Deploy policy (important)

- Production deploys are **tag-gated** (git tags only).
- The runtime deploy gate runs provisioning + migrations automatically during container start.
- Do not run ad-hoc database commands in production.
