# ProKit Scripts

ProKit ships a small set of scripts that make local setup and production deploys predictable.

Principle: production is hands-off. The runtime deploy gate runs automatically on container start.

## Runtime gate (production)

- `scripts/runtime/start-prod.sh`
  - Entry point for `npm start`
  - Runs the deploy gate (`scripts/db/deploy-prod.sh`) when `NODE_ENV=production`
  - If (and only if) the gate succeeds, it `exec`s `npm run start:app`

## Deploy gate (production DB lifecycle)

- `scripts/db/deploy-prod.sh`
  - Validates required env vars (`APP_SLUG`, `SYSTEM_DATABASE_URL`, `DATABASE_URL`)
  - Normalizes DB URLs for `psql` tools (strips Prisma `?schema=` query param)
  - Optionally renames a legacy tenant when `LEGACY_APP_SLUG` is set
  - Detects pending Prisma migrations
  - Takes a backup (when eligible) to `/var/backups/pgdump/$APP_SLUG`
  - Runs `npm run db:init` (provision schema/user if needed)
  - Runs `npm run db:migrate:prod` (Prisma migrate deploy)
  - Runs a smoke check
  - Restores from backup on smoke failure (when a backup exists)
  - Writes a status file: `/var/backups/pgdump/$APP_SLUG/last_run.status`

- `scripts/db/verify.sh`
  - Reads and prints the last deploy status written by the deploy gate

## DB scripts (Node.js)

- `scripts/db/init-tenant.js`
  - Provisions a tenant schema + user + registry entry
  - Writes `.env` and `.env.production`
  - Enforces `APP_SLUG == repo name` in development

- `scripts/db/rename-tenant.js`
  - Renames a tenant schema + user + registry entry
  - Dry-run by default; pass `--apply` to execute

- `scripts/db/cleanup-tenant.js`
  - Deletes a tenant schema + user + registry row
  - Refuses to delete `type=prod` tenants unless `--force` is provided

## Project helpers

- `scripts/project/bootstrap.sh`
  - One-command local bootstrap wrapper around `db:init`
  - Enforces the slug contract (repo name must equal `APP_SLUG`)

- `scripts/project/migrate.sh`
  - Aligns an existing repo to the ProKit engine contracts (runtime gate, required scripts/files)
  - Dry-run by default; pass `--apply` to execute changes

## Dev helper

- `scripts/dev/bootstrap-env.js`
  - Creates `.env` on first run (uses the repo folder name as `APP_SLUG`)
  - Sets a default `SYSTEM_DATABASE_URL` / `SHADOW_DATABASE_URL` for local Docker Postgres
