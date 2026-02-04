# Dokploy Runbook

## Purpose
Standard steps to deploy apps and run migrations safely.

## Checklist
- Verify env vars (APP_SLUG, DATABASE_URL, SYSTEM_DATABASE_URL)
- Run `db:init` and `db:migrate:prod`
- Confirm health checks
- Rollback plan noted

## Rollback
- Re-deploy previous image/tag
- Re-run health checks
