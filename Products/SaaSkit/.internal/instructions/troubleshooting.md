# SaaSKit - Troubleshooting Guide (ProKit engine)

This guide lists common failure modes for SaaSKit.

## Local development

### Postgres connection refused

- Ensure Docker Postgres is running.
- Ensure port `5433` is mapped (or set `POSTGRES_PORT` if you use a custom port).
- Confirm `.env` has a working `SYSTEM_DATABASE_URL`.

### Prisma shadow database errors

- Set `SHADOW_DATABASE_URL` to the same admin connection as `SYSTEM_DATABASE_URL`.
- Do not use a tenant user for `SHADOW_DATABASE_URL`.

### APP_SLUG mismatch

- Repo folder name must match `[a-z0-9_]+`.
- `APP_SLUG` must equal the repo folder name.

## Production (Dokploy)

### Container exits immediately

Common causes:

- Missing bind mount: `/var/backups/pgdump`.
- Backup root not writable.
- Missing env vars: `APP_SLUG`, `SYSTEM_DATABASE_URL`, `DATABASE_URL`, `NODE_ENV`.

### `psql: invalid URI query parameter: "schema"`

- `?schema=` is Prisma-only.
- Postgres CLI tools do not accept it.
- Use the ProKit engine scripts (they normalize URLs) or strip `schema=...` from the URL before using `psql`/`pg_dump`.

### Migrations not applied

- Ensure Dokploy starts with `npm start` (runtime gate).
- Do not run `next start` directly.

## Auth (Clerk)

- If Clerk keys are missing, middleware runs in mock mode and does not protect routes.
- In production, set both:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`

## Billing (Stripe)

- Webhook failures usually mean `STRIPE_WEBHOOK_SECRET` is missing or incorrect.
- Ensure `/api/webhook/stripe` is public.
