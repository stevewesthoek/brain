# Local Infrastructure — Application Registry and Orchestration

This directory contains the canonical configuration for local application lifecycle management.

## Quick Start: Adding a New App

1. Read: `LOCAL_APP_ONBOARDING_STANDARD.md` (mandatory)
2. Edit: `local-apps.json` (add your app)
3. Implement: `scripts/dev/start-local.sh`, `stop-local.sh`, `restart-local.sh` (in your repo)
4. Implement: `/api/health` endpoint (in your app)
5. Edit: `local-apps.md` (update Current Inventory)
6. Test: `npm run --prefix projects/brain-core test:local-app-actions-live`
7. Verify: Brain Console shows your app with green health

Missing any step results in disabled actions with diagnostic reason.

## Files

- **`local-apps.json`** — Canonical registry (read by Brain Core)
- **`LOCAL_APP_ONBOARDING_STANDARD.md`** — How to add an application (mandatory)
- **`local-apps.md`** — Human-readable inventory and port policy
- **`database/standalone/*/docker-compose.yml`** — OrbStack PostgreSQL stacks

## How It Works

```
Registry entry in local-apps.json
        ↓
Brain Core validates required fields
        ↓
Brain Console shows Start/Stop/Restart buttons (if valid)
        ↓
User clicks Start → Brain Core runs lifecycle script
        ↓
Brain Core verifies health endpoint
        ↓
Status updates in Brain Console
```

## Core Rules

**Mandatory:**
1. One fixed reserved port per app (never reused)
2. All apps follow the onboarding standard
3. Registry entries have all required fields
4. Lifecycle scripts are repo-local
5. Health check must return 200 when ready

**Safety:**
1. Scripts don't read `.env` files
2. No `pkill`, `killall`, or `lsof` for process killing
3. No hardcoded ports
4. No shell globs for commands
5. No secrets in logs

## Port Ranges

- `3000–3099` — Web applications
- `5400–5499` — PostgreSQL
- `6300–6399` — Redis
- `7000–7099` — Internal dashboards
- `8000–8099` — APIs and services

See `local-apps.md` for current reservations.

## Troubleshooting

**App shows disabled in Brain Console:**
- Check `local-apps.json` has all required fields
- Verify health endpoint returns 200
- Run: `npm run --prefix projects/brain-core test:local-app-actions-live` for diagnostics

**Start times out:**
- Increase `startupTimeoutMs` if app is slow
- Verify health endpoint works: `curl http://localhost:YOUR_PORT/api/health`
- Check `/tmp/{app-name}.log` for errors

**Stop doesn't work:**
- Verify stop script path in registry
- Verify `/tmp/{app-name}.pid` exists
- Run stop script manually to see errors

## Brain Core Orchestration

Brain Core (`projects/brain-core/src/adapters/local-app-stack-orchestrator.ts`) provides unified orchestration:

1. Stop app gracefully (SIGTERM → SIGKILL)
2. Free all registered ports
3. Verify ports are actually free
4. Start app from repoPath with PORT injected
5. Verify health endpoint returns 200
6. Record action in audit log

All apps go through this path.

## Multi-Service Applications

If your app has multiple internal services:

1. Create one unified health endpoint
2. Return 200 only if all services are healthy
3. Return 503 if any are degraded
4. Register the unified endpoint in `healthCheck` field

See `LOCAL_APP_ONBOARDING_STANDARD.md` section "Health Endpoint" for details.

## Current Status

- 16 apps in registry
- 38 executable actions (start/stop/restart)
- 10 intentionally disabled actions
- 526 Brain Core tests passing

---

**Last updated:** 2026-05-24
