# ProKit Database

Single source of truth for database behavior in ProKit. Use this doc for provisioning, migrations, cleanup, and environment rules.

## Model summary

- One app -> one schema: `tenant_<slug>`
- One app -> one database user: `tenant_<slug>_user`
- Registry table `public.tenants` is infra-only (provision/cleanup). Runtime must not read it.
- Prisma schema is managed in `prisma/system.prisma`.

## Isolation rules (required)

- Tenant schemas must be isolated. No cross-schema foreign keys, views, or functions.
- Tenant users must not have `USAGE` or `CREATE` on `public`.
- Tenant user `search_path` must be `tenant_<slug>, pg_catalog` (no `public`).
- Runtime must never depend on `public` objects (except `pg_catalog`).

## Naming and slug contract

- The project name is the app slug.
- The app slug is the tenant schema name suffix.
- Example: project `myapp` -> `APP_SLUG=myapp` -> schema `tenant_myapp`.
- Slug must be DB-safe (`[a-z0-9_]+`).

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
- `TENANT_DB_PASSWORD` (optional override; if not set, provisioning generates one)

Examples:

```bash
# .env (development)
APP_SLUG=dev
DATABASE_URL=postgresql://tenant_dev_user:<password>@localhost:5433/postgres?schema=tenant_dev
SYSTEM_DATABASE_URL=postgresql://supabase_admin:<admin-password>@localhost:5433/postgres?schema=public

# Production (Dokploy env)
APP_SLUG=myapp
TENANT_DB_PASSWORD=<strong-password>
DATABASE_URL=postgresql://tenant_myapp_user:<TENANT_DB_PASSWORD>@10.0.2.4:5433/postgres?schema=tenant_myapp
SYSTEM_DATABASE_URL=postgresql://supabase_admin:<admin-password>@10.0.2.4:5433/postgres?schema=public
```

## Admin role contract (required)

- `SYSTEM_DATABASE_URL` always uses the Supabase admin role (`supabase_admin`).
- The admin role owns tenant schemas and can create roles, schemas, types, tables, and set role defaults.
- This is the only supported admin role for provisioning, cleanup, backups, and deploy gates.

## Tenant user contract (required)

- `DATABASE_URL` always uses `tenant_<slug>_user` with `schema=tenant_<slug>`.
- Tenant users have full DDL/DML inside their schema only.
- Tenant users have no `USAGE` or `CREATE` on `public`.

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
4. Grant privileges, revoke `public`, and set `search_path` to the tenant schema.
5. Upsert registry row in `public.tenants` (type `prod` or `preview`).
6. Generate a tenant password if one is not provided.
7. Output connection values and write files:
   - `.env` (local development)
   - `.env.production` (production reference)

## Password rules

- Provisioning generates the tenant password automatically.
- Passwords must be alphanumeric only (no special characters).
- If you override `TENANT_DB_PASSWORD`, it must follow the same rule.

## Provisioning outputs

The provisioning script must write:

- `.env` with local/dev values
- `.env.production` with production values

These files should include at minimum:

```bash
APP_SLUG=<project-name>
DATABASE_URL=postgresql://tenant_<slug>_user:<password>@<host>:<port>/postgres?schema=tenant_<slug>
SYSTEM_DATABASE_URL=postgresql://postgres:<admin-password>@<host>:<port>/postgres?schema=public
```

Use `.env.production` as the source of truth when copying variables into Dokploy.

## Cleanup flow (summary)

1. Look up tenant row in `public.tenants`.
2. Refuse to delete `type != preview` unless `--force` is provided.
3. Drop schema and user.
4. Delete registry row.

## Migrations

- Local: `db:migrate:dev` uses `prisma migrate dev --schema=prisma/system.prisma`.
- Production: `db:migrate:prod` uses `prisma migrate deploy --schema=prisma/system.prisma` and must run inside Dokploy.
- Runtime must not start without successful migrations.

## Automated migration-safe deploy (Dokploy)

ProKit includes a fully automatic deploy script that:
1. Detects pending migrations (no manual flags).
2. Creates a schema-scoped backup.
3. Runs provisioning + migrations.
4. Runs a smoke check.
5. Auto-restores on smoke failure.
6. Writes a status file for quick verification.

Scripts:
- `scripts/db/deploy-prod.sh`
- `scripts/db/verify.sh`
- `scripts/runtime/start-prod.sh` (runs the deploy gate before app start)
- `scripts/project/bootstrap.sh` (one-command provisioning)
- `scripts/project/migrate.sh` (align existing repos to ProKit)

Runtime behavior:
- `npm start` runs `scripts/runtime/start-prod.sh`, which calls the deploy gate and then starts the app.

Backup rules:
- Backup root is fixed: `/var/backups/pgdump`.
- Backups are stored under `/var/backups/pgdump/$APP_SLUG`.
- Retention: keep last 3 backups and delete any older than 14 days.
This path is a shared bind mount on the Dokploy host (no per-app volume names).

Compatibility:
- `pg_dump`/`pg_restore` must match the Postgres major version.
- Supabase is Postgres `15.x`, so install `postgresql-client-15` or use a `postgres:15` client container.
- `scripts/db/deploy-prod.sh` checks client vs server major and fails fast if the client is older.

Smoke check:
- The script uses `psql` to validate the tenant schema and `_prisma_migrations` table.
- `_prisma_migrations` must live inside the tenant schema (not `public`).

Verify:
- `APP_SLUG=<slug> ./scripts/db/verify.sh` prints the last deploy status (migrations, backup, smoke, restore).

Project bootstrap:
- `npm run prokit:bootstrap -- <slug>` provisions the tenant and writes `.env` + `.env.production`.

Project migration:
- `npm run prokit:migrate -- --apply` aligns `package.json` with the runtime gate and checks required files.

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
6. On container start, the runtime gate runs `db:init` + `db:migrate:prod` automatically.

If the runtime gate does not run (misconfigured start command), production will not receive schema changes.

## Safety rules

- Do not run raw SQL in production outside the scripts.
- Do not connect to production from a developer laptop.
- Runtime uses only `DATABASE_URL`; scripts use only `SYSTEM_DATABASE_URL`.
- Do not change the schema/user naming contract.
