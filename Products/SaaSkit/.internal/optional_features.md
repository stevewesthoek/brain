# SaaSKit Optional Features

SaaSKit ships with optional marketing + launch features.

Rule of thumb:
- The repo should run locally with only the database configured.
- Optional features should either work when configured, or fail with a clear message.

Export target:
- This doc maps to `docs/optional-features.md` in the SaaSKit repo.

## Required (SaaSKit baseline)

- Marketing home page: `/` (landing)
- Legal pages:
  - `/tos`
  - `/privacy-policy`

## Optional: Blog (WordPress)

What you get:
- `/blog` listing
- `/blog/[articleId]` article pages

Enablement:
- Set `WP_REST_ENDPOINT`.
  - Recommended format: `https://example.com/wp-json`
  - If you provide `.../wp-json/wp/v2`, the code normalizes it.

## Optional: Waiting list (Resend)

What you get:
- `/waiting-list`
- `POST /api/waiting-list`

Enablement:
- Set `RESEND_API_KEY`.
- Ensure the DB has the `Audiences` table (Prisma migrations).


## Optional: n8n (automation workflows)

What you get:
- A simple dashboard UI to clone an n8n workflow template.
- A per-project webhook URL that the in-app chat can call.

Routes:
- Clone template workflow: `POST /api/workflows/openAIAssistant`
- Toggle workflow active/inactive: `POST /api/active`
- Get a project's webhook URL: `GET /api/link?projectID=...`

Enablement:
- Set:
  - `N8N_API_KEY`
  - `N8N_API_URL`
  - `N8N_WEBHOOK_URL`

Notes:
- If n8n env vars are missing, `/api/active` returns `501` with a clear message.

## Optional: Checkout funnel (`/processing-page/*`)

What you get:
- Combined signup + checkout flow.

Enablement:
- Configure Clerk.
- Configure Stripe.
- Link to `/processing-page` from marketing CTAs only when enabled.

## Optional: Stripe (billing)

Required vars:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Plan config:
- `src/config.ts` (`config.stripe.products`)

## Optional: Clerk (auth)

Required vars:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Notes:
- Marketing pages can work without Clerk.
- App routes like `/dashboard` require Clerk.
