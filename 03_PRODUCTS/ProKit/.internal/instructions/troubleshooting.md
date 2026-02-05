# ProKit - Troubleshooting

This is a ProKit-specific troubleshooting guide. It focuses on the engine contracts: env, DB lifecycle, and the runtime deploy gate.

## Always start with the logs

- Local dev: terminal output from `npm run dev`
- Production: Dokploy deploy/start logs (the runtime gate prints `[deploy] ...`)

When something fails in production, the correct response is:

1. Read the deploy gate logs.
2. Fix config or code in git.
3. Redeploy by pushing a new tag (tag-gated deploys).

Do not run ad-hoc production DB commands.

## Common errors and fixes

### APP_SLUG mismatch

Symptom:

- `APP_SLUG mismatch. Expected "<repo>" (repo name), got "<slug>".`

Fix:

- Rename the repo folder to the slug you want (must match `[a-z0-9_]+`).
- Rerun `npm run dev`.

### Prisma shadow database errors (dev)

Symptom:

- Prisma fails during `migrate dev` complaining about a shadow database.

Fix:

- Set `SHADOW_DATABASE_URL` to an admin connection (same as `SYSTEM_DATABASE_URL`).
- Do not use a tenant user for `SHADOW_DATABASE_URL`.

### Backup dir not writable (production)

Symptom:

- Deploy gate fails with `backup dir not writable: /var/backups/pgdump/<slug>`

Fix:

- Ensure Dokploy has a bind mount:
  - `/var/backups/pgdump` -> `/var/backups/pgdump` (read/write)

### Postgres client/server major mismatch (production)

Symptom:

- Deploy gate fails with `pg_dump/pg_restore major (...) is older than server (...)`

Fix:

- Keep `nixpacks.toml` in the repo so the image installs the correct `postgresql-client-*`.

### Stripe/Clerk not configured

Symptoms:

- Stripe routes return `501` with a message about missing `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- Logs show `Clerk middleware disabled — running in mock mode.`

Fix:

- Set the required env vars in your environment (Dokploy or `.env`).

## Dev reset (last resort)

If your local DB is in a bad state and you do not need to keep data:

```bash
npm run db:cleanup -- --slug <slug> --force
npm run db:init
npm run db:migrate:dev
```

