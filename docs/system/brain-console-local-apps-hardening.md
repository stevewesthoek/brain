# Brain Console Local Apps Hardening

**Date:** 2026-06-04  
**Status:** UI compacted; registry extended; safe metadata surfaced; backend guarantees partially implemented  
**Surface:** `projects/brain-console/app/local-apps`  
**Backend:** Brain Core Local Apps orchestrator

## What changed

The Local Apps view was converted from a vertically stacked table/card layout into a compact paged app grid with tabs:

- Apps
- Actions
- Policy

The finalized desktop contract is a bounded `2 x 2` app-card grid with four apps per page and horizontal page controls below the grid. This prevents card/button overlap and avoids dragging through a long vertical card stack on normal laptop fullscreen views.

The app grid now:

- prioritizes running apps first
- shows one compact card per app
- shows app, service, and database ports when Brain Core provides them
- shows container/database infrastructure metadata when Brain Core provides it
- shows health and last-updated data
- opens the app URL with the Open button
- shows Start/Restart and Stop controls where Brain Core reports support
- shows per-app dynamic pending/action status while an action is running
- uses smaller typography and denser spacing
- uses `JetBrainsMono Nerd Font` for code/data/log-like fields

The canonical local app registry was extended with:

```text
Brain Core API        → brain-core-api        → port 4877
Brain Console        → brain-console         → port 4881
```

## Current validation

Validated after the Local Apps UI, registry, and metadata-contract changes:

```text
✓ operations/infrastructure/local-apps.json is valid JSON
✓ projects/brain-core typecheck passes
✓ projects/brain-console typecheck passes
✓ projects/brain-console production build passes
```

## Current Brain Core guarantees already present

The Brain Core local app executor currently provides these guarantees:

- per-app action lock prevents concurrent actions for the same app
- unsupported actions return structured `not_executable` results
- action errors are caught and converted to structured results
- start checks whether the app is already running/healthy before launching
- start runs database phase before app phase when the app has modeled database metadata
- start verifies app health after launch
- stop runs app stop command first
- stop verifies the app stopped before database shutdown is considered complete
- restart uses a controlled composite stop/start path when allowlisted commands exist
- action status is exposed through `/local-apps/actions/status`

## Gaps before calling this fully hands-off

The dashboard UX now shows live status, but the backend guarantee model still needs additional hardening before we can honestly call the lifecycle hands-off and stale-instance-proof for every app.

Required backend gaps:

1. **Explicit stale-port preflight**
   - Before start, Brain Core should check every app service port and database port.
   - If the port is occupied by an unknown process, return `blocked_stale_instance` with process metadata when safe.
   - If the port is occupied by a known managed process and it is healthy, return `already_running`.

2. **Port-free verification after stop**
   - Stop should verify every modeled service port and database port is free.
   - If ports remain occupied, return `failed` with exact blocked ports.

3. **Multi-service port support in action results** — implemented for start/stop verification
   - Apps like BuildFlow expose multiple service ports.
   - Start verification now checks modeled service ports in addition to the primary app port.
   - Stop verification now checks every modeled app/service port and force-clears ports that remain occupied after graceful stop.
   - Action result steps include per-port verification steps.

4. **OrbStack/container health checks**
   - Apps with `dockerContainerName` or compose-managed databases should expose container status in Local Apps data.
   - Start should start required containers where safe.
   - Stop should stop required containers where safe.
   - Action results should report container health transitions.

5. **Brain Console restart orchestration**
   - Restarting Brain Console from its own UI requires a supervisor outside the browser/web process.
   - Brain Core can expose a safe composite action that restarts:
     - Brain Core API
     - Brain Console dev server
   - The UI should call that orchestrated action and then poll both ports until healthy.

6. **Registry-level lifecycle strategy flags**
   - Each app should state whether lifecycle is:
     - fully managed
     - partially managed
     - inventory-only
     - manual-only
   - UI buttons should remain disabled unless the strategy is fully or safely partially managed.

## Required endpoint additions or response extensions

Recommended next Brain Core contract extensions:

```text
GET  /local-apps/dashboard
POST /local-apps/:id/start
POST /local-apps/:id/stop
POST /local-apps/:id/restart
```

should include or return:

```ts
type LocalAppPortCheck = {
  port: number
  kind: 'app' | 'service' | 'database'
  status: 'free' | 'occupied_known' | 'occupied_unknown' | 'healthy' | 'unhealthy' | 'unknown'
  label?: string
  pid?: number
  processName?: string
  message?: string
}

type LocalAppContainerCheck = {
  name: string
  engine: 'orbstack' | 'docker' | 'compose'
  status: 'running' | 'stopped' | 'healthy' | 'unhealthy' | 'unknown'
  message?: string
}
```

Action results should expose ordered phases:

```text
preflight_ports
preflight_containers
stop_existing_known_processes
start_containers
start_services
verify_health
postflight_ports
postflight_containers
```

## UI follow-up after backend hardening

Once Brain Core exposes richer port/container/action phases, the Local Apps card should show a compact status drawer or popover per app:

- current action phase
- port checks
- container checks
- last action result
- exact reason when blocked

The page should remain compact and avoid returning to a vertical logs-first layout.

## Non-goal

Do not add raw shell command fields to the UI. The dashboard must continue calling Brain Core allowlisted actions only.
