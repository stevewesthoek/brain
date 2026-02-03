# ProKit Development

Local development workflow for the ProKit boilerplate.

## Prerequisites

- Node.js + npm
- Docker Desktop
- Postgres container mapped to `localhost:5433`

## Quick start

```bash
npm install
npm run dev
```

`npm run dev` is expected to:
- ensure `.env` exists
- provision the tenant (via `npm run db:init`)
- run local migrations (`npm run db:migrate:dev`)
- start Next.js

If your app does not bootstrap automatically, run these manually:

```bash
npm run db:init -- --slug <slug>
npm run db:migrate:dev
npm run dev
```

## Local environment variables

```bash
APP_SLUG=dev
DATABASE_URL=postgresql://tenant_dev_user:<password>@localhost:5433/postgres?schema=tenant_dev
SYSTEM_DATABASE_URL=postgresql://postgres:<admin-password>@localhost:5433/postgres?schema=public
SHADOW_DATABASE_URL=postgresql://postgres:<admin-password>@localhost:5433/postgres?schema=public
```

## Common local commands

```bash
npm run db:init -- --slug <slug>
npm run db:migrate:dev
npm run db:cleanup -- --slug <slug>
```

## Quick troubleshooting

- Connection refused: verify Docker is running and port `5433` is mapped.
- Auth errors: confirm `.env` is loaded and `DATABASE_URL` is correct.
- Prisma drift: run `npm run db:migrate:dev` or `npx prisma migrate reset --schema=prisma/system.prisma`.
- Shadow DB error: set `SHADOW_DATABASE_URL` to the admin connection (tenant users cannot create shadow DBs).
