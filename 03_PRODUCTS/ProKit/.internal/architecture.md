# ProKit Architecture

ProKit is ProChat's boilerplate for building B2B SaaS apps. It standardizes:

- Authentication
- Billing
- Database lifecycle (provisioning, migrations, cleanup)
- Deployment (local, Dokploy, Vercel)


## Versioning rules

- Canonical version is the git tag on the boilerplate repo (e.g. `v1.2.3`).
- `PROCHAT_VERSION` in `.env.example` (and your production env) must match the tag version (`1.2.3`) so the UI can display the correct boilerplate version.
- Do not treat this document as a version source; keep it version-agnostic.


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

## Environment model

ProKit assumes three main environments:

### Development

- Local Docker Postgres exposed on `localhost:5433`.
- Separate **system** schema and **tenant** schema(s).
- Dev tenant DB user has limited privileges; migrations are run using an admin connection.

Key point:

- `SHADOW_DATABASE_URL` **must** be an admin connection string for `prisma migrate dev` to work:
  - Tenant users cannot create shadow databases.
  - Use the same admin role as `SYSTEM_DATABASE_URL`.

See `DEVELOPMENT.md` and `DATABASE.md` for concrete env var examples.

### Production (Dokploy – primary)

- Private Supabase Postgres VM at `10.0.2.4:5433`.
- VM is in the same VNet/subnet as Dokploy.
- Only Dokploy containers can reach the database.
- All provisioning and migrations run **inside** the Dokploy containers (`scripts/db/*`).

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
  - Runs migration detection.
  - Takes a `pg_dump` backup.
  - Applies migrations.
  - Runs smoke checks.
  - Restores from backup on failure.
- Only if the gate succeeds does it `exec` the real app start command.

The actual app start command must live in `scripts.start:app` in `package.json`:

- Default: `next start -p $PORT`.
- If your app needs a custom start, modify `scripts.start:app`; do **not** bypass the runtime gate.

The Dokploy docs describe how this integrates with the Swarm service and bind mounts.
