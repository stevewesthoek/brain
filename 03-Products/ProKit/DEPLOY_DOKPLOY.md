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
SYSTEM_DATABASE_URL=postgresql://postgres:<admin-password>@10.0.2.4:5433/postgres?schema=public
NEXT_PUBLIC_APP_URL=https://myapp.example.com
PORT=3000
```

Tip: use the values written to `.env.production` by the provisioning script as the source for Dokploy env vars.

## Production flow (recommended)

Run inside Dokploy (pre-deploy hook or job):

```bash
npm run db:init -- --slug $APP_SLUG
NODE_ENV=production npm run db:migrate:prod
npm start
```

Notes:
- `db:init` is idempotent and safe to rerun.
- `db:migrate:prod` must be executed in Dokploy so it can reach the private DB.

## Make migrations explicit (required)

Migrations are not automatic unless your Dokploy workflow runs them.
Ensure your Dokploy deployment command or pre-deploy hook includes:

```bash
npm run db:init -- --slug $APP_SLUG
NODE_ENV=production npm run db:migrate:prod
```

If these commands are missing, production will not be updated when you add or change tables in development.

## Preview tenants (optional)

```bash
NODE_ENV=production npm run db:init -- --slug pr_42 --preview
NODE_ENV=production npm run db:cleanup -- --slug pr_42
```

## Troubleshooting

- Connection refused: verify the container is in the correct VNet/subnet and env vars are set.
- Auth errors: confirm `TENANT_DB_PASSWORD` and `DATABASE_URL` match.
- Migration failures: run `db:migrate:prod` again and check logs.
