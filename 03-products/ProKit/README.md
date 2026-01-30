# ProKit Boilerplate

ProKit is ProChat's boilerplate for building B2B SaaS apps. It standardizes auth, billing, database lifecycle, and deployment.

## Docs

- `DEVELOPMENT.md` - local setup and workflow
- `DATABASE.md` - provisioning, migrations, cleanup, env contracts
- `DEPLOY_DOKPLOY.md` - primary production environment (private DB access)
- `DEPLOY_VERCEL.md` - limited production environment
- `MODULES/` - optional patterns and templates
- `scripts/db/` - automated deploy + verification scripts
- `scripts/runtime/` - runtime gate that runs before app start
- `scripts/project/` - project bootstrap + migration helpers
- `nixpacks.toml` - ensures Postgres 15 client tools are available
- `AGENTS.md` - AI reminders for provisioning

## Environments (summary)

- Development: local Docker Postgres on `localhost:5433`.
- Production (Dokploy): private Supabase Postgres at `10.0.2.4:5433` reachable only from Dokploy.
- Production (Vercel): only if DB is publicly reachable or via secure proxy/tunnel.

## Dokploy Setup (Required)

The only per-app manual step:

**Bind mount required (or the container will refuse to start)**
- Dokploy UI path: **App -> General -> Volumes/Mounts -> Bind Mount**
- Host Path: `/var/backups/pgdump`
- Mount Path: `/var/backups/pgdump` (read/write)

ProKit routes `npm start` through `scripts/runtime/start-prod.sh`. The actual app start command should live in `scripts.start:app` inside `package.json` (default is `next start -p $PORT`).
No other per-app Dokploy configuration is required.
If your app uses a custom production start, put it in `scripts.start:app`.

## New app checklist

1. Create repo and choose a project name (this becomes `APP_SLUG`).
2. Run local provisioning:
   ```bash
   npm run db:init -- --slug <project-name>
   ```
3. Run local migrations:
   ```bash
   npm run db:migrate:dev
   ```
4. Commit code and `prisma/migrations`.
5. Use the generated `.env.production` values for Dokploy env vars.
6. Confirm Dokploy bind mount exists and `nixpacks.toml` is present.
7. Deploy (no custom start/deploy commands required).

## One-command project bootstrap

```bash
npm run prokit:bootstrap -- <app-slug>
```

This provisions the tenant, writes `.env` + `.env.production`, and prints next steps.

## First deploy checklist

- `APP_SLUG`, `SYSTEM_DATABASE_URL`, `DATABASE_URL` set in Dokploy env.
- Bind mount present: `/var/backups/pgdump` -> `/var/backups/pgdump`.
- `nixpacks.toml` present in the repo (installs Postgres 15 client tools).

## Verify last deploy

```bash
APP_SLUG=myapp npm run verify:deploy
```

## Migrate existing projects to ProKit

```bash
npm run prokit:migrate -- --apply
```

This aligns `package.json` to the runtime gate, ensures `verify:deploy` exists, and checks for `nixpacks.toml` and required scripts.

## AI reminder

When provisioning a new Dokploy app, always show the reminder in `AGENTS.md`.
