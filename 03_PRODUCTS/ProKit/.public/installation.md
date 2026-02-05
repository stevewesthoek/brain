# ProKit Installation

## Prerequisites

- Node.js 20+
- Docker Desktop (or equivalent)
- PostgreSQL 15 (dev default is Docker on `localhost:5433`)

## Local setup (default path)

1. Start Postgres:

```bash
docker compose up -d postgres
```

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
- n8n (optional): configure your webhook URLs

## Production (Dokploy)

Production deploys are tag-gated and hands-off:

1. Configure Dokploy env vars (copy from `.env.production`).
2. Add the required backup bind mount: `/var/backups/pgdump` (RW).
3. Push a semver tag `vX.Y.Z` to deploy.
