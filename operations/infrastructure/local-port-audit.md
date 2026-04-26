# Local Port Audit

## Scope

Reviewed and normalized local app and database ports for:

- `buildflow`
- `firecrawl`
- `prochat`
- `xgrow`

Central registry and docs updated:

- `operations/infrastructure/local-apps.json`
- `operations/infrastructure/local-apps.md`
- `operations/infrastructure/infra.md`

Repo-local changes made where needed:

- `/Users/Office/Repos/prochattools/web/prochat`
- `/Users/Office/Repos/prochattools/saas/xgrow`

Compatibility window note:

- `operations/infrastructure/local-apps.json` remains canonical
- each registry entry keeps both the expanded fields and the legacy aliases during the migration window so ProBot and older readers stay compatible
- ProBot now normalizes local app entries through one helper instead of relying on scattered fallback logic

## Policy

- `3000-3099` reserved for local web app ports
- `5400-5499` reserved for local PostgreSQL ports
- `6300-6399` reserved for Redis ports
- `7000-7099` reserved for internal dashboards and control-plane tools
- `8000-8099` reserved for APIs and supporting services
- Ports are permanent once assigned and must not be reused by unrelated apps or databases
- During the migration window, registry fields are dual-written:
  - `port` mirrors `appPort`
  - `url` mirrors `appUrl`
  - `check` mirrors `healthCheck`
  - `start` mirrors `startCommand`
  - `stop` mirrors `stopCommand`

## Before vs After

| Project | Before | After | Notes |
|---|---:|---:|---|
| BuildFlow | `3054` | `3054` | Stayed on policy; registry now tracks the OpenAPI health probe. |
| Firecrawl | `3002` | `3055` / `5443` | Registry now matches the actual self-host port and moves PostgreSQL into the reserved 54xx range. |
| ProChat | `3056` / `5433` | `3056` / `5434` | App port stayed; local Postgres moved into the reserved 54xx range without colliding with Firecrawl. |
| xGrow | `7080` / `5445` | `7080` / `5445` | Already compliant; only runtime fallbacks and docs were aligned to 7080. |

## Verified Health Checks

- BuildFlow: `http://localhost:3054/api/openapi`
- Firecrawl: `http://localhost:3055/v0/health/liveness`
- ProChat: `http://localhost:3056/api/health`
- xGrow: `http://localhost:7080/api/dashboard/stats`

## Repo-local changes

### ProChat

- `package.json` dev server now binds to `3056`
- `docker-compose.yml` exposes Postgres on host port `5434`
- `scripts/dev/bootstrap-env.js` and `scripts/db/init-tenant.js` now default to `5434`
- `src/libs/site-url.ts` and related docs now default to `3056`
- Developer docs and generated docs were updated to reference `3056` / `5434`

### xGrow

- `src/lib/config.ts` now defaults the app URL and X callback URL to `7080`
- `scripts/scheduler.ts` now defaults to `7080`
- `src/app/api/dashboard/trigger/route.ts` now targets `7080`

### Firecrawl

- No repo-local port change was required
- Registry now uses the actual local self-host entrypoint and health check

### BuildFlow

- No repo-local port change was required
- Registry already matches the app port and OpenAPI health probe

## Commands

### BuildFlow

```bash
cd ~/Repos/stevewesthoek/buildflow
bash buildflow-orchestrator.sh start
```

### Firecrawl

```bash
cd ~/Repos/stevewesthoek/brain/tools/firecrawl
docker compose up -d
```

### ProChat

```bash
cd ~/Repos/prochattools/web/prochat
npm run dev
```

### xGrow

```bash
cd ~/Repos/prochattools/saas/xgrow
npm run dev
```

## Blockers

None. The remaining modified files shown by `git status` in the brain repo are unrelated pre-existing work and were left untouched.
