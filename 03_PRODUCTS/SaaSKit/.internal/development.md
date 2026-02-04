# SaaSKit Development (ProKit engine)

This document describes the local development workflow for the SaaSKit repo.

SaaSKit is built on the ProKit engine. Some scripts are intentionally named `prokit:*` because they belong to the engine layer.

## Prerequisites

- Node.js (recommended: Node 20+)
- npm
- Docker (for local Postgres)

Local Postgres assumptions:

- Host: `localhost`
- Port: `5433`
- Admin user: `postgres`

## Quick start

```bash
npm install
npm run dev
```

Notes:

- `npm run dev` runs `predev` first.
- `predev`:
  - creates `.env` if missing (`scripts/dev/bootstrap-env.js`)
  - provisions the tenant (`npm run db:init`)
  - runs dev migrations (`npm run db:migrate:dev`)

Open:

- `http://localhost:3000`

## Local environment

The ProKit engine expects these variables:

- `APP_SLUG` must match the repo folder name (`[a-z0-9_]+`).
- `SYSTEM_DATABASE_URL` is the admin connection for provisioning/migrations.
- `SHADOW_DATABASE_URL` must be an admin connection for `prisma migrate dev`.
- `DATABASE_URL` is the tenant connection (auto-populated by `db:init`).

Typical dev `.env`:

```bash
APP_SLUG=<repo-name>
NODE_ENV=development
SYSTEM_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public
SHADOW_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public
DATABASE_URL=postgresql://tenant_<slug>_user:<password>@localhost:5433/postgres?schema=tenant_<slug>
```

## Common commands

Provision (creates schema + tenant user and writes `.env` / `.env.production`):

```bash
npm run db:init -- --slug <slug>
```

Migrate (dev):

```bash
npm run db:migrate:dev
```

Migrate (prod - do not run locally):

```bash
NODE_ENV=production npm run db:migrate:prod
```

Cleanup (drops schema + user; has safety guards):

```bash
npm run db:cleanup -- --slug <slug>
```

Engine bootstrap helper (recommended when initializing a new repo):

```bash
npm run prokit:bootstrap -- <app-slug>
```

## Editing the marketing layer (SaaSKit)

SaaSKit's home page (`/`) is composed by:

- `src/app/page.tsx`
- `src/saaskit/marketing/landing/App.tsx`

Marketing copy/config is primarily stored in:

- `src/saaskit/marketing/landing/metadata.json`

You can remove/reorder sections by editing `src/saaskit/marketing/landing/App.tsx`.

## Troubleshooting

Connection refused:

- Ensure Docker Postgres is running and port `5433` is mapped.
- Verify `SYSTEM_DATABASE_URL` points to the running container.

Shadow DB errors (Prisma):

- Set `SHADOW_DATABASE_URL` to the same admin connection as `SYSTEM_DATABASE_URL`.
- Do not use a tenant user as the shadow DB connection.

APP_SLUG mismatch:

- Rename the repo folder to match `[a-z0-9_]+`.
- Ensure `APP_SLUG` equals the repo folder name.
