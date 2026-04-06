---
name: docker-postgresql-client-pgdg
description: When a container crashes at startup because psql version doesn't match the server — Debian bullseye's default apt installs postgresql-client v13, but the Dokploy PostgreSQL server is v15. Install via the PGDG apt repo.
---

# Docker PostgreSQL Client Version Mismatch (PGDG Fix)

## The insight
`apt-get install postgresql-client` on `node:20-bullseye` installs version 13 — whatever was current when the Debian bullseye apt repo was frozen. If the Postgres server is v15 and the app's startup script enforces a version match (common in deploy-gate patterns that run migrations or registry lookups), the container crashes immediately on start despite a successful Docker build. Build logs look completely clean; the failure only surfaces at runtime.

## When this applies
- App builds successfully but returns 502 bad gateway
- Container logs show: `missing required command: psql` or a psql version mismatch error
- Start script calls `psql` for migrations, deploy gates, schema checks, or tenant registry lookups
- Dokploy PostgreSQL server version is **15**

The tricky part: the build succeeds with no errors. The failure is invisible until the container tries to start.

## The fix
Install `postgresql-client-15` via the PGDG apt repository in the runner stage:
```dockerfile
FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends curl gnupg lsb-release && \
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && apt-get install -y --no-install-recommends postgresql-client-15 && \
    rm -rf /var/lib/apt/lists/*
```

## Gotchas
- The Dokploy-hosted PostgreSQL server is v15 — always use `postgresql-client-15`
- `node:20-bullseye-slim` needs the same PGDG treatment (slim images have even fewer pre-installed packages)
- Don't use `postgresql-client` (unversioned) even if it resolves without error — it may install v13 and fail silently until the version check runs at container start
- `curl` and `gnupg` must be installed before the PGDG key can be fetched — include them in the same RUN layer

## Context
Repo: says-the-bible (prochattools/web/says-the-bible)
Discovered: 2026-04-06
Area: Dockerfile runner stage, scripts/runtime/start-prod.sh deploy gate
