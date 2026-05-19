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

## Current status

- `GET /local-apps/orchestrator` returns the registry summary.
- `GET /local-apps/onboarding-checklist` returns the standard onboarding policy.
- `GET /local-apps/action-plans` returns declarative plans only.
- `POST /local-apps/:id/start|stop|restart` returns a structured controlled action result.
- Model Router is surfaced from Brain Core runtime-report sources.

## Brain Console layout

- The Apps tab uses a full-width compact operations grid, not the general three-column dashboard grid.
- App cards are micro cards with name, status, health, managed marker, port, service count, optional database marker, and Start/Stop/Restart controls.
- Policy and onboarding details are placed below the app grid so the inventory stays above the fold.

## Execution sequence

- `start`: validate app id, validate action, database before services, services in `startOrder`, health check, report result.
- `stop`: validate app id, validate action, services in `stopOrder`, database after services, report result.
- `restart`: controlled stop sequence followed by controlled start sequence.
- OrbStack database metadata is modeled, but apps without a safe DB/service execution strategy return `not_executable`.
