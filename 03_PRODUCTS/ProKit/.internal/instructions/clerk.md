# ProKit - Clerk Authentication

This document defines the default Clerk integration patterns used in ProKit.

Goal: keep auth predictable and avoid hard failures when keys are missing in development.

## What ProKit does by default

- Uses Clerk for authentication (App Router).
- Protects routes via `src/middleware.ts`.
- Uses a safe wrapper (`src/libs/safeClerk.tsx`) that enables a **mock mode** when Clerk keys are missing.

Mock mode is a convenience for local development only. Production must configure real Clerk keys.

## Required environment variables

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

Optional (recommended defaults):

```bash
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

## Provider pattern

Use the safe provider in your root layout:

- File: `src/app/layout.tsx`
- Wrapper: `SafeClerkProvider` from `src/libs/safeClerk.tsx`

This keeps local dev usable even if Clerk keys are not configured yet.

## Middleware pattern (route protection)

- File: `src/middleware.ts`

Recommended approach:

- Define a **small** public allowlist (home + auth pages + webhook endpoints).
- Protect everything else with `auth().protect()`.

In ProKit, middleware is disabled automatically when Clerk keys are missing (mock mode). This prevents local dev from crashing, but it also means routes are not protected until keys are configured.

## Server-side auth (App Router)

Use Clerk's server helpers for protected pages and API routes:

- `auth()` / `currentUser()` from `@clerk/nextjs/server`

Never trust client-side user state for authorization checks.

## Optional: Organizations/workspaces

Organizations/teams are intentionally not part of ProKit core. If you need them, add them as an optional module and keep the core patterns unchanged.

