# SaaSKit Deployment

SaaSKit is optimized for **Dokploy + Nixpacks** with a migration-safe runtime deploy gate.

It is designed to run against a managed Postgres provider (for example **Supabase Postgres**) as long as Dokploy can reach the database host/port.

This guide is infrastructure-agnostic: no hard-coded IPs or server names.

## Deployment model (required)

- Production deploys are **tag-gated**:
  - Push commits to `main` as usual.
  - Only git tags (for example `v1.0.0`) trigger production deploys.
  - Roll back by redeploying a previous tag.
- No PR preview deploys.
- Production DB lifecycle is hands-off:
  - provisioning + migrations run automatically via the runtime deploy gate during container start
  - operators should not exec into production containers to run DB commands manually

## Runtime deploy gate (how production stays in sync)

On container start:

1. `npm start` runs `scripts/runtime/start-prod.sh`
2. The script runs `scripts/db/deploy-prod.sh`
3. The deploy gate:
   - detects pending migrations
   - takes a `pg_dump` backup (when eligible)
   - runs provisioning (`db:init`)
   - applies migrations (`db:migrate:prod`)
   - runs a smoke check
   - restores from backup on failure (when a backup exists)
4. Only then the app starts (`npm run start:app`)

This is what makes SaaSKit hands-off in production.

## Dokploy configuration (per app)

### 1) Environment variables

Required:

```bash
NODE_ENV=production
APP_SLUG=<repo-name>                       # must match the repo folder name
PROCHAT_VERSION=<semver-without-v>         # must match the deployed git tag without the leading "v"

TENANT_DB_PASSWORD=<alphanumeric-only>
DATABASE_URL=postgresql://tenant_<slug>_user:${TENANT_DB_PASSWORD}@<db-host>:<db-port>/postgres?schema=tenant_<slug>
SYSTEM_DATABASE_URL=postgresql://<admin-user>:<admin-password>@<db-host>:<db-port>/postgres

NEXT_PUBLIC_APP_URL=https://<your-domain>
PORT=3000
```

Notes:

- `APP_SLUG` must match `[a-z0-9_]+` and must equal the repo name.
- `SYSTEM_DATABASE_URL` must be an admin connection that can create schemas/roles and run backups.
- `DATABASE_URL` must use the tenant user (`tenant_<slug>_user`).
- `TENANT_DB_PASSWORD` must be alphanumeric only (no special characters).

Optional (slug rename support):

```bash
LEGACY_APP_SLUG=<old_slug>
```

### 2) Backup bind mount (required)

The deploy gate writes backups under `/var/backups/pgdump/$APP_SLUG`.

Configure a bind mount in Dokploy:

- Host path: `/var/backups/pgdump`
- Container path: `/var/backups/pgdump`
- Mode: read/write

If this mount is missing or not writable, the deploy gate fails and the container exits (by design).

### 3) Start command (required)

Dokploy must start the app with:

- Start command: `npm start`

Do not bypass the gate by running `next start` directly.

## Vercel (limited)

Vercel is supported only when your database is publicly reachable (or accessed via a secure proxy/tunnel).

SaaSKit’s default production model assumes Dokploy runs the runtime gate.

## Troubleshooting

- Use Dokploy logs. A healthy deploy includes:
  - `[deploy] smoke check passed`
  - `[deploy] done`
- If a deploy fails:
  - fix config/code
  - create a new release tag
  - redeploy (tag-gated)
