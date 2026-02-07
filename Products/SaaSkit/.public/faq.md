# SaaSKit FAQ

## Is SaaSKit the same as ProKit?

No.

- **ProKit** is the internal engine boilerplate (auth, billing, DB lifecycle, runtime deploy gate).
- **SaaSKit** is ProKit **plus** a marketing + launch layer (landing site, optional blog, optional waiting list, funnel routes).

## Why does the package name still say ProKit?

The repo’s internal engine scripts and package naming stay ProKit because ProKit is the underlying engine.

The user-facing product (what you sell/ship) is SaaSKit.

## Do I need to run migrations in production?

No.

SaaSKit is designed to be **hands-off** in production:

- Production provisioning + migrations run automatically via the runtime deploy gate at container start.
- If a deploy fails, fix config/code and redeploy a new tag.

## How do production deploys work?

- Push to `main`
- Create/push a semver tag `vX.Y.Z`
- Dokploy deploys tags (tag-gated)
- Roll back by redeploying a previous tag

## Do you support PR preview deployments?

No. SaaSKit is intentionally tag-gated for production.

## What is required to run SaaSKit locally?

Minimum baseline:

- Node.js
- Docker + Postgres (default is `localhost:5433`; override with `POSTGRES_PORT`)

Everything else (Clerk, Stripe, Resend, WordPress, n8n) is optional until you enable it.

## What happens if I don’t configure Clerk or Stripe?

- Clerk: SaaSKit can run in a safe mock mode for local dev, but production should configure real keys.
- Stripe: billing routes will return clear `501` errors until Stripe env vars are set.

## Can I rename my app/repo after launch?

Yes, but the slug (`APP_SLUG`) is part of your database schema/user naming.

If you rename the repo slug and want to keep existing data, use the rename flow:

- Preferred: `db:rename` (dry-run by default)
- Hands-off production path: set `LEGACY_APP_SLUG=<old>` for a single deploy

## Is the blog required?

No. The blog is optional.

When enabled, it is WordPress-backed and driven by `WP_REST_ENDPOINT`.

## Is the waiting list required?

No. The waiting list is optional.

When enabled, it uses Resend and `RESEND_API_KEY`.
