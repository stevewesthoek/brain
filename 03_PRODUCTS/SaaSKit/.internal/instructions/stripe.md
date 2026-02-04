# SaaSKit - Stripe Integration Guide (ProKit engine)

This guide documents how SaaSKit uses Stripe for payments/subscriptions via the ProKit engine.

## Required environment variables

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Key files in the repo

API routes:

- Checkout session: `src/app/api/stripe/create-checkout/route.ts`
- Customer portal: `src/app/api/stripe/create-portal/route.ts`
- Webhooks: `src/app/api/webhook/stripe/route.ts`

Client helper:

- `src/helpers/checkout.ts` (calls `/api/stripe/create-checkout` and redirects)

Server helpers:

- `src/libs/stripe.ts` (portal + session helpers)
- `src/app/api/actions.ts` (webhook business logic)

## Webhook setup (local)

Forward Stripe events to your local dev server:

```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

Copy the signing secret it prints into:

- `STRIPE_WEBHOOK_SECRET`

## Safety rules (required)

- Always verify webhook signatures using `STRIPE_WEBHOOK_SECRET`.
- Treat webhook handlers as idempotent (Stripe may retry events).
- Keep `/api/webhook/stripe` public (do not protect it with auth).

## Common mistakes

- Forgetting `STRIPE_WEBHOOK_SECRET` in production.
- Protecting the webhook route in middleware.
- Using the publishable key (`pk_`) on the server.
