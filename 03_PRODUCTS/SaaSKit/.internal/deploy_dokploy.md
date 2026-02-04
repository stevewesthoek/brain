# Deploying SaaSKit on Dokploy (primary path)

Dokploy is the primary production environment for SaaSKit.

SaaSKit depends on the ProKit engine runtime gate which runs provisioning, migrations, backup, and smoke checks before the app starts.

This doc is written to be vendor-neutral about your infrastructure details (no hard-coded IPs). Treat it as the canonical Dokploy path.

## Deployment model (required)

- Deployments are tag-gated.
  - Push commits to `main` as normal.
  - Only create/push a git tag (example: `v1.2.3`) when you want production to deploy.
  - Rollback is redeploying a previous tag.
- No PR preview deploys.

## Network model

- Postgres is expected to be reachable from Dokploy containers (often via private network).
- Provisioning and migrations must run inside Dokploy.
- If you deploy to other hosts (Vercel, etc), you are responsible for secure DB access.

## Required environment variables

Generate a baseline `.env.production` using the ProKit engine bootstrap:

```bash
npm run prokit:bootstrap -- <app-slug>
```

This will (via `db:init`) write `.env` and `.env.production` including:

- `APP_SLUG`
- `DATABASE_URL`
- `SYSTEM_DATABASE_URL`
- `TENANT_DB_PASSWORD`
- `PROCHAT_VERSION` (if present in `.env.example`)

Minimum required vars in Dokploy:

```bash
NODE_ENV=production
APP_SLUG=<repo-name>
PROCHAT_VERSION=<semver-without-v>

TENANT_DB_PASSWORD=<strong-password>
DATABASE_URL=postgresql://tenant_<slug>_user:${TENANT_DB_PASSWORD}@<db-host>:<db-port>/postgres?schema=tenant_<slug>
SYSTEM_DATABASE_URL=postgresql://<admin-user>:<admin-password>@<db-host>:<db-port>/postgres?schema=public

NEXT_PUBLIC_APP_URL=https://<your-domain>
PORT=3000
```

Notes:

- `APP_SLUG` must match the repo/project name (`[a-z0-9_]+`).
- `DATABASE_URL` must use the tenant user created during provisioning.
- `SYSTEM_DATABASE_URL` must be an admin role that can create schemas/users and apply migrations.

## Dokploy configuration (per app)

### 1. Bind mount for backups (required)

The runtime gate takes a `pg_dump` backup before applying migrations.

In Dokploy UI, add a bind mount:

- Host path: `/var/backups/pgdump`
- Container path: `/var/backups/pgdump`
- Mode: read/write

If the mount is missing or not writable, the container will exit during startup.

### 2. Start command (required)

Dokploy must start the service with:

- Start command: `npm start`

Do not bypass the runtime gate by running `next start` directly.

The runtime gate is implemented in:

- `scripts/runtime/start-prod.sh` (runs first)
- `scripts/db/deploy-prod.sh` (backup/migrate/smoke/restore)

The real app start command must live in `package.json` under `scripts.start:app`.

### 3. Postgres client tools (required)

The deploy scripts use:

- `psql`
- `pg_dump`
- `pg_restore`

Ensure the build image includes matching Postgres client tools via `nixpacks.toml`.

## First production deploy checklist

Before creating the first production tag:

- `npm run dev` works locally.
- `.env.production` exists and matches what you configured in Dokploy.
- Dokploy env vars are set:
  - `APP_SLUG`, `PROCHAT_VERSION`, `DATABASE_URL`, `SYSTEM_DATABASE_URL`, `TENANT_DB_PASSWORD`
- Bind mount exists and is writable:
  - `/var/backups/pgdump` -> `/var/backups/pgdump` (RW)
- The repo contains:
  - `scripts/runtime/start-prod.sh`
  - `scripts/db/deploy-prod.sh`
  - `scripts/db/verify.sh`
  - `nixpacks.toml`

Then:

1. Merge/push code to `main`.
2. Create a tag: `vX.Y.Z`.
3. Push the tag to origin.
4. Dokploy builds the image and runs `npm start`.
5. The runtime gate decides whether the deploy is healthy.

## Verify last deploy

```bash
APP_SLUG=<slug> npm run verify:deploy
```

This reads the status file written under `/var/backups/pgdump/$APP_SLUG/last_run.status`.

## Rollback strategy

- Code rollback: redeploy a previous git tag.
- Database rollback:
  - The runtime gate can auto-restore only within a failing deploy when it created a backup for that run.
  - If you need to roll back schema changes across releases, restore a previous dump manually.

Best practice:
- Prefer backwards-compatible migrations.
- When in doubt, do multi-step migrations (add columns first, deploy code, then remove later).

## Troubleshooting

### Connection refused

- Exec into the running container and test:

```bash
psql "$SYSTEM_DATABASE_URL" -c "select 1;"
```

- If this fails, validate network access from Dokploy to the DB host.

### Migration failures

- Check logs for the output of:
  - `scripts/runtime/start-prod.sh`
  - `scripts/db/deploy-prod.sh`

- Re-run inside a one-off Dokploy container if needed:

```bash
NODE_ENV=production npm run db:migrate:prod
```

### Backup mount errors

- Confirm the bind mount exists and is writable.
- Confirm `nixpacks.toml` includes `postgresql_15` so `pg_dump` exists.
