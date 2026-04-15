---
name: nextjs-standalone-runtime-deps
description: When a Next.js standalone container crashes at startup because runtime-loaded packages (newrelic, pg, prisma) are missing — standalone output only traces statically-imported modules and excludes anything loaded via NODE_OPTIONS or called from deploy-gate scripts.
---

# Next.js Standalone: Runtime-Loaded Deps Not Traced

## The insight
`output: 'standalone'` uses `@vercel/nft` to trace only modules that are statically imported during the build. It intentionally excludes:
- `newrelic` loaded via `NODE_OPTIONS=--require newrelic` (runtime injection, not static import)
- `pg`, `prisma`, and any package called from `start-prod.sh` deploy gate scripts (shell-invoked, not traced)

The container starts, the deploy gate runs `npm run db:init` (needs `pg`) or `npm run db:migrate:prod` (needs `prisma` CLI), finds empty `node_modules`, and crashes — often silently (container just goes to 0/1 replicas with no clear error in the build log).

## When this applies
- App uses `output: 'standalone'` in `next.config.js`
- Container goes 0/1 immediately after a seemingly successful build
- `NODE_OPTIONS=--require newrelic` is set in Dokploy env
- `start-prod.sh` calls `npm run db:init` or `npm run db:migrate:prod`
- No error in the Docker build log — failure is purely at container startup

## The fix
Add an isolated `runtime-deps` stage that installs newrelic, pg, and prisma fresh. Do NOT cherry-pick transitive deps from the build stage — npm hoisting means they may not exist at top level:

```dockerfile
FROM node:20-bullseye-slim AS runtime-deps
WORKDIR /nr
# Install newrelic and pg (no postinstall needed)
RUN echo '{"dependencies":{"newrelic":"^13.18.0","pg":"^8"}}' > package.json
RUN npm install --omit=dev --ignore-scripts 2>&1 | tail -1
# Install prisma separately so postinstall downloads the migration engine binary
RUN npm install --omit=dev prisma@6.7.0 2>&1 | tail -1

# In runner stage:
COPY --from=builder /app/package.json ./package.json   # needed for npm run scripts
COPY --from=runtime-deps /nr/node_modules ./node_modules
```

Match the prisma version exactly to what the app uses in `package.json`.

## Gotchas
- `COPY --from=deps /app/node_modules/safe-buffer` etc. will fail — npm v7+ hoists some packages into nested `node_modules` (e.g. `pg/node_modules/safe-buffer`) rather than top-level. Always `npm install` fresh instead of cherry-picking.
- `prisma` must NOT use `--ignore-scripts` — its postinstall downloads the migration engine binary needed for `prisma migrate deploy`.
- `package.json` must be copied into the runner so `npm run db:init` can resolve script names via `require('./package.json')`.
- `newrelic` and `pg` can use `--ignore-scripts` safely.

## Context
Repo: proofly, says-the-bible, jpv-bootcamp (all with deploy gates)
Discovered: 2026-04-15
Area: Dockerfile runtime-deps stage, scripts/runtime/start-prod.sh
