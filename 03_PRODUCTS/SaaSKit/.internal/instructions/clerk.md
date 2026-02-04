# SaaSKit - Clerk Authentication Guide (ProKit engine)

This guide documents how SaaSKit uses Clerk for authentication via the ProKit engine.

## Version

- `@clerk/nextjs`: 5.7.1

## Required environment variables

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Optional: customize Clerk routing
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

## Key files in the repo

- Provider wrapper (safe dev experience): `src/libs/safeClerk.tsx`
- Route protection middleware: `src/middleware.ts`
- Root layout: `src/app/layout.tsx`
- Auth routes:
  - `src/app/sign-in/[[...sign-in]]/page.tsx`
  - `src/app/sign-up/[[...sign-up]]/page.tsx`

## SafeClerk design (important)

SaaSKit wraps Clerk in a safety layer so the repo can run without Clerk keys in development:

- `SafeClerkProvider` mounts `ClerkProvider` only when keys look valid.
- `useUser` / `useClerk` have mock fallbacks when keys are missing.

In production, keys must be set.

## Root layout integration

**File**: `src/app/layout.tsx`

Expected shape:

- `SafeClerkProvider` wraps the app shell.
- Providers wrap everything.

## Middleware (route protection)

**File**: `src/middleware.ts`

Rules:

- Public routes include:
  - `/` (marketing)
  - `/sign-in/*` and `/sign-up/*`
  - Stripe + webhook endpoints
  - waiting list + blog + sitemap + static assets
- Everything else is protected when Clerk keys are present.
- When Clerk keys are missing, middleware runs in mock mode (no routes are protected).

If you add new marketing routes, add them to the public route matcher.

## Common mistakes

- Forgetting to keep `/api/webhook/stripe` public.
- Protecting the marketing home page by accident.
- Running production without Clerk keys.

## Troubleshooting

Sign-in page crashes locally:

- Ensure Clerk keys are set.
- If you intentionally run without keys, avoid navigating to `/sign-in` and `/sign-up`.

Protected routes not protected:

- Confirm `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starts with `pk_` and `CLERK_SECRET_KEY` starts with `sk_`.
- Check logs for the middleware warning about mock mode.
