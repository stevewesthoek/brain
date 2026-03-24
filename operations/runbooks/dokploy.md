# Dokploy Runbook

## Purpose
Standard steps to deploy apps and run migrations safely.

## Checklist
- Verify env vars (APP_SLUG, DATABASE_URL, SYSTEM_DATABASE_URL)
- Verify `NEXT_PUBLIC_APP_URL` is set to the public domain in Dokploy env.
- Confirm `SYSTEM_DATABASE_URL` points to the shared environment database (not a per-app database).
- Run `db:init` and `db:migrate:prod`
- Confirm health checks
- Rollback plan noted

## Notes
- `db:init` provisions tenant schema/role only; it must never create a new database.
- `APP_SLUG` must be the normalized repo name: lowercase, with `-`, `_`, and `.` removed.
  - Example: `olive-to-organizing` -> `olivetoorganizing`
  - Example: `says-the-bible` -> `saysthebible`
  - Example: `prochat` -> `prochat`
- Tenant naming always follows the normalized slug:
  - schema: `tenant_<normalized_slug>`
  - user: `tenant_<normalized_slug>_user`
- `next start` logs `Local: http://localhost:3000` in container logs; this is expected and not the public URL.

## Rollback
- Re-deploy previous image/tag
- Re-run health checks
