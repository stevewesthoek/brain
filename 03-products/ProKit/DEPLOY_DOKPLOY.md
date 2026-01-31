# Deploying ProKit on Dokploy

Dokploy is the primary production environment for ProKit. It is the only place that can reach the private Supabase Postgres VM.

## Network model

- Production Postgres: Supabase VM at `10.0.2.4:5433`.
- The VM is in the same VNet/subnet as Dokploy.
- Only Dokploy containers can reach the database.
- All provisioning and migrations must run inside Dokploy.

## Required environment variables

```bash
NODE_ENV=production
APP_SLUG=myapp
TENANT_DB_PASSWORD=<strong-password>
DATABASE_URL=postgresql://tenant_myapp_user:<TENANT_DB_PASSWORD>@10.0.2.4:5433/postgres?schema=tenant_myapp
SYSTEM_DATABASE_URL=postgresql://supabase_admin:<admin-password>@10.0.2.4:5433/postgres?schema=public
NEXT_PUBLIC_APP_URL=https://myapp.example.com
PORT=3000
```

Tip: use the values written to `.env.production` by the provisioning script as the source for Dokploy env vars.

## Production flow (recommended)

No custom Dokploy commands are required. ProKit routes `npm start` through a runtime gate:

1. `scripts/runtime/start-prod.sh` runs on container start.
2. It calls `scripts/db/deploy-prod.sh` (migration detect → backup → migrate → smoke → auto-restore).
3. If the gate succeeds, it `exec`s the real app start command.
4. If the gate fails, the container exits non-zero and Dokploy marks the deploy as failed.
5. Backups are handled by ProKit scripts; do not use Dokploy Volume Backups for this flow.

The actual app start command should live in `scripts.start:app` inside `package.json`.
If your app uses a custom production start, put it in `scripts.start:app`.
For new apps, run `npm run prokit:bootstrap -- <slug>` to provision and generate env files.

## Admin role requirement (required)

Use `supabase_admin` for `SYSTEM_DATABASE_URL`. This role owns tenant schemas and can run provisioning, cleanup, backups, and migrations for every app.

### Swarm service mount (required)

Because Dokploy runs in Swarm, add a service-level bind mount so backups persist:

- Host path: `/var/backups/pgdump`
- Container path: `/var/backups/pgdump`

If this is missing, the deploy script will fail with a writable-path error.
This is a one-time manual requirement per app. All apps share the same host path.
No other per-app Dokploy configuration is required.

### Postgres client tools (required)

The deploy script uses `psql`, `pg_dump`, and `pg_restore`. Ensure your Dokploy build/runtime image includes the Postgres 15 client tools (same major as Supabase).

Options:
- Nixpacks: include `nixpacks.toml` with `postgresql_15` (recommended, repo-driven).
- Use a sidecar or one-off `postgres:15` client container to run the script.

ProKit includes `nixpacks.toml` with Postgres 15 client tools by default. If your Dokploy app already uses Nixpacks, no UI changes are needed.

### Verify last deploy

```bash
APP_SLUG=myapp npm run verify:deploy
```

## Make migrations explicit (required)

Migrations are automatic because `npm start` runs the runtime gate before the app starts.

## Preview tenants (optional)

```bash
NODE_ENV=production npm run db:init -- --slug pr_42 --preview
NODE_ENV=production npm run db:cleanup -- --slug pr_42
```

## Troubleshooting

- Connection refused: verify the container is in the correct VNet/subnet and env vars are set.
- Auth errors: confirm `TENANT_DB_PASSWORD` and `DATABASE_URL` match.
- Migration failures: run `db:migrate:prod` again and check logs.
