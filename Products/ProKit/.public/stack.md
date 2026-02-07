# ProKit Stack

ProKit is opinionated. The goal is a boring, reliable engine for shipping SaaS apps.

## Core

- Framework: Next.js (App Router)
- Language: TypeScript
- UI: Tailwind CSS + shadcn components
- Auth: Clerk (with a safe mock mode for local dev when keys are missing)
- Database: PostgreSQL
- ORM/migrations: Prisma
- Billing: Stripe (checkout + webhooks + customer portal)

## Deployment model

- Primary: Dokploy + Nixpacks
- Release policy: tag-gated deploys (git tags only)
- Database safety: runtime deploy gate (backup + migrate + smoke check on container start)

## Optional integrations

- Email: Resend
