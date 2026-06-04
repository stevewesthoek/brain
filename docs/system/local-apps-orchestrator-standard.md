# Local Apps Orchestrator Standard

Brain Core now models local apps as a declarative registry plus an orchestration plan layer.

## Standard shape

- Canonical app id
- Fixed localhost app port
- Optional OrbStack database with explicit host/container ports
- One or more ordered services
- Readable docs reference
- Declarative start/stop/restart action plans

## Safety

- Brain Console never executes shell commands.
- Brain Console start/stop/restart buttons call only canonical Brain Core HTTP endpoints.
- Brain Core accepts only canonical app ids and the fixed actions `start`, `stop`, and `restart`.
- Raw command strings are never accepted from the UI and never shown in the UI.
- Unsupported apps return structured `not_executable` action results instead of fake success.
- Command override input is ignored/rejected at the route boundary and reflected as `commandOverrideAccepted: false`.
- Every action route is wrapped in a crash-safe boundary; failures become structured JSON.

## Current status

- `GET /local-apps/orchestrator` returns the registry summary.
- `GET /local-apps/onboarding-checklist` returns the standard onboarding policy.
- `GET /local-apps/action-plans` returns declarative plans only.
- `GET /local-apps/actions/status` returns in-flight actions, recent action results, last error by app, and lock state.
- `POST /local-apps/:id/start|stop|restart` returns a structured controlled action result.
- Mind Steward is surfaced from Brain Core runtime-report sources.
- Fala is surfaced from the canonical local-app registry as a managed local-first app on port `3050`; the Obsidian dashboard reads it through Brain Core rather than hardcoding it in the plugin.

## Stability Fix

Crash cause found during the Local Apps actions pass:

- The dashboard payload advertised every app action as enabled even when no approved execution strategy existed for that app/action.
- Clicking Start could therefore call an action path that was not robust enough for real runtime failures.
- The route now calls a central `executeLocalAppActionRequest` boundary and catches unexpected errors before they can escape the API handler.

## Button Enablement

- Buttons are enabled only when the specific app/action has an approved Brain Core execution strategy.
- Apps with only inventory metadata show disabled Start/Stop/Restart controls with a reason.
- Direct POST calls for unsupported apps still return structured `not_executable` JSON and do not crash Brain Core.

## Brain Console layout

- The Apps tab uses a full-width compact operations grid, not the general three-column dashboard grid.
- App cards are micro cards with name, status, health, managed marker, port, service count, optional database marker, and Start/Stop/Restart controls.
- Policy and onboarding details are placed below the app grid so the inventory stays above the fold.

## Execution sequence

- `start`: validate app id, validate action, database before services, services in `startOrder`, health check, report result.
- `stop`: validate app id, validate action, services in `stopOrder`, database after services, report result.
- `restart`: controlled stop sequence followed by controlled start sequence.
- OrbStack database metadata is modeled, but apps without a safe DB/service execution strategy return `not_executable`.
- Long-running foreground commands are not launched from the current runner. Future safe runners must detach/background or return `accepted` quickly and rely on status polling.



## Brain Console Center Local Apps pass — 2026-06-04

Brain Console Center now uses a compact tabbed Local Apps layout. Apps are shown as dense cards, sorted with running apps first, paginated to reduce scrolling, and labels/ids wrap instead of being clipped. Data-like fields use the configured monospace font.

Per-card status badges now combine local mutation state and Brain Core in-flight action state, so Start, Restart, and Stop show immediate working feedback while the action is running.

The canonical registry now includes Brain Core API on port `4877` and Brain Console Center on port `4881`.

Full hands-off restart of Brain Console Center plus Brain Core still requires a supervisor/orchestrator outside the browser and outside the process being restarted. Until that exists, unsupported lifecycle actions must remain disabled or return structured `not_executable` results.
