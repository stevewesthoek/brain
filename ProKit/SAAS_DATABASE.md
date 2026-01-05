Database Architecture & Automation

Audience: humans and automation (including AI assistants) that need to provision tenants, run migrations, and understand how the boilerplate talks to Postgres in development and production.

This file is the single source of truth for database behavior. Other docs defer here for database details.

1. Goals
--------

- Single logical model for local development and production.
- Single-tenant runtime: one app → one schema (`tenant_<APP_SLUG>`) → one DB user (`tenant_<APP_SLUG>_user`).
- Registry (`public.tenants`) is infra-only (provisioning/cleanup), never used by runtime.
- Scripted automation: provisioning, migrations, and cleanup run via deterministic scripts.
- Environment-safe:
  - Dev: local Docker Postgres on port 5433.
  - Prod: Supabase Postgres reachable only from Dokploy.
- AI-agnostic: any assistant should call the scripts/commands, not invent SQL.
- Optional PR previews with automatic provisioning/cleanup.

2. High-Level Design
--------------------

2.1 Postgres instances

- Each environment (development, production) uses a Postgres instance with a database named `postgres`.
- One schema per app: `tenant_<slug>`.
- One DB user per app: `tenant_<slug>_user` scoped to that schema.
- Registry table lives in `public.tenants` for infra only (provisioning/cleanup).

2.2 Environment overview

Development
- Postgres runs in Docker on `localhost:5433`.
- Apps and scripts connect directly from your machine.

Production
- Supabase Postgres on a private Azure VM (`10.0.2.4`), reachable from Dokploy over the VNet.
- No public DB access.
- Dokploy runs app containers and any migration/provisioning jobs.

2.3 Tenant types (prod vs preview)

- `type = "prod"`: real, long-lived tenants. Not deleted by automation.
- `type = "preview"`: ephemeral PR environments. Safe to auto-delete.

Registry columns (infra only):
- `slug` (e.g., `myapp`, `pr_42`)
- `schema_name` (e.g., `tenant_myapp`)
- `db_user` (e.g., `tenant_myapp_user`)
- `db_password`
- `type` (`prod` | `preview`)
- `external_id` (optional, e.g., `github:pr:42`)
- `created_at`, `updated_at`

3. Connection and Environment Model
-----------------------------------

- `DATABASE_URL`: tenant-scoped runtime connection. Only connection the app uses.
- `SYSTEM_DATABASE_URL`: admin connection for scripts (provisioning/migrations/cleanup) only.

Example:
```
.env (development)
DATABASE_URL=postgresql://tenant_demo_user:***@localhost:5433/postgres?schema=tenant_demo
SYSTEM_DATABASE_URL=postgresql://postgres:devpass@localhost:5433/postgres?schema=public

.env.production (production)
DATABASE_URL=postgresql://tenant_demo_user:***@10.0.2.4:5433/postgres?schema=tenant_demo
SYSTEM_DATABASE_URL=postgresql://postgres:prodpass@10.0.2.4:5433/postgres?schema=public
```

Responsibilities:
- Development: scripts and runtime hit `localhost:5433`. Scripts use `SYSTEM_DATABASE_URL`; runtime uses `DATABASE_URL`.
- Production: scripts run inside Dokploy using `SYSTEM_DATABASE_URL`; runtime uses `DATABASE_URL` (tenant user).

4. Provisioning and Managing Tenants
------------------------------------

Provisioning = create schema + user + registry row for a SaaS app or preview.
Cleanup = drop schema + user + registry row (preview by default).

Commands (only supported entry points):
- Provision: `npm run db:init -- --slug <slug> [--preview] [--external-id <id>]`
- Cleanup: `npm run db:cleanup -- --slug <slug> [--force]`

Implemented in `scripts/db/init-tenant.js` and `scripts/db/cleanup-tenant.js`.

4.1 Provisioning algorithm

1) Resolve slug
- Use `--slug <slug>` or `APP_SLUG`. Default to `dev` in development if none provided.
- Enforce `[a-z0-9_]+`.

2) Password
- Use `TENANT_DB_PASSWORD` in production (required).
- Default to `devpass` in development.

3) Create schema + user (idempotent)
```
CREATE SCHEMA IF NOT EXISTS tenant_<slug>;
CREATE/ALTER USER tenant_<slug>_user WITH PASSWORD '<password>';
GRANT USAGE ON SCHEMA tenant_<slug> TO tenant_<slug>_user;
ALTER ROLE tenant_<slug>_user SET search_path = tenant_<slug>;
GRANT ALL PRIVILEGES ON SCHEMA tenant_<slug> TO tenant_<slug>_user;
```

4) Registry (infra only)
- Ensure `public.tenants` exists with canonical columns.
- Upsert row: slug, schema_name, db_user, db_password, type (`prod` by default, `preview` if `--preview`), external_id (optional), timestamps.

5) Output connection URL
- Log `postgresql://tenant_<slug>_user:<password>@<host>:<port>/postgres?schema=tenant_<slug>`.
- In development, write `APP_SLUG` + `DATABASE_URL` (and set `SYSTEM_DATABASE_URL` only if missing) into `.env`.

4.2 Tenant cleanup

Command: `npm run db:cleanup -- --slug <slug> [--force]`

Algorithm:
1) Look up `public.tenants` by slug.
2) If not found: log and exit.
3) If `type != 'preview'` and no `--force`: refuse to delete.
4) Drop schema `schema_name` CASCADE.
5) Drop role `db_user` if it exists.
6) Delete registry row.

Development: runs against `localhost:5433` using `SYSTEM_DATABASE_URL`.
Production: runs inside Dokploy against Supabase using `SYSTEM_DATABASE_URL`.

4.3 Human workflow

Development
- Provision: `npm run db:init -- --slug myapp`
- Migrate: `npm run db:migrate:dev`
- Run app: `npm run dev`
- Cleanup preview: `npm run db:cleanup -- --slug pr_42`

Production
- Provision in Dokploy job: `NODE_ENV=production npm run db:init -- --slug myapp`
- Cleanup preview in Dokploy/CI: `NODE_ENV=production npm run db:cleanup -- --slug pr_42`

4.4 Preview tenants (optional)

- Slug: DB-safe (e.g., `pr_42` from PR #42).
- Type: `preview`.
- Provision: `NODE_ENV=production npm run db:init -- --slug pr_42 --preview`
- Cleanup: `NODE_ENV=production npm run db:cleanup -- --slug pr_42`

5. Migrations and Schema Sync
-----------------------------

Prisma manages schema and migrations via `prisma/system.prisma`.

Development
- Command: `npm run db:migrate:dev`
- Wraps: `prisma migrate dev --schema=prisma/system.prisma`
- Behavior: applies schema to local Postgres on `localhost:5433` and generates migrations under `prisma/migrations`.

Production
- Command: `NODE_ENV=production npm run db:migrate:prod`
- Wraps: `prisma migrate deploy --schema=prisma/system.prisma`
- Behavior: applies pending migrations to production using `DATABASE_URL` (tenant user) inside Dokploy.

Contract
- New app versions must not start without successful `db:migrate:prod`.
- No raw SQL migrations outside Prisma.
- `prisma/system.prisma` and `prisma/migrations` must stay aligned; all runtime models must exist in both.

6. MCP Bridge and Automation (optional)
---------------------------------------

- Optional RPC layer at `https://mcp.prochat.tools` (replaceable).
- Can invoke the same scripts inside Dokploy:
  - `provisionTenant(slug)` → `npm run db:init -- --slug <slug>`
  - `deployMigrations()` → `NODE_ENV=production npm run db:migrate:prod`
  - `cleanupTenant(slug)` → `NODE_ENV=production npm run db:cleanup -- --slug <slug>`
- Must not run arbitrary SQL or bypass scripts.

7. AI Contract (What AI May and May Not Do)
-------------------------------------------

AI assistants MAY:
- Propose Prisma schema changes.
- Request running `db:init`, `db:migrate:dev`, `db:migrate:prod`, `db:cleanup`.
- Use this doc and related docs for context.

AI assistants MUST NOT:
- Execute raw SQL against production.
- Change the DATABASE_URL vs SYSTEM_DATABASE_URL split.
- Create/drop schemas/users outside scripts.
- Connect to production DB from outside the VNet.

8. Guardrails and Best Practices
--------------------------------

- No direct dev → prod DB access; production reachable only from VNet.
- All schema changes go through Prisma migrations.
- `db:init -- --slug <slug>` is idempotent and safe to rerun.
- `db:cleanup -- --slug <slug>` deletes preview tenants; `--force` is required for prod tenants.
- Enforce safe slugs; never interpolate unvalidated input into SQL.
- Runtime uses tenant user via `DATABASE_URL`; scripts use `SYSTEM_DATABASE_URL`.

9. Related Documentation
------------------------

- `SAAS_INFRASTRUCTURE.md` — network layout, Dokploy, Supabase, MCP, PR previews.
- `README.md` — overview and quickstart.
- `SAAS_DEV.md` — development philosophy and guardrails.
- `SAAS_TENANT_CLEANUP.md` — cleanup SQL patterns (used by `db:cleanup`).
