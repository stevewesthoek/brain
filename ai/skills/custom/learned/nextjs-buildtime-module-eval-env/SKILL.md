---
name: nextjs-buildtime-module-eval-env
description: When next build fails at "Collecting page data" because module-level SDK constructors (Prisma, Resend, Stripe) throw on missing env vars — add placeholder ENVs to the Dockerfile builder stage.
---

# Next.js Build-Time Module-Eval ENV Crash

## The insight
`next build` runs "Collecting page data" which imports every route module and executes all module-level code. SDK constructors like `new PrismaClient()`, `new Resend(key)`, and Stripe env validators run at this point — before any runtime env vars exist in the container. If a key is missing, the constructor throws and the build fails.

The fix is not in app code. Add placeholder ENV values to the Dockerfile builder stage. These values are server-only and never baked into the client bundle — they just satisfy the validators so the build completes. Real values are injected at runtime by Dokploy.

`export const dynamic = 'force-dynamic'` on the route does NOT prevent this — it only prevents the page body from being called at build time, not module-level imports.

## When this applies
```
Error: Failed to collect page data for /api/<route>
  at <anonymous> (.next/server/chunks/...)
```
Combined with any of:
- `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`
- `Error: Missing API key. Pass it to the constructor new Resend("re_123")`
- `[stripe-env] Missing STRIPE_MODE` / `Missing STRIPE_SECRET_KEY_LIVE`
- Custom env validator: `Error: Missing required env var: <KEY>`

## The approach
1. Find which route failed in the "Collecting page data" error
2. Trace the import chain from that route to the module-level constructor
3. Check: is the failing key server-only (not baked into client bundle)?
   - Server-only → safe to add a placeholder (the value never reaches the browser)
   - `NEXT_PUBLIC_*` → different problem — see `nextjs-next-public-dockerfile-real-value`
4. Add the minimal placeholder that satisfies the constructor — format matters

## The fix
In the Dockerfile builder stage:
```dockerfile
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Server-only keys: validated at module-eval during next build page data collection.
# Placeholder values are safe — real keys injected at runtime by Dokploy.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV SYSTEM_DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV RESEND_API_KEY=re_build_placeholder
ENV STRIPE_SECRET_KEY=sk_live_build_placeholder_00000000000000000000
ENV STRIPE_WEBHOOK_SECRET=whsec_build_placeholder
RUN npm run build
```

## Gotchas
- Prisma triggers on `new PrismaClient()` at module load — no query needed to cause the crash
- Resend requires the `re_` prefix on the placeholder — `new Resend("placeholder")` without `re_` still throws
- Stripe's `stripe-env.ts` validates format — `sk_live_build_placeholder_...` with enough chars works
- Multiple Prisma schemas with separate DATABASE_URLs each need their own placeholder
- Some apps validate `APP_BASE_URL` at module level as well — check `src/lib/public-base-url.ts` equivalents

## Context
Repo: prochattools stack (prochat, says-the-bible, oliveto-organizing, jpv-bootcamp, xgrow)
Discovered: 2026-04-06
Area: Dockerfile builder stage — src/libs/prisma.ts, src/libs/resend.ts, src/libs/stripe-env.ts
