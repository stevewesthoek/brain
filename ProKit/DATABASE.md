# ProKit Database

Single source of truth for database behavior in ProKit. Use this doc for provisioning, migrations, cleanup, and environment rules.

## Model summary

- One app -> one schema: `tenant_<slug>`
- One app -> one database user: `tenant_<slug>_user`
- Registry table `public.tenants` is infra-only (provision/cleanup). Runtime must not read it.
- Prisma schema is managed in `prisma/system.prisma`.

## Environments

### Development (local)
- Postgres runs in Docker on `localhost:5433`.
- Scripts and runtime connect directly from your machine.

### Production (Dokploy - primary)
- Supabase Postgres runs on a private VM at `10.0.2.4:5433`.
- Only Dokploy containers inside the VNet can reach it.
- All provisioning and migrations must run inside Dokploy (or a Dokploy-triggered job).

### Production (Vercel - limited)
- Vercel cannot reach the private Supabase VM.
- Use Vercel only if the database is publicly reachable or accessed via a secure proxy/tunnel inside the VNet.
- See `DEPLOY_VERCEL.md` for constraints.

## Connection variables

Runtime (app):
- `DATABASE_URL` (tenant user, tenant schema)

Scripts only (provision/migrate/cleanup):
- `SYSTEM_DATABASE_URL` (admin user, public schema)

Other required vars:
- `APP_SLUG` (tenant slug)
- `TENANT_DB_PASSWORD` (required in production to set tenant user password)

Examples:

```bash
# .env (development)
APP_SLUG=dev
DATABASE_URL=postgresql://tenant_dev_user:<password>@localhost:5433/postgres?schema=tenant_dev
SYSTEM_DATABASE_URL=postgresql://postgres:<admin-password>@localhost:5433/postgres?schema=public

# Production (Dokploy env)
APP_SLUG=myapp
TENANT_DB_PASSWORD=<strong-password>
DATABASE_URL=postgresql://tenant_myapp_user:<TENANT_DB_PASSWORD>@10.0.2.4:5433/postgres?schema=tenant_myapp
SYSTEM_DATABASE_URL=postgresql://postgres:<admin-password>@10.0.2.4:5433/postgres?schema=public
```

## Supported commands (only entry points)

Provision:
```bash
npm run db:init -- --slug <slug> [--preview] [--external-id <id>]
```

Migrations:
```bash
# local development
npm run db:migrate:dev

# production (run inside Dokploy)
NODE_ENV=production npm run db:migrate:prod
```

Cleanup:
```bash
npm run db:cleanup -- --slug <slug> [--force]
```

## Provisioning flow (summary)

1. Resolve slug from `--slug` or `APP_SLUG`.
2. Create schema `tenant_<slug>` if missing.
3. Create or update user `tenant_<slug>_user` with password.
4. Grant privileges and set `search_path` to the tenant schema.
5. Upsert registry row in `public.tenants` (type `prod` or `preview`).
6. Output `DATABASE_URL`. In development, write `APP_SLUG` and `DATABASE_URL` to `.env`.

## Cleanup flow (summary)

1. Look up tenant row in `public.tenants`.
2. Refuse to delete `type != preview` unless `--force` is provided.
3. Drop schema and user.
4. Delete registry row.

## Migrations

- Local: `db:migrate:dev` uses `prisma migrate dev --schema=prisma/system.prisma`.
- Production: `db:migrate:prod` uses `prisma migrate deploy --schema=prisma/system.prisma` and must run inside Dokploy.
- Runtime must not start without successful migrations.

## Schema change checklist (dev -> prod)

When you add or change tables locally:

1. Update `prisma/system.prisma`.
2. Run local migration:
   ```bash
   npm run db:migrate:dev
   ```
3. Verify locally (run the app or tests).
4. Commit the migration files under `prisma/migrations`.
5. Deploy the code to production.
6. In Dokploy, run:
   ```bash
   npm run db:init -- --slug $APP_SLUG
   NODE_ENV=production npm run db:migrate:prod
   ```

If step 6 is not executed inside Dokploy, production will not receive your schema changes.

## Safety rules

- Do not run raw SQL in production outside the scripts.
- Do not connect to production from a developer laptop.
- Runtime uses only `DATABASE_URL`; scripts use only `SYSTEM_DATABASE_URL`.
- Do not change the schema/user naming contract.
