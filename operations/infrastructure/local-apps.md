# Local Applications Inventory

**Canonical source:** `operations/infrastructure/local-apps.json`

`local-apps.json` is the canonical local runtime registry for the Office Mac. The ProBot dashboard reads it at runtime, and this markdown file mirrors the same data for humans.

During the migration window, registry entries are intentionally dual-compatible: the richer fields are preferred for new consumers, but the legacy aliases remain present so older readers keep working.

## Reserved port policy

- `3000-3099` is reserved for local web app ports.
- `5400-5499` is reserved for local PostgreSQL ports.
- `6300-6399` is reserved for Redis ports.
- `7000-7099` is reserved for internal dashboards and control-plane tools.
- `8000-8099` is reserved for APIs and supporting services when needed.
- Every app gets one permanent reserved app port.
- Every local PostgreSQL database gets one permanent reserved database port.
- A port, once assigned, must never be reused by a different app or database, even if the original service is retired later.
- Do not leave project-local databases on ad hoc defaults like `5432` unless the registry explicitly documents that as intentional.

## Schema

Each entry in `local-apps.json` is a JSON object with these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name shown in the ProBot dashboard |
| `repoPath` | string | yes | Absolute repo path on the Office Mac |
| `appPort` | number | yes | Reserved local app port |
| `appUrl` | string | yes | Browser URL for the running app |
| `healthCheck` | string | yes | URL ProBot pings to determine running/stopped |
| `startCommand` | string | yes | Shell command to start the app |
| `stopCommand` | string \| null | no | Shell command to stop the app, if one exists |
| `restartCommand` | string \| null | no | Shell command to restart the app or multi-service stack, if one exists |
| `startupTimeoutMs` | number \| null | no | Maximum time ProBot waits for the app to become healthy after start |
| `description` | string | yes | One-line description shown in the dashboard card |
| `databaseEngine` | string \| null | no | Database engine used locally, if any |
| `databaseServiceName` | string \| null | no | Database container or service name, if any |
| `databasePort` | number \| null | no | Reserved local database port, if any |
| `databaseName` | string \| null | no | Local database name, if any |
| `databaseUser` | string \| null | no | Local database user, if any |
| `notes` | string \| null | no | Extra local-dev notes or caveats |

### Compatibility window

For every entry, the following aliases are kept in sync:

- `port` mirrors `appPort`
- `url` mirrors `appUrl`
- `check` mirrors `healthCheck`
- `start` mirrors `startCommand`
- `stop` mirrors `stopCommand`
- `restart` mirrors `restartCommand`

New code should prefer the expanded fields. Legacy readers may keep using the old names until they are fully migrated.

## Unified ProBot local-app orchestrator principle

The ProBot dashboard must use one centralized lifecycle path for every Local Apps action. Individual applications may expose repo-local helper scripts, but the dashboard must call them only through the ProBot local-app orchestrator and the canonical registry. No dashboard button should directly implement one-off start, stop, or restart behavior outside that shared path.

The registry defines app identity, reserved port, health check, repo path, startup timeout, and lifecycle commands. The orchestrator owns the runtime sequence and must treat the reserved app port as authoritative runtime state.

Required lifecycle semantics:

1. **Start means clean start**: inspect the reserved port, stop any known current session, verify the port is free, start from `repoPath` with `PORT` injected from the registry, then wait for health.
2. **Stop means verified stop**: run the registry stop command when present, clear remaining listeners on the reserved port when needed, and verify the health check is down or the port is free.
3. **Restart means stop + verified free port + start**: never spawn a second session on the same reserved port.
4. **Operations must be serialized per app**: overlapping clicks or API calls for the same app must not race each other.
5. **The card is the refresh unit**: after a lifecycle action, ProBot should return or poll the affected app/card status instead of forcing a full dashboard reload.

For new local applications, add the app to `local-apps.json` first and provide lifecycle commands that can be safely called by the centralized orchestrator. Prefer repo-local helper scripts for app-specific cleanup, but keep the orchestration rules in ProBot so all apps behave consistently.

## Current inventory

| Name | App Port | DB Port | Description | Start Command |
|------|----------|---------|-------------|---------------|
| ProBot | 7070 | - | ProBot dashboard and automation daemon | `cd ~/Repos/stevewesthoek/brain/projects/probot && npm start > /tmp/probot.log 2>&1 &` |
| Says the Bible | 3058 | 5441 | Says the Bible main app and admin panel | `bash scripts/dev/start-local.sh` |
| Firecrawl | 3055 | 5443 | Web scraping and research API | `cd ~/Repos/stevewesthoek/brain/tools/firecrawl && docker compose up -d` |
| ProChat | 3056 | 5434 | ProChat marketing and conversion site | `cd ~/Repos/prochattools/web/prochat && npm run dev` |
| Via di Eden | 3057 | 5447 | Via di Eden client website with TinaCloud CMS | `cd ~/Repos/stevewesthoek/brain/operations/database/standalone/viadieden && docker compose up -d && cd ~/Repos/prochattools/clients/via-di-eden && bash scripts/dev/start-local.sh` |
| Olive To Organizing | 3059 | 5445 | Olive To Organizing client website with TinaCloud CMS | `cd ~/Repos/stevewesthoek/brain/operations/database/standalone/olivetoorganizing && docker compose up -d && cd ~/Repos/prochattools/clients/olive-to-organizing && bash scripts/dev/start-local.sh` |
| JPV Bootcamp | 3000 | 5444 | JPV Bootcamp landing page, Stripe provisioning, and WordPress sync | `cd ~/Repos/prochattools/clients/jc-citadel/jpv-bootcamp && npm run dev` |
| xGrow | 7080 | 5445 | X (Twitter) growth automation | `cd ~/Repos/prochattools/saas/xgrow && docker compose -f docker-compose.postgres.yml up -d postgres && npm run dev > /tmp/xgrow.log 2>&1 &` |
| Google Ads API | 8001 | - | Google Ads webhook and API server | `supervisorctl start google-ads-http-server` |
| ComfyUI | 8188 | - | Stable Diffusion image generation UI | `~/.local/bin/comfyui-start` |
| Family Finance | 3060 | 5452 | Local-only household finance tracker | `cd ~/Repos/stevewesthoek/brain/operations/database/standalone/familyfinance && docker compose up -d && cd ~/Repos/stevewesthoek/family-finance && PORT=3060 NEXT_PUBLIC_APP_URL=http://localhost:3060 npm run dev > /tmp/family-finance.log 2>&1 &` |
| Fala | 3050 | - | Portuguese language learning app | `echo 'Manual start required'` |
| BuildFlow | 3054 | - | Unified lifecycle for agent (3052), web (3054), and relay (3053) | `bash ~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh start` |

## OrbStack database inventory

The standalone Postgres stacks under `operations/database/standalone/` use these reserved ports:

| App | Host Port | Database |
|-----|-----------|----------|
| Says the Bible | 5441 | `saysthebible` |
| ProChat | 5442 | `prochat` |
| Cedula | 5443 | `cedula` |
| JPV Bootcamp | 5444 | `jpvbootcamp` |
| Oliveto Organizing | 5445 | `olivetoorganizing` |
| StatusLink | 5446 | `statuslink` |
| Via di Eden | 5447 | `viadieden` |
| Resend | 5448 | `resend` |
| ProKit Studio | 5449 | `prokitstudio` |
| SaaSKit Studio | 5450 | `saaskitstudio` |
| OpenFund | 5451 | `openfund` |
| Family Finance | 5452 | `family_finance` |
| ProKit | 5455 | `prokit` |
| SaaSKit | 5457 | `saaskit` |

Only JPV Bootcamp is currently running in OrbStack in this session. The other entries are reserved stacks that remain documented for consistency.

## ComfyUI lifecycle

ComfyUI is a local service, not a database-backed app. ProBot can start and stop it directly via the shared lifecycle helpers:

- Start: `~/.local/bin/comfyui-start`
- Stop: `~/.local/bin/comfyui-stop`
- UI / health: `http://localhost:8188`

## How ProBot loads this file

ProBot reads `local-apps.json` on every `/api/local-apps` request, so changes are live immediately.

File path hardcoded in `projects/probot/src/bot/dashboard.ts`:

```text
~/Repos/stevewesthoek/brain/operations/infrastructure/local-apps.json
```

For each app, ProBot makes a GET request to `healthCheck` with a 5-second timeout. If it gets a 2xx response the app is **running**; otherwise **stopped**.
ProBot starts apps from their `repoPath` and injects `PORT` from the registry when a port is defined, so commands can stay repo-relative and avoid stale hardcoded paths.
The dashboard restart action is registry-driven:

- if `restartCommand` exists, ProBot runs that helper for the app
- otherwise ProBot uses the shared stop/start lifecycle and waits for stop and health recovery
- if an app has multi-service or cleanup requirements, put them in a dedicated helper script and reference it from `restartCommand`

Current custom restart helpers:

- `BuildFlow` -> `~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh restart` (production-grade orchestrator with fact-checking)
- `xGrow` -> `~/Repos/prochattools/saas/xgrow/restart-xgrow.sh`

Current explicit stop helpers:

- `Says the Bible` -> `~/Repos/prochattools/web/says-the-bible/scripts/dev/stop-local.sh`
- `ComfyUI` -> `~/.local/bin/comfyui-stop`
- `Firecrawl` -> `~/Repos/stevewesthoek/brain/tools/firecrawl/stop-firecrawl.sh`
- `BuildFlow` -> `~/Repos/stevewesthoek/buildflow/buildflow-orchestrator.sh stop` (production-grade orchestrator with fact-checking)
- `xGrow` -> `~/Repos/prochattools/saas/xgrow/stop-xgrow.sh`
- `Olive To Organizing` -> `~/Repos/prochattools/clients/olive-to-organizing/scripts/dev/stop-local.sh`

For local dashboard launches, prefer a restart-safe wrapper script when the package has a slow `predev` chain or when editors need a one-click restart path.
Apps may also set `startupTimeoutMs` in `local-apps.json` when their boot path is slower than the default 30 seconds.
The dashboard start button is non-blocking: it flips the card into a `STARTING` state immediately and polls until the app becomes healthy or the startup timeout elapses.
The restart button is only shown for running apps so the control surface stays consistent and avoids ambiguous states.
Olive To Organizing local Tina admin is available at `http://localhost:3059/admin/index.html`.

## BuildFlow Orchestrator

BuildFlow (port 3054) uses a production-grade orchestrator to manage three services:

- **Agent** (port 3052) - Local CLI server for vault operations
- **Relay** (port 3053) - Docker-based bridge for device coordination
- **Web** (port 3054) - Next.js dashboard UI

The orchestrator (`buildflow-orchestrator.sh`) provides:

✅ **Fact-checking** — lsof/ps/curl verification at each step
✅ **Atomic operations** — All-or-nothing, no partial states
✅ **Graceful shutdown** — SIGTERM→SIGKILL escalation
✅ **Health verification** — Unified endpoint validates all three services
✅ **Audit trail** — Full event log in `.buildflow/events.log`
✅ **OrbStack-only** — No Docker Desktop assumptions

**Health verification:**
```
GET http://localhost:3054/api/unified-health
→ 200 OK if all services healthy
→ 503 UNAVAILABLE if any service unhealthy
```

For complete BuildFlow orchestrator documentation, see:
`buildflow/ORCHESTRATOR_GUIDE.md` and `buildflow/PROBOT_INTEGRATION.md`

## Editing rules

1. Edit `operations/infrastructure/local-apps.json` first.
2. Keep this markdown table aligned with the JSON registry.
3. New apps should provide `startCommand`, `stopCommand`, and, when needed, `restartCommand`.
4. Keep lifecycle helpers repo-local and registry-driven rather than hardcoding dashboard-specific exceptions.
5. Update repo-local config/docs at the same time if a reserved port changes.
6. Never recycle a retired port for a different local app or database.
7. **BuildFlow:** Do not edit start/stop/restart commands; they invoke the canonical orchestrator script. Update in buildflow repo only.
