---
name: dokploy-nixpacks-env-leak
description: When a Dokploy app fails to build with nixpacks because a runtime env var (e.g. NODE_OPTIONS=--require newrelic) crashes npm ci or another build step — Dokploy injects ALL env vars as Docker build ARGs, making them active during RUN commands.
---

# Dokploy Nixpacks Env Leak

## The insight
When `buildType` is `nixpacks`, Dokploy auto-generates a Dockerfile that declares every app env var as both `ARG` and `ENV`. This means all env vars are active during every `RUN` command — including `npm ci`. Any runtime-only var that modifies Node.js startup (like `NODE_OPTIONS=--require newrelic`) will be active before `node_modules` exists, crashing the install.

The fix is to switch `buildType` to `dockerfile` and write a custom multi-stage Dockerfile. With `dockerfile` type, Dokploy passes env vars at container runtime only, not as build args.

## When this applies
Symptom: `npm ci` (or any Node-invoked RUN step) fails immediately at build time with:
```
Error: Cannot find module 'newrelic'
Require stack:
- internal/preload
```
Or any `MODULE_NOT_FOUND` from `NODE_OPTIONS=--require <module>` before node_modules is populated.

Also applies to any env var that mutates build-time behaviour (e.g. `NODE_OPTIONS`, `NODE_ENV`, `NPM_CONFIG_*`).

## The approach
1. Check `buildType` in Dokploy app settings — if `nixpacks`, env vars leak into build
2. Look at the generated Dockerfile in the build log — you'll see `ARG KEY=value` + `ENV KEY=$KEY` for every env var at the top
3. Switch to `buildType: dockerfile`, write a custom Dockerfile where build stages don't inherit runtime env vars

## The fix
**Dokploy API** — switch build type:
```bash
source ~/.config/dokploy/.env
curl -s -X POST "https://dokploy.prochat.tools/api/application.update" \
  -H "x-api-key: $DOKPLOY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"applicationId": "<id>", "buildType": "dockerfile", "dockerfile": "Dockerfile"}'
```

**Custom Dockerfile pattern** (multi-stage, env vars only injected at runtime):
```dockerfile
FROM node:20-bookworm AS deps
# Add build tools for native modules (better-sqlite3, bcrypt, etc.)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci          # no NODE_OPTIONS here — clean environment

FROM node:20-bookworm AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
```

Dokploy injects the runtime env vars (including `NODE_OPTIONS=--require newrelic`) at container start, not build time.

## Gotchas
- `better-sqlite3` and other native modules need `python3 make g++` in the deps stage — add to `apt-get install` list
- If you also have `NODE_OPTIONS=--max-old-space-size=N` set at project level in Dokploy, it may conflict with `--require newrelic` at app level — check both the project env and app env in the API response
- With `dockerfile` buildType, Dokploy won't inject env vars as build args, so any build-time substitution you need (e.g. `NEXT_PUBLIC_*` vars) must be `ARG`/`ENV` in your Dockerfile explicitly, or omitted and injected at runtime

## Context
Repo: xgrow (prochattools/saas/xgrow)  
Discovered: 2026-04-05  
Area: Dockerfile, Dokploy deployment config
