# SaaSKit Database (ProKit engine)

SaaSKit uses the ProKit engine multi-tenant database model.

This document is the single source of truth for database behavior: provisioning, migrations, cleanup, and environment variable contracts.

## Model summary

- One app = one tenant schema: `tenant_<slug>`
- One app = one tenant DB user: `tenant_<slug>_user`
- `public.tenants` is infra-only (provision/cleanup/auditing). Runtime must not depend on it.
- Prisma schema is managed in `prisma/system.prisma`.

## Isolation rules (required)

- Tenant schemas must be isolated. No cross-schema foreign keys, views, or functions.
- Tenant users must not have `USAGE` or `CREATE` on `public`.
- Tenant user `search_path` must be `tenant_<slug>, pg_catalog` (no `public`).
- Runtime must never depend on `public` objects (except `pg_catalog`).

## Naming + slug contract (required)

- `APP_SLUG` is the canonical identifier for the app/tenant.
- `APP_SLUG` must match the repo/project name (DB-safe): `[a-z0-9_]+`.
- Schema: `tenant_${APP_SLUG}`
- DB user: `tenant_${APP_SLUG}_user`

Notes:
- Local/dev scripts enforce `APP_SLUG == repo folder name`.
- Production should still follow the same rule for consistency and supportability.

## Environments

### Development (local)

- Postgres runs in Docker and is reachable at `localhost:5433`.
- Provision/migrations run from your machine.

### Production (Dokploy - primary)

- Dokploy containers must be able to reach the Postgres host (typically via private network).
- Provisioning, backups, migrations, and smoke checks run inside the container at startup (runtime gate).

### Production (Vercel - limited)

- Only supported if the DB is publicly reachable or accessed via a secure proxy/tunnel.
- Do not run provisioning/migrations inside Vercel (run them in Dokploy or a VNet-connected job).

## Connection variables

Runtime (app):
- `DATABASE_URL` (tenant user; `schema=tenant_<slug>`)

Scripts only (provision/migrate/cleanup):
- `SYSTEM_DATABASE_URL` (admin user; `schema=public`)

Dev-only (Prisma migrate dev):
- `SHADOW_DATABASE_URL` (admin user; `schema=public`)

Other required vars:
- `APP_SLUG`
- `PROCHAT_VERSION` (must match the deployed git tag version without `v`)

Optional vars:
- `TENANT_DB_PASSWORD` (if not set, provisioning generates one)

## Important: `?schema=` is Prisma-only

Prisma uses `?schema=tenant_<slug>` to select the tenant schema.

Postgres CLI tools (`psql`, `pg_dump`, `pg_restore`) do not accept the `schema` URI query parameter. The ProKit engine scripts normalize URLs for CLI usage by stripping `schema=...`.

## Examples

```bash
# .env (development)
APP_SLUG=saaskit
PROCHAT_VERSION=1.2.3

DATABASE_URL=postgresql://tenant_saaskit_user:<password>@localhost:5433/postgres?schema=tenant_saaskit
SYSTEM_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public
SHADOW_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public

# .env.production (reference for Dokploy)
APP_SLUG=saaskit
PROCHAT_VERSION=1.2.3

DATABASE_URL=postgresql://tenant_saaskit_user:<password>@<db-host>:<db-port>/postgres?schema=tenant_saaskit
SYSTEM_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public
TENANT_DB_PASSWORD=<password>
NODE_ENV=production
```

## Admin role contract (required)

- `SYSTEM_DATABASE_URL` must use an admin role that can create schemas/users and apply migrations.
- This admin role is the only supported identity for provisioning, cleanup, backups, and deploy gates.

## Tenant user contract (required)

- `DATABASE_URL` always uses `tenant_<slug>_user` with `schema=tenant_<slug>`.
- Tenant users have full DDL/DML inside their schema only.
- Tenant users have no `USAGE` or `CREATE` on `public`.

## Supported commands (only entry points)

Provision:
```bash
npm run db:init -- --slug <slug> [--external-id <id>] [--preview]
```

Migrations:
```bash
# local development
npm run db:migrate:dev

# production
# handled automatically by the runtime gate on deploy (Dokploy)
```

Cleanup:
```bash
npm run db:cleanup -- --slug <slug> [--force]
```

## Renaming A Tenant (APP_SLUG Change)
If you previously deployed this app under a different slug (for example `prokit`) and you want to keep the data, rename the existing tenant schema/user instead of provisioning a fresh tenant.

Recommended (production, no manual commands):
- Set `APP_SLUG=saaskit` in Dokploy.
- Set `LEGACY_APP_SLUG=prokit` for a single deployment.
- Deploy a new release tag. The runtime gate will rename the tenant before provisioning/migrations run.

Manual (development / break-glass):
Dry-run:
```bash
SYSTEM_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public \
  npm run db:rename -- --from prokit --to saaskit
```

Apply:
```bash
SYSTEM_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public \
  npm run db:rename -- --from prokit --to saaskit --apply
```

After renaming:
- Re-run provisioning to rewrite `.env`/`.env.production`: `npm run db:init`
- Local migrations: `npm run db:migrate:dev`
- Production migrations are applied automatically by the runtime gate on deploy.

## Provisioning flow (summary)

`scripts/db/init-tenant.js`:

1. Resolve slug from `--slug`, `APP_SLUG`, or (in dev) the repo folder name.
2. Create schema `tenant_<slug>` if missing.
3. Create or update user `tenant_<slug>_user` with password.
4. Enforce isolation: revoke `public`, grant tenant schema only, set `search_path`.
5. Upsert registry row in `public.tenants`.
6. Write `.env` and `.env.production`.

Written values include:

- `APP_SLUG`
- `DATABASE_URL`
- `SYSTEM_DATABASE_URL`
- `SHADOW_DATABASE_URL` (dev only)
- `TENANT_DB_PASSWORD`
- `PROCHAT_VERSION` (if set in `.env.example` or the environment)

## Password rules

- Provisioning generates the tenant password automatically if `TENANT_DB_PASSWORD` is not set.
- Passwords must be alphanumeric only (no special characters).

## Migrations

- Local: `db:migrate:dev` uses `prisma migrate dev --schema=prisma/system.prisma`.
- Production: `prisma migrate deploy --schema=prisma/system.prisma` is executed automatically by the runtime gate on deploy.

Important:
- `prisma migrate dev` requires `SHADOW_DATABASE_URL` because tenant users cannot create shadow databases.
- Do not grant `CREATEDB` to tenant users.

## Migration-safe deploy gate (Dokploy)

SaaSKit relies on the ProKit engine runtime gate:

- `npm start` runs `scripts/runtime/start-prod.sh`.
- The runtime gate runs `scripts/db/deploy-prod.sh` before starting the app.

The deploy script:

1. Detects pending migrations.
2. Creates a schema-scoped backup (`pg_dump`).
3. Runs provisioning + migrations.
4. Runs a smoke check.
5. Auto-restores from backup on smoke failure.
6. Writes a status file for quick verification.

Key scripts:

- `scripts/db/deploy-prod.sh`
- `scripts/db/verify.sh`
- `scripts/runtime/start-prod.sh`
- `scripts/project/bootstrap.sh`
- `scripts/project/migrate.sh`

Backup rules:

- Backup root: `/var/backups/pgdump`
- Backups live under `/var/backups/pgdump/$APP_SLUG`
- Retention: keep last 3 backups and delete any older than 14 days

Compatibility:

- `pg_dump`/`pg_restore` must match the Postgres major version.
- The build image must include Postgres client tools (configured via `nixpacks.toml`).

## Cleanup flow (summary)

`scripts/db/cleanup-tenant.js`:

1. Look up tenant row in `public.tenants`.
2. Refuse to delete non-preview tenants unless `--force` is provided.
3. Drop schema and user.
4. Delete registry row.

Note:
- Preview tenants are an optional safety concept in the ProKit engine DB scripts.
- SaaSKit does not use PR preview deployments.

## Safety rules

- Do not run raw SQL in production outside the scripts.
- Do not connect to production from a developer laptop.
- Runtime uses only `DATABASE_URL`; scripts use only `SYSTEM_DATABASE_URL`.
- Do not change the schema/user naming contract.
