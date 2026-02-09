# ProKit Database

Single source of truth for database behavior in ProKit.

This doc defines provisioning, migrations, cleanup, and the environment contracts used by the runtime deploy gate.

## Model summary

- One app -> one tenant schema: `tenant_<slug>`
- One app -> one tenant DB user: `tenant_<slug>_user`
- Registry table `public.tenants` is **scripts-only** (provision/cleanup). The runtime app must not depend on it.
- Prisma schema is managed in `prisma/system.prisma` (single schema file).

## Shared database rule (required)

- Exactly one Supabase/Postgres database is used per environment (dev and prod).
- All apps in that environment use that same database.
- App isolation is schema/role only: `tenant_<slug>` + `tenant_<slug>_user`.
- Never create a dedicated database per app.
- `db:init` must never run `CREATE DATABASE`; it only manages schema, role, grants, and tenant registry metadata in the already-existing shared database.

## Isolation rules (required)

- Tenant schemas must be isolated. No cross-schema foreign keys, views, or functions.
- Tenant users must not have `USAGE` or `CREATE` on `public`.
- Tenant user `search_path` must be `tenant_<slug>, pg_catalog` (no `public`).
- Runtime must never depend on `public` objects (except `pg_catalog`).

## Naming and slug contract

- The repo/project name is the app slug.
- `APP_SLUG` must match the repo folder name (required).
- Example: repo `myapp` -> `APP_SLUG=myapp` -> schema `tenant_myapp`.
- Slug must be DB-safe: `[a-z0-9_]+`.

If you rename a repo that already has data, use the rename flow (`db:rename`), or set `LEGACY_APP_SLUG` for a one-time automated rename on the next production deploy (see below).

## Environments

### Development (local)
- Default dev Postgres runs in Docker on `localhost:5433` (configurable via `POSTGRES_PORT`).
- Provisioning/migrations run locally as part of `npm run dev` (via `predev`) or explicitly via `npm run db:*`.

### Production (Dokploy - primary)
- Postgres is reachable from the Dokploy app container (often via a private network).
- Provisioning, migrations, backup, and verification are executed automatically by the runtime deploy gate at container start.

### Production (Vercel - limited)
- Vercel is supported only when your database is publicly reachable or accessed via a secure proxy/tunnel.
- ProKit's primary production path is Dokploy.

## Connection variables

Runtime (app):
- `DATABASE_URL` (tenant user, tenant schema)

Scripts only (provision/migrate/cleanup):
- `SYSTEM_DATABASE_URL` (admin connection; used for provisioning, backups, cleanup)

Dev-only (Prisma migrate dev):
- `SHADOW_DATABASE_URL` (admin connection). Required because tenant users cannot create Prisma shadow databases.

Other required vars:
- `APP_SLUG` (tenant slug)
- `TENANT_DB_PASSWORD` (optional override; if not set, provisioning generates one)

Notes:

- ProKit uses Prisma's `?schema=` connection parameter in `DATABASE_URL`. `psql` tools do not understand `schema=...`; ProKit scripts automatically strip it when calling `psql`/`pg_dump`/`pg_restore`.

Example `.env` (development):

```bash
APP_SLUG=myapp
NODE_ENV=development
POSTGRES_PORT=5433

SYSTEM_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public
SHADOW_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres?schema=public

DATABASE_URL=postgresql://tenant_myapp_user:<password>@localhost:5433/postgres?schema=tenant_myapp
```

## Admin connection contract (required)

`SYSTEM_DATABASE_URL` must be an admin connection that can:

- create schemas
- create/alter roles
- grant/revoke privileges
- run backups (`pg_dump`) and restores (`pg_restore`)

## Tenant user contract (required)

- `DATABASE_URL` always uses `tenant_<slug>_user` with `schema=tenant_<slug>`.
- Tenant users have full DDL/DML inside their schema only.
- Tenant users have no `USAGE` or `CREATE` on `public`.

## Entry points (supported commands)

These are the only supported entry points for DB lifecycle management in ProKit:

```bash
npm run db:init -- --slug <slug> [--external-id <id>]
npm run db:migrate:dev
npm run db:cleanup -- --slug <slug> [--force]
npm run db:rename -- --from <old> --to <new> [--apply]
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

Invariant: provisioning always targets the existing database from `SYSTEM_DATABASE_URL` (normally `/postgres`) and never creates a new database in dev or prod.

## Password rules

- Provisioning generates the tenant password automatically.
- Passwords must be alphanumeric only (no special characters).
- If you override `TENANT_DB_PASSWORD`, it must follow the same rule.

## Provisioning outputs

The provisioning script must write:

- `.env` with local/dev values
- `.env.production` as a reference output for copying values into your production secret manager (for example Dokploy)

These files should include at minimum:

```bash
APP_SLUG=<project-name>
DATABASE_URL=postgresql://tenant_<slug>_user:<password>@<host>:<port>/postgres?schema=tenant_<slug>
SYSTEM_DATABASE_URL=postgresql://<admin-user>:<admin-password>@<host>:<port>/postgres
```

Use `.env.production` as the source of truth when copying variables into Dokploy.

## Cleanup flow (summary)

1. Look up tenant row in `public.tenants`.
2. Refuse to delete `type != preview` unless `--force` is provided.
3. Drop schema and user.
4. Delete registry row.

Note: Preview tenants are not part of the standard production flow. Keep the safety guard intact.

## Migrations

- Local: `db:migrate:dev` uses `prisma migrate dev --schema=prisma/system.prisma`.
- Production: `db:migrate:prod` uses `prisma migrate deploy --schema=prisma/system.prisma` and is invoked automatically by the runtime deploy gate.
- The runtime must not start without successful migrations.
Note: `prisma migrate dev` requires `SHADOW_DATABASE_URL` because tenant users cannot create shadow databases. Do not grant `CREATEDB` to tenant users.

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
- `scripts/project/bootstrap.sh` (one-command local bootstrap)
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

## Migration state mismatch (production)

If the deploy gate fails with one of these:

- `[deploy] detected migrations: yes (migrations_table_missing)`
- `db has migrations not present on disk: ...`

it means the tenant schema is not in the expected state for this repo. This can happen if:

- migrations were squashed/removed in git, or
- you reused an existing tenant schema from another app/repo.

Fix options:

1. Reset the tenant schema (data loss): set `PROKIT_RESET_TENANT_ON_MIGRATION_MISMATCH=1` in Dokploy env and redeploy a tag.
2. Keep data: restore the missing migration directories on disk (must match checksums).

## Legacy rename (repo slug changes)

If you renamed the repo/app slug and want to keep the existing data:

- Preferred (dev): run `npm run db:rename ...` against the target database.
- Production hands-off path: set `LEGACY_APP_SLUG=<old_slug>` in Dokploy env for the next deploy.
  - The deploy gate will detect the old tenant schema (`tenant_<old_slug>`) and rename it to the new slug if the target schema does not already exist.
  - Remove `LEGACY_APP_SLUG` after a successful deploy.
