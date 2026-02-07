# Deploying ProKit on Vercel (limited)

Vercel is supported only when the database is publicly reachable or accessed via a secure proxy/tunnel.

ProKit's primary production model is Dokploy + a runtime deploy gate. Vercel is not the default.

## When to use Vercel

- Static or marketing-only deployments with no database access.
- Production apps that use a publicly reachable Postgres instance.
- Apps that reach the private DB via a secure proxy/tunnel inside the VNet (advanced).

## Required environment variables

```bash
APP_SLUG=myapp
DATABASE_URL=postgresql://tenant_myapp_user:<password>@<public-host>:5433/postgres?schema=tenant_myapp
NEXT_PUBLIC_APP_URL=https://myapp.vercel.app
```

Notes:
- Do not attempt to provision/migrate from Vercel. ProKit's production DB lifecycle is designed to run from Dokploy (or an equivalent VNet-connected runtime).
- If Vercel cannot reach the DB host, the app will fail at runtime.
