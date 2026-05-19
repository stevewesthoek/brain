# ProBot Local Apps Migration Audit

Date: 2026-05-19

## Scope

Audit the ProBot Local Apps implementation, identify what is safe to reuse, and define the Brain Console/Brain Core migration boundary for inventory plus controlled app lifecycle actions.

## ProBot Local Apps Features Found

- Registry-backed local app inventory.
- Start, stop, and restart lifecycle fields per app.
- Port, URL, health check, repo path, runtime env, and notes metadata.
- Health/status derivation from check endpoint plus port occupancy.
- Legacy dashboard wiring for start/stop/restart request flow.

## App Fields Shown in ProBot

- Name.
- Port / URL.
- Health check.
- Start / stop / restart commands.
- Description.
- Repo path.
- Runtime env/path prepend notes.
- Database metadata where present.

## Start/Stop/Restart Behavior Found

- ProBot routes lifecycle actions through a centralized dashboard flow.
- The legacy path still uses command strings stored in the registry.
- This is suitable for inventory/reference, but not for direct Obsidian execution.

## Command Execution Path Found

- ProBot dashboard and Brain Core both expose lifecycle action routes.
- Brain Core POST routes now return structured local-app action results through the canonical app-id orchestration adapter.
- No arbitrary shell execution path should be introduced in Brain Console.
- The stability pass added a crash-safe action boundary so route failures return structured JSON instead of escaping the API handler.

## Safety Risks

- Registry command strings can point at shell commands.
- Unbounded command execution from Obsidian would violate the dashboard boundary.
- Sensitive values must never be surfaced in the UI.
- Start/stop controls must call Brain Core only, require confirmation, and return structured results for unsupported apps instead of pretending to execute.
- The previous dashboard action payload incorrectly made controls look enabled even when no per-app execution strategy existed.
- Button enablement must be per app/action, not global.

## Parts Worth Reusing

- Registry-driven inventory.
- Safe health/status derivation.
- Read-only dashboard summary concepts.
- Per-app metadata: URL, port, category, notes, source, managed flag.

## Parts To Rebuild

- Any direct shell execution path.
- Any UI that accepts raw commands.
- Any control surface that assumes enabled mutation without allowlist/confirmation.
- Any layout that relies on terminal-style rendering.

## Brain Core Equivalents Already Available

- `GET /local-apps`
- `GET /local-apps/dashboard`
- `GET /local-apps/action-readiness`
- `GET /local-apps/orchestrator`
- `GET /local-apps/onboarding-checklist`
- `GET /local-apps/action-plans`
- `GET /local-apps/:id/action-plan/:action`
- `POST /local-apps/:id/start|stop|restart`
- Runtime report parsing for local apps and model-router runtime status

## Brain Console Gaps

- Per-app executable strategies still need to be registered for apps that can safely be started or stopped.
- Persistent audit logging is planned beyond the current structured action result.
- `GET /local-apps/actions/status` now exposes recent/in-flight action state for dashboard refreshes.

## Recommended Migration Architecture

1. Use Brain Core as the safe source of truth for local-app inventory.
2. Add a dedicated read-only dashboard payload for Brain Console.
3. Add a separate readiness payload for future controlled actions.
4. Route Start/Stop/Restart buttons through Brain Core only, using canonical app ids and fixed actions.
5. Return `not_executable` for apps without a registered safe execution strategy instead of exposing raw commands.
6. Enable buttons only when the app/action has an approved execution strategy; otherwise keep them disabled with a reason.

## Model Router Check

- `Model Router` exists in Brain Core runtime-report and scheduler context, but it is not registered as a canonical local-app row in `operations/infrastructure/local-apps.json`.
- Brain Console surfaces it through the orchestrator/dashboard transformation when runtime-report data is present.
- Do not invent unsafe command semantics; use the same controlled action result path as every other app.
- If Model Router later gets a canonical local-app registration, it should inherit the same safe inventory transformation.
