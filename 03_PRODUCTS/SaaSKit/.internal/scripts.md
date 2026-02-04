# SaaSKit Scripts (ProKit engine)

SaaSKit uses the ProKit engine runtime/deploy scripts.

Rule:
- Do not bypass the runtime gate in production.
- In Dokploy, the container must start with `npm start`.

## Runtime gate (production)

- `scripts/runtime/start-prod.sh`
  - Validates required env vars.
  - Validates the Dokploy backup bind mount exists and is writable.
  - Runs the deploy gate: `scripts/db/deploy-prod.sh`.
  - Then starts the real app via `npm run start:app`.

## Deploy gate (production)

- `scripts/db/deploy-prod.sh`
  - Detects pending migrations.
  - Takes a schema-scoped `pg_dump` backup.
  - Runs provisioning (`npm run db:init`).
  - Applies migrations (`NODE_ENV=production npm run db:migrate:prod`).
  - Runs a smoke check.
  - Auto-restores from backup on smoke failure.
  - Writes a status file under `/var/backups/pgdump/$APP_SLUG/last_run.status`.

- `scripts/db/verify.sh`
  - Prints the last deploy status from the status file.

## Provisioning + cleanup

- `scripts/db/init-tenant.js`
  - Creates/updates the tenant schema and user.
  - Enforces tenant isolation.
  - Writes `.env` and `.env.production`.

- `scripts/db/cleanup-tenant.js`
  - Drops tenant schema and user.
  - Has safety guards to prevent accidental deletion.

## Project helpers

- `scripts/project/bootstrap.sh`
  - One-command bootstrap for a new repo.
  - Enforces `APP_SLUG == repo folder name`.

- `scripts/project/migrate.sh`
  - Aligns a repo to the ProKit engine runtime model (start gate + nixpacks + verify).

## Dev helper

- `scripts/dev/bootstrap-env.js`
  - Creates a minimal `.env` if missing.
  - Enforces `APP_SLUG == repo folder name`.
  - Leaves `DATABASE_URL` empty until the first `db:init`.
