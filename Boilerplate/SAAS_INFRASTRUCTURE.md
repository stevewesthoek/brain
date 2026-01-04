⚙️ Database Architecture & Automation

This boilerplate provides a scripted, environment-safe way to provision databases, run migrations, and manage single-tenant deployments for both local development and production. Automation is script-driven and AI-agnostic: any assistant or human should use the documented commands rather than inventing SQL.

🧠 Architecture Overview
- Each environment (development and production) has its own Postgres instance with a database named `postgres`.
- One app → one schema (`tenant_<slug>`) → one DB user (`tenant_<slug>_user`).
- Registry table `public.tenants` is infra-only (provision/cleanup), never used by runtime.
- Prisma manages schema and migrations via `prisma/system.prisma`.
- Development runtime and provisioning connect directly to Docker Postgres on `localhost:5433`.
- Production provisioning/migrations run inside Dokploy containers using `SYSTEM_DATABASE_URL` pointing at Supabase (`10.0.2.4:5433`).
- Production runtime uses only `DATABASE_URL` (tenant user), not `SYSTEM_DATABASE_URL`.
- MCP Bridge (`https://mcp.prochat.tools`) is optional/replaceable and should only trigger the documented commands.

Environment overview:
- Development
  - Provisioning/migrations: scripts → `localhost:5433` via `SYSTEM_DATABASE_URL`.
  - Runtime: `DATABASE_URL` with tenant credentials on `localhost:5433`.
  - Environment file: `.env`.
- Production
  - Provisioning/migrations: inside Dokploy (optionally via MCP) to Supabase `10.0.2.4:5433` using `SYSTEM_DATABASE_URL`.
  - Runtime: `DATABASE_URL` with tenant credentials on `10.0.2.4:5433`.
  - Environment file: Dokploy environment / `.env.production`.

For full database behavior, see `SAAS_DATABASE.md`. For cleanup specifics, see `SAAS_TENANT_CLEANUP.md`.

🧩 Automation Details

All database changes must flow through the scripts:

Provisioning:
- `npm run db:init -- --slug <slug> [--preview] [--external-id <id>]`
  - Creates `tenant_<slug>` schema + `tenant_<slug>_user`.
  - Grants privileges and sets search_path.
  - Upserts into `public.tenants` with canonical columns and type (`prod` or `preview`).

Migrations (Prisma):
- Development: `npm run db:migrate:dev` → `prisma migrate dev --schema=prisma/system.prisma`
- Production: `npm run db:migrate:prod` → `prisma migrate deploy --schema=prisma/system.prisma` (inside Dokploy)

Cleanup (preview tenants by default):
- `npm run db:cleanup -- --slug <slug> [--force]`
  - Looks up `public.tenants`.
  - Refuses non-preview unless `--force` is passed.
  - Drops schema, drops user, deletes registry row.

AI/agents:
- Use the commands above or MCP tools that wrap them.
- Do not execute raw SQL outside the documented scripts.

🧱 Prerequisites

- Docker Desktop running for local Postgres on port `5433` (mapped to container `5432`).
- Dokploy with network access to Supabase Postgres at `10.0.2.4:5433`.
- Optional MCP bridge exposed at `https://mcp.prochat.tools` (replaceable) that triggers only the documented commands.
- `.env` / `.env.production` should include:
  - `DATABASE_URL=postgresql://tenant_<slug>_user:<password>@localhost:5433/postgres?schema=tenant_<slug>`
  - `SYSTEM_DATABASE_URL=postgresql://postgres:<admin>@localhost:5433/postgres?schema=public` (scripts only)

⚙️ Starting a New Project

1) Bootstrap
```
git clone https://github.com/prochattools/boilerplate.git my-new-app
cd my-new-app
npm install
```

2) Provision
```
npm run db:init -- --slug <slug>
```
- Dev: connects to `localhost:5433` via `SYSTEM_DATABASE_URL`.
- Prod: runs inside Dokploy to `10.0.2.4:5433` via `SYSTEM_DATABASE_URL`.
- Creates schema/user and registry row; in dev, writes `DATABASE_URL`/`APP_SLUG` to `.env` and only sets `SYSTEM_DATABASE_URL` if missing.

3) Run (development)
```
npm run dev
```

4) Access locally
```
http://localhost:3000
```
Runtime uses the single `DATABASE_URL`; no host/subdomain-based tenant routing exists.

🔁 PR Preview Tenants (Optional)

- Provision preview: `NODE_ENV=production npm run db:init -- --slug pr_42 --preview`
- Cleanup preview: `NODE_ENV=production npm run db:cleanup -- --slug pr_42`
- Registry is updated; cleanup refuses prod rows unless `--force`.

✅ Summary

With Docker locally and Dokploy in production:
1. Provision: `npm run db:init -- --slug <slug>`
2. Migrate: `npm run db:migrate:dev` (dev) / `npm run db:migrate:prod` (prod)
3. Optional previews: provision with `--preview`; cleanup with `db:cleanup`
4. Runtime: always uses tenant `DATABASE_URL`; registry is infra-only.

🔄 Keeping Schemas in Sync

- Dev: edit `prisma/system.prisma` → `npm run db:migrate:dev` (creates migrations, updates local DB).
- Prod: deploy code + migrations → Dokploy runs `NODE_ENV=production npm run db:migrate:prod` against `10.0.2.4:5433`.
- MCP (optional) may trigger the same commands; it must not bypass scripts.

Application data is environment-specific; only schema is synchronized via Prisma migrations.
