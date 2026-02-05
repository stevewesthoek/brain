# SaaSKit Weekend Guide

This is the fastest path to go from “template” to “live product” with SaaSKit.

SaaSKit is ProKit (engine) + a marketing/launch layer. The engine handles production DB provisioning and migrations automatically via the runtime deploy gate.

## 1) Pick your app slug (important)

- Your repo folder name becomes your `APP_SLUG`.
- Slug must match: `[a-z0-9_]+` (lowercase letters, numbers, underscores).
- Keep the repo name and `APP_SLUG` identical.

Example: `myapp` -> `APP_SLUG=myapp` -> DB schema `tenant_myapp`.

## 2) Customize the marketing site (day 1)

Main entry points:

- Landing page composition:
  - `src/saaskit/marketing/landing/App.tsx`
- Marketing copy/config:
  - `src/saaskit/marketing/landing/metadata.json`
- Site-wide config (domain, email, Stripe plans, etc.):
  - `src/config.ts`

Recommended workflow:

1. Replace the headline/value prop in `metadata.json`.
2. Update the pricing plans in `src/config.ts` (use your real Stripe `priceId`s later).
3. Update FAQ and final CTA.

## 3) Run locally

```bash
docker compose up -d postgres
npm install
npm run dev
```

On first run, SaaSKit will:

- create `.env` if missing
- provision a local tenant schema/user
- run Prisma dev migrations
- start Next.js

## 4) Enable optional features (only if you need them)

SaaSKit is designed to run with a minimal baseline. Enable features by setting env vars.

Auth (Clerk):

- set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`

Billing (Stripe):

- set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- configure products in `src/config.ts`

Waiting list (Resend):

- set `RESEND_API_KEY`
- route: `/waiting-list`

Blog (WordPress):

- set `WP_REST_ENDPOINT` (example: `https://example.com/wp-json`)
- routes: `/blog`, `/blog/[articleId]`

Automation (n8n):

- set `N8N_API_URL`, `N8N_API_KEY`, `N8N_WEBHOOK_URL`

## 5) Deploy to production (hands-off)

SaaSKit is intended to be deployed on Dokploy with tag-gated releases:

1. Configure Dokploy env vars (copy from a generated `.env.production`).
2. Add the required bind mount: `/var/backups/pgdump` (RW).
3. Push a semver tag `vX.Y.Z` to deploy.

The runtime deploy gate will run automatically on container start:

- backup (when eligible)
- provisioning
- migrations
- smoke check

No manual production commands are part of the workflow.

## 6) Verify and iterate

- Watch Dokploy logs for `[deploy] smoke check passed`.
- Iterate locally, then ship changes by tagging a new release.
