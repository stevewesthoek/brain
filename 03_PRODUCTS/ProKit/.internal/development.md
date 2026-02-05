# ProKit Development

Local development workflow for ProKit-based apps.

This document is intentionally developer-focused (local only). Production behavior is covered in `deploy_dokploy.md` and `database.md`.

## Prerequisites

- Node.js 20+
- Docker Desktop (or equivalent)
- PostgreSQL 15 reachable at `localhost:5433` (default dev setup)

## Slug rule (required)

ProKit derives tenancy from the repo name:

- Repo folder name must match `[a-z0-9_]+`.
- `APP_SLUG` must match the repo folder name.

If you want an app slug like `my_app`, the repo folder must also be named `my_app`.

## Quick start

1. Start Postgres (default dev path):

```bash
docker compose up -d postgres
```

2. Install and run:

```bash
npm install
npm run dev
```

### What `npm run dev` is expected to do

By convention ProKit wires `predev` to bootstrap the local environment:

- Create `.env` if missing (`scripts/dev/bootstrap-env.js`)
- Provision the tenant schema/user (`npm run db:init`)
- Run dev migrations (`npm run db:migrate:dev`)
- Start Next.js (`next dev`)

If your project removed `predev`, you can always run the steps explicitly:

```bash
npm run db:init
npm run db:migrate:dev
npm run dev
```

## Local environment model

- `DATABASE_URL` is the tenant connection (tenant user, tenant schema).
- `SYSTEM_DATABASE_URL` is an admin connection used by provisioning/cleanup/backups.
- `SHADOW_DATABASE_URL` is an admin connection used by `prisma migrate dev`.

Example `.env` (development):

```bash
APP_SLUG=myapp
NODE_ENV=development

SYSTEM_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public
SHADOW_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public

# Populated by the first db:init run:
DATABASE_URL=postgresql://tenant_myapp_user:<password>@localhost:5433/postgres?schema=tenant_myapp
```

Notes:

- `SYSTEM_DATABASE_URL` / `SHADOW_DATABASE_URL` must use a role that can create schemas/roles (and create shadow databases for Prisma).
- Tenant users must never be used for `SHADOW_DATABASE_URL`.

## One-command project bootstrap

For a brand new app you can run:

```bash
npm run prokit:bootstrap -- <app-slug>
```

This wires the app slug, provisions the tenant, and generates:

- `.env` for local development
- `.env.production` as a **reference** for copying values into your production secret manager (for example Dokploy)

Do not commit `.env` or `.env.production`.

## Common local commands

```bash
# provision schema + user + env outputs
npm run db:init -- --slug <slug>

# apply dev migrations (uses SHADOW_DATABASE_URL)
npm run db:migrate:dev

# delete a tenant (preview by default; use --force to delete prod tenants)
npm run db:cleanup -- --slug <slug>

# rename a tenant schema/user/registry (dry-run by default)
npm run db:rename -- --from <old> --to <new> [--apply]
```

## Troubleshooting quick hits (dev)

- Port `5433` already allocated:
  - Stop the existing container using `5433`, or change the port mapping in `docker-compose.yml`.
- Prisma shadow DB errors:
  - Ensure `SHADOW_DATABASE_URL` is set to an admin connection (same as `SYSTEM_DATABASE_URL`).
- APP_SLUG mismatch:
  - Rename the repo folder to the slug you want, then rerun `npm run dev`.
