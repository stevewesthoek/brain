# Deploying ProKit on Vercel (limited)

Vercel is supported only when the database is publicly reachable or accessed via a secure proxy/tunnel. The default ProKit production database (Supabase VM at `10.0.2.4`) is private and not reachable from Vercel.

## When to use Vercel

- Static or marketing-only deployments with no database access.
- Production apps that use a publicly reachable Postgres instance.
- Apps that reach the private DB via a secure proxy/tunnel inside the VNet (advanced).

## Required environment variables

```bash
APP_SLUG=myapp
DATABASE_URL=postgresql://tenant_myapp_user:<password>@<public-host>:5432/postgres?schema=tenant_myapp
NEXT_PUBLIC_APP_URL=https://myapp.vercel.app
```

Notes:
- Do not run `db:init` or `db:migrate:prod` inside Vercel. Run them in Dokploy or a VNet-connected CI runner.
- If Vercel cannot reach the DB host, the app will fail at runtime.
