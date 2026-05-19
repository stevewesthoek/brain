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
- Start/stop/restart remain disabled until a Brain Core allowlisted path is approved.
- Action plans are read-only descriptions, not execution commands.

## Current status

- `GET /local-apps/orchestrator` returns the registry summary.
- `GET /local-apps/onboarding-checklist` returns the standard onboarding policy.
- `GET /local-apps/action-plans` returns declarative plans only.
- Model Router is surfaced from Brain Core runtime-report sources.
