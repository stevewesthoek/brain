# ProKit Development

Local development workflow for the ProKit boilerplate.

ProKit is ProChat's boilerplate for building B2B SaaS apps. It standardizes auth, billing, database lifecycle, and deployment. This document focuses only on **local development** and developer workflows.

---

## Prerequisites

- Node.js + npm
- Docker Desktop (or equivalent)
- Postgres container mapped to `localhost:5433`

You should have a local Postgres instance running on:

- Host: `localhost`
- Port: `5433`

---

## Quick start

Fresh clone, standard path:

```bash
npm install
npm run dev

npm run dev is expected to:
	1.	Ensure .env exists (or complain if it doesn’t).
	2.	Make sure the local tenant is provisioned.
	3.	Run dev migrations.
	4.	Start Next.js.

If your app doesn’t bootstrap automatically, use the explicit commands in the sections below.

⸻

Local environment

Typical local env values:

APP_SLUG=dev

DATABASE_URL=postgresql://tenant_dev_user:<password>@localhost:5433/postgres?schema=tenant_dev
SYSTEM_DATABASE_URL=postgresql://postgres:<admin-password>@localhost:5433/postgres?schema=public
SHADOW_DATABASE_URL=postgresql://postgres:<admin-password>@localhost:5433/postgres?schema=public

Notes:
	•	SYSTEM_DATABASE_URL and SHADOW_DATABASE_URL must use an admin role that can:
	•	create databases/schemas
	•	run Prisma migrations
	•	DATABASE_URL should point to the tenant user/schema for your local app slug.
	•	Tenant users cannot be used as a SHADOW_DATABASE_URL; Prisma will fail with shadow DB errors.

⸻

New app checklist (local)

Use this when creating a new ProKit-based app:
	1.	Create a new repo and choose a project name (this becomes APP_SLUG).
	2.	Install dependencies:

npm install


	3.	Run local provisioning:

npm run db:init -- --slug <project-name>


	4.	Run local migrations:

npm run db:migrate:dev


	5.	Start the app:

npm run dev


	6.	Commit prisma/migrations and any bootstrap changes.
	7.	Once you’re happy with the local setup, generate .env.production (via the bootstrap command below) so production can use the same contracts.

⸻

One-command project bootstrap

For new apps you can use the bootstrap helper to wire envs and DB in one go:

npm run prokit:bootstrap -- <app-slug>

This will:
	•	Provision the tenant (DB user + schema) for <app-slug>.
	•	Generate .env and .env.production with the correct URLs and passwords.
	•	Print next steps (migrations + deploy).

You should review the generated env files before committing anything.

⸻

First deploy checklist (developer side)

Even though deploy details live in the Dokploy docs, developers should ensure these are true before the first production deploy:
	•	Local dev runs clean via:

npm run db:migrate:dev
npm run dev


	•	.env.production exists and is committed or stored in your secret manager.
	•	APP_SLUG, SYSTEM_DATABASE_URL, and DATABASE_URL are consistent between .env, .env.production, and what you plan to set in production.
	•	nixpacks.toml is present in the repo so production has Postgres 15 client tools.
	•	package.json contains the ProKit runtime scripts (including verify:deploy and the runtime gate).

Actual Dokploy wiring (bind mounts, network) is covered in DEPLOY_DOKPLOY.md.

⸻

Common local commands

# initialize tenant schema + user for a given slug
npm run db:init -- --slug <slug>

# run dev migrations for both system + tenant schemas
npm run db:migrate:dev

# cleanup tenant for a given slug
npm run db:cleanup -- --slug <slug>

Additional helpers (if present in your repo):

# run the ProKit runtime verification locally
APP_SLUG=<slug> npm run verify:deploy

# retrofit an existing repo to ProKit's runtime + scripts
npm run prokit:migrate -- --apply


⸻

Quick troubleshooting
	•	Connection refused
	•	Verify Docker is running and port 5433 is mapped.
	•	Check that your Postgres container is healthy and listening.
	•	Auth errors
	•	Confirm .env is loaded.
	•	Check DATABASE_URL, SYSTEM_DATABASE_URL, and SHADOW_DATABASE_URL for typos.
	•	Ensure the tenant user actually exists and has the expected password.
	•	Prisma drift
	•	Run:

npm run db:migrate:dev
# or, if things are badly out of sync:
npx prisma migrate reset --schema=prisma/system.prisma


	•	Make sure you are not editing Prisma schemas without generating migrations.

	•	Shadow DB error
	•	Set SHADOW_DATABASE_URL to an admin connection (matching SYSTEM_DATABASE_URL).
	•	Tenant users cannot create shadow databases; Prisma will fail if you use them.
	•	Bootstrap failures
	•	Check Docker/Postgres are running.
	•	Inspect the logs of npm run prokit:bootstrap for the exact failing step
(user creation, schema creation, env file write).