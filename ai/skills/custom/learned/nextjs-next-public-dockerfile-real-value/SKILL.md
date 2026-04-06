---
name: nextjs-next-public-dockerfile-real-value
description: NEXT_PUBLIC_* env vars are baked into the JS bundle at build time — the Dockerfile builder stage must use the real production URL, not a placeholder, or the wrong value ships to users.
---

# NEXT_PUBLIC_* Vars Need Real Values in Dockerfile

## The insight
`NEXT_PUBLIC_*` variables are inlined into the client JavaScript bundle during `next build`. Unlike server-only env vars where placeholder values are safe at build time, whatever you set for `NEXT_PUBLIC_APP_URL` in the builder stage IS what ships to users' browsers. Dokploy injects env vars at container runtime, but for public vars this is too late — the bundle already has the value baked in.

This is the one exception to the "use placeholder ENVs" rule for Dockerfile builder stages.

## When this applies
Build fails with:
```
Error: Missing required env var: NEXT_PUBLIC_APP_URL (NEXT_PUBLIC_APP_URL or APP_PUBLIC_URL)
  at /app/.next/server/chunks/...
Error: Failed to collect page data for /api/<route>
```
Or the app builds and runs but the client JS has `http://localhost:3000` hardcoded instead of the production domain.

## The fix
Find the correct production URL (check `.env.production` or `.env.example` in the repo), then set it as a real value in the builder stage:
```dockerfile
FROM base AS builder
...
# NEXT_PUBLIC_* vars are baked into the client bundle — use real production values.
ENV NEXT_PUBLIC_APP_URL=https://yourapp.com
ENV APP_BASE_URL=https://yourapp.com
```

## Gotchas
- `APP_BASE_URL` (server-only) often accompanies `NEXT_PUBLIC_APP_URL` in validator functions — set both even though only the public one is strictly baked in
- The production URL is safe to commit in the Dockerfile — it's a public domain, not a secret
- If the app has multiple environments (staging/prod), you'd need separate Dockerfiles or build args — but for this stack, production Dockerfile = production URL

## Context
Repo: jpv-bootcamp (prochattools/clients/jc-citadel/jpv-bootcamp)
Discovered: 2026-04-06
Area: Dockerfile builder stage, src/lib/public-base-url.ts
