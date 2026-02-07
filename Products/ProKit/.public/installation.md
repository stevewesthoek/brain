# ProKit Installation

## Prerequisites

- Node.js 20+
- Shared Supabase/Postgres instance reachable at `localhost:5433` (configurable via `POSTGRES_PORT`)

## Shared Database Rule

- Use one shared Supabase/Postgres database per environment.
- ProKit creates only a tenant schema and tenant role in that database.
- Do not create a dedicated database per app.

## Local setup (default path)

1. Ensure your shared Supabase/Postgres service is running and reachable on `localhost:5433` (or your configured `POSTGRES_PORT`).

2. Install dependencies and run:

```bash
npm install
npm run dev
```

On first run ProKit will:

- create `.env` if missing
- provision a local tenant schema/user
- run Prisma dev migrations
- start Next.js

## Configure external services (as needed)

- Clerk: set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- Stripe: set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Resend (optional): set `RESEND_API_KEY`

## Production (Dokploy)

Production deploys are tag-gated and hands-off:

1. Configure Dokploy env vars (copy from `.env.production`).
2. Add the required backup bind mount: `/var/backups/pgdump` (RW).
3. Push a semver tag `vX.Y.Z` to deploy.
