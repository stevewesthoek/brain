# ProKit Architecture

ProKit is the ProChat **engine boilerplate**: a lean SaaS app core for technical founders.

It standardizes:
- Next.js (App Router) + TypeScript
- UI foundation (Tailwind + shadcn)
- Authentication (Clerk) with a safe **mock mode** when keys are missing
- Billing (Stripe) + subscription state
- PostgreSQL schema isolation per app (`tenant_<slug>`) with Prisma migrations
- Hands-off production deploys on Dokploy via a **runtime deploy gate** (backup + migrate + smoke check)


## Versioning rules

- Canonical version is the git tag on the boilerplate repo (e.g. `v1.2.3`).
- `PROCHAT_VERSION` in `.env.example` (and your production env) must match the tag version (`1.2.3`) so the UI can display the correct boilerplate version.
- Do not treat this document as a version source; keep it version-agnostic.

## What ProKit intentionally does not include

ProKit is the engine only. It does **not** ship with:
- A marketing site, funnels, landing pages, or SEO/blog/content systems
- Waiting lists, newsletters, or lead capture flows
- Help center/docs site pages, public changelog pages
- Anything that only exists to sell the product (copy/CTA systems, content pipelines)


## Documentation map

High-level ProKit documentation is split as follows:

- `development.md` – local setup, workflows, commands, and checklists.
- `database.md` – provisioning rules, migrations strategy, cleanup, and env contracts.
- `deploy_dokploy.md` – primary production environment on Dokploy (private DB access).
- `deploy_vercel.md` – limited production environment (public DB / proxy).
- `modules/` – optional patterns and templates that can be reused across apps.
- `scripts/db/` – automated deploy + verification scripts (backups, migrations, smoke tests).
- `scripts/runtime/` – runtime gate that runs before the app starts in production.
- `scripts/project/` – project bootstrap + migration helpers (e.g. `prokit:bootstrap`).
- `nixpacks.toml` – ensures Postgres 15 client tools are available in the image.
- `instructions/` – app-agnostic guidance (Clerk, Stripe, troubleshooting, Git workflow).

The Brain/ProKit docs (`.internal/` and `.public/`) are canonical; repo-level `docs/` and README files are exports derived from them.

## Slug contract (required)

- `APP_SLUG` is the app/tenant identifier and must match the repo folder name.
- Allowed characters: `[a-z0-9_]+` (lowercase letters, numbers, underscores).
- Database objects are derived from the slug:
  - schema: `tenant_<slug>`
  - role: `tenant_<slug>_user`

## Environment model

ProKit assumes three main environments:

### Development

- Local Docker Postgres exposed on `localhost:5433` by default (configurable via `POSTGRES_PORT`).
- Separate **system** schema and **tenant** schema(s).
- Dev tenant DB user has limited privileges; migrations are run using an admin connection.

Key point:

- `SHADOW_DATABASE_URL` **must** be an admin connection string for `prisma migrate dev` to work:
  - Tenant users cannot create shadow databases.
  - Use the same admin role as `SYSTEM_DATABASE_URL`.

See `development.md` and `database.md` for concrete env var examples.

### Production (Dokploy – primary)

- Postgres is reachable from the Dokploy app container (often via a private network).
- All provisioning and migrations run automatically as part of the **runtime deploy gate** (`scripts/runtime/*` + `scripts/db/*`).

Dokploy is the **canonical** production environment for ProKit apps. See `deploy_dokploy.md` for full details.

### Production (Vercel – limited)

- Used only if the database is:
  - Publicly reachable, **or**
  - Exposed via a secure proxy/tunnel.
- No private subnet assumptions; you are responsible for network access.

This is considered an optional path; Dokploy is the default.

## Runtime gate and start command

ProKit wraps the production start process with a runtime gate:

- `npm start` is routed through `scripts/runtime/start-prod.sh`.
- The script:
  - Detects pending migrations.
  - Takes a `pg_dump` backup (when migrations are pending).
  - Applies migrations.
  - Runs smoke checks.
  - Restores from backup on failure (when a backup exists).
- Only if the gate succeeds does it `exec` the real app start command.

The actual app start command must live in `scripts.start:app` in `package.json`:

- Default: `next start -p $PORT`.
- If your app needs a custom start, modify `scripts.start:app`; do **not** bypass the runtime gate.

The Dokploy docs describe how this integrates with the Swarm service and bind mounts.
