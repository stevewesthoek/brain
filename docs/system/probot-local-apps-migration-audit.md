# ProBot Local Apps Migration Audit

Date: 2026-05-19

## Scope

Audit the ProBot Local Apps implementation, identify what is safe to reuse, and define the Brain Console/Brain Core migration boundary for read-only inventory plus controlled-action readiness.

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
- Existing Brain Core POST routes are approval/request-oriented and must remain behind explicit safe allowlisting before any UI enablement.
- No arbitrary shell execution path should be introduced in Brain Console.

## Safety Risks

- Registry command strings can point at shell commands.
- Unbounded command execution from Obsidian would violate the dashboard boundary.
- Sensitive values must never be surfaced in the UI.
- Start/stop controls must remain disabled until Brain Core allowlist and confirmation UX are in place.

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
- `POST /local-apps/:id/start|stop|restart`
- Runtime report parsing for local apps

## Brain Console Gaps

- No dedicated safe dashboard payload for local apps.
- No action-readiness summary.
- No clearly disabled control UX with reason strings.
- No full inventory card grid that shows every known app.

## Recommended Migration Architecture

1. Use Brain Core as the safe source of truth for local-app inventory.
2. Add a dedicated read-only dashboard payload for Brain Console.
3. Add a separate readiness payload for future controlled actions.
4. Keep start/stop/restart controls disabled until the allowlisted safe action path exists.
5. Surface disabled reasons and next safe step instead of exposing raw commands.

## MarbleRiver Check

- No `MarbleRiver` entry was found in `operations/infrastructure/local-apps.json` or the current ProBot/Brain Core local-app codepaths inspected in this pass.
- Do not invent a MarbleRiver row in Brain Console.
- If MarbleRiver appears in a later safe source of truth, it should be surfaced by the dashboard inventory transformation without changing the safety model.

