# Deploying SaaSKit on Vercel (limited)

Vercel is an optional path.

SaaSKit is optimized for Dokploy because the ProKit engine deployment model expects private DB access (provision/migrate/backup inside the runtime gate).

Use Vercel only when:

- You deploy marketing-only pages with no database access, or
- Your Postgres database is publicly reachable (or reachable via a secure proxy/tunnel).

## Required environment variables

```bash
APP_SLUG=<repo-name>
PROCHAT_VERSION=<semver-without-v>

DATABASE_URL=postgresql://tenant_<slug>_user:<password>@<public-host>:5433/postgres?schema=tenant_<slug>
NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>
```

## Operational constraints

- Do not run `db:init` or `db:migrate:prod` inside Vercel.
  - Run them in Dokploy or a VNet-connected job.
- If Vercel cannot reach the DB host, the app will fail at runtime.
