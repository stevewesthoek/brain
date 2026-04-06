# Standard Dockerfile Pattern — prochattools stack

All prochattools and client projects deployed via Dokploy use a custom multi-stage Dockerfile with `dockerfile` buildType. **Never use nixpacks for this stack.**

## Why not nixpacks

Dokploy's nixpacks mode auto-generates a Dockerfile that declares ALL configured app env vars as `ENV` statements active during every `RUN` step — including `npm ci`. The apps have `NODE_OPTIONS=--require newrelic` configured as a runtime env var. When nixpacks injects this into the build, Node.js tries to preload `newrelic` before `node_modules` exists → `Cannot find module 'newrelic'`. This is a chicken-and-egg problem.

With `dockerfile` buildType, Dokploy uses the repo's own Dockerfile as-is. Env vars are only injected at container **runtime**. The build environment is clean.

---

## Standard template

```dockerfile
# ---- Base ----
FROM node:20-bullseye AS base
WORKDIR /app

# ---- Deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
# Copy prisma dir before npm ci — postinstall runs prisma generate
COPY prisma ./prisma
# No --omit=dev: prisma CLI is a devDep needed for postinstall
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder values for keys validated at module-eval time during next build.
# next build imports every route module to collect page data — module-level
# constructors (Prisma, Resend, Stripe) throw if their keys are missing.
# These values are server-only and never baked into the client bundle.
# Real values are injected at runtime by Dokploy.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# Add other SDK keys as needed:
# ENV RESEND_API_KEY=re_build_placeholder
# ENV STRIPE_SECRET_KEY=sk_live_build_placeholder_00000000000000000000
# ENV STRIPE_WEBHOOK_SECRET=whsec_build_placeholder
RUN --mount=type=cache,target=/app/.next/cache \
    npx prisma generate && \
    npm run build

# ---- Runner ----
FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["npm", "run", "start"]
```

---

## Customisation rules

| Situation | What to add / change |
|---|---|
| Multiple prisma schemas (e.g. `schema.prisma` + `system.prisma`) | Run `npx prisma generate --schema=prisma/schema.prisma && npx prisma generate --schema=prisma/system.prisma` in builder |
| Custom prisma output path (`output = "../node_modules/@prisma/system-client"`) | Use `--schema=prisma/system.prisma`; the output path is in the schema itself |
| Resend instantiated at module level | Add `ENV RESEND_API_KEY=re_build_placeholder` in builder |
| Stripe keys validated at module level | Add `ENV STRIPE_SECRET_KEY=sk_live_build_placeholder_...` etc. in builder |
| `SYSTEM_DATABASE_URL` for a system prisma client | Add `ENV SYSTEM_DATABASE_URL=postgresql://build:build@localhost:5432/build` |
| `better-sqlite3` or other native modules | Add `RUN apt-get install -y python3 make g++` in **deps** stage |
| SQLite data dir needed at build time | Add `RUN mkdir -p /app/data` in **builder** stage (better-sqlite3 opens DB at module-eval) |
| App has a custom start script | Replace CMD with `CMD ["sh", "scripts/runtime/start-prod.sh"]` and add `COPY scripts` in runner |
| next.js standalone output | Copy `.next/standalone` instead of `.next`; see prochat Dockerfile |

---

## Dokploy setup checklist

When creating a new Dokploy app:

1. Add the `Dockerfile` to the repo root using the template above
2. In Dokploy: set **buildType = `dockerfile`** (not nixpacks)
3. Set all runtime env vars in Dokploy (Prisma DB URL, SDK keys, app URL, etc.)
4. Trigger deploy — the Dockerfile controls the build; Dokploy injects runtime config

---

## Common module-level SDK patterns that need placeholder ENVs

The pattern: `export const client = new SomeSDK(process.env.SOME_KEY)` at module level. Next.js executes this during `next build`'s "Collecting page data" phase when it imports every route. If the key is missing, the constructor throws and the build fails.

Known SDKs in this stack that need build-time placeholders:
- **Prisma** — `new PrismaClient()` reads `DATABASE_URL`
- **Resend** — `new Resend(key)` throws `Missing API key` if key is undefined
- **Stripe** — `getStripeSecretKey()` / env validation at module level in `stripe-env.ts`
- **New Relic** — runtime only, no build-time issue (injected via NODE_OPTIONS at container start)

---

## Reference

- forge skill Phase 6c — Dockerfile creation is a required step in the deploy phase
- Decision log entry: 2026-04-06 — see `operations/decision-log.md`
- Discovered and validated: 2026-04-06 across 11 prochattools repos
