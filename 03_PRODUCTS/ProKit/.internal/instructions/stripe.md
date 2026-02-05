# ProKit - Stripe Billing

This document defines the default Stripe integration patterns used in ProKit.

## Required environment variables

```bash
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Where billing lives in the codebase

Core entry points:

- Checkout session creation:
  - `src/app/api/stripe/create-checkout/route.ts`
- Customer portal (manage subscription):
  - `src/app/api/stripe/create-portal/route.ts`
- Stripe webhooks:
  - `src/app/api/webhook/stripe/route.ts`
- Stripe client helpers:
  - `src/constants/stripe.ts`
  - `src/libs/stripe.ts`

## Product/plan configuration

ProKit keeps Stripe product metadata (for example `priceId`) in a config file:

- `src/config.ts`

Rule: do not hardcode Stripe links in UI. UI calls the checkout API route with a `priceId`.

## Webhooks (required for subscriptions)

Webhook endpoint:

- `POST /api/webhook/stripe`
- Code: `src/app/api/webhook/stripe/route.ts`

Minimum events ProKit expects to handle:

- `checkout.session.completed` (grant access / create subscription row)
- `invoice.paid` (keep subscription active)
- `customer.subscription.deleted` (revoke access)

All webhook handlers must verify signatures using `STRIPE_WEBHOOK_SECRET`.

## Local development: Stripe CLI

Use the Stripe CLI to forward events to your local dev server:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

Copy the printed `whsec_...` secret into `STRIPE_WEBHOOK_SECRET` in your `.env`.

## Database model

Subscriptions are stored via Prisma (see `prisma/system.prisma`). ProKit expects:

- a stable mapping from a Clerk user to a Stripe customer/subscription
- subscription status used for gating premium features

## Safety rules

- Never expose `STRIPE_SECRET_KEY` to the client.
- Always verify webhook signatures.
- Treat webhooks as at-least-once delivery: handlers should be idempotent.

