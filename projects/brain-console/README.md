# Brain Console

**Status:** Phase 1 implemented and build-validated; retained specialist surface
**Role:** optional browser diagnostics/operations surface; **not** the primary human cockpit
**Port:** `4881`  
**Data source:** Brain Core API only

The canonical primary human cockpit is the **Obsidian Brain Console plugin**. Brain Core remains the shared headless API/control/safety boundary beneath both surfaces.

```text
Obsidian Brain Console (primary cockpit) ─┐
                                         ├─→ Brain Core API → runtime/job/config sources
Port-4881 Brain Console (optional) ──────┘
```

CLR Decision Center work belongs only in the Obsidian cockpit. Do not add a second Decision Center to this web app. This project remains available for justified specialist browser diagnostics and operational surfaces until a separate evidence-backed cleanup/decommission decision is approved.

## Run

```bash
cd projects/brain-console
npm install
npm run dev
```

Open:

```text
http://localhost:4881
```

## macOS Brain Console launcher

The version-controlled launcher is `tools/brain-console-launcher.mjs`. Install
the thin user-facing app with:

```bash
/opt/homebrew/bin/node tools/scripts/install-brain-console-app.mjs
```

This installs `~/Applications/Brain Console.app`. The app checks the managed
Brain Core LaunchAgent on port `4877`, reuses or starts the on-demand Console
on port `4881`, waits for bounded readiness, and opens `/monitoring`. Repeated
launches are serialized and reuse healthy canonical processes. An occupied
port whose owner is not the canonical Brain process is reported and never
terminated automatically.

Brain Core remains persistent through the existing
`com.office.brain-core` LaunchAgent. Brain Console remains on-demand; the app
does not add a login item or alter Dock preferences. Drag the installed app to
the Dock if desired. Diagnostics are written to
`~/Library/Logs/Brain Console/` with bounded rotation and without environment
or credential dumps.

To rebuild and reinstall after a source update, run `npm ci` and `npm run
build` in `projects/brain-core` and `projects/brain-console`, then rerun the
installer. The installer records the version-controlled checkout path in the
thin wrapper, so reinstall from the intended canonical checkout. To remove
the app, move `~/Applications/Brain Console.app` to the macOS Trash; removing
the app does not stop the persistent Core LaunchAgent.

Failure diagnosis starts with the launcher log, then these bounded identity
checks:

```bash
tail -50 "$HOME/Library/Logs/Brain Console/launcher.log"
launchctl print "gui/$(id -u)/com.office.brain-core"
lsof -nP -iTCP:4877 -sTCP:LISTEN
lsof -nP -iTCP:4881 -sTCP:LISTEN
```

The startup decision is: healthy canonical Core → reuse; otherwise reconcile
the existing Core LaunchAgent or stop on an ownership conflict; healthy
canonical Console → reuse; otherwise start Console and wait up to 60 seconds;
open `/monitoring` only after readiness succeeds.

Brain Core must be available at:

```text
http://localhost:4877
```

Override in the browser build with:

```bash
NEXT_PUBLIC_BRAIN_CORE_URL=http://localhost:4877 npm run dev
```

## Architecture and design rules

Read these before changing Brain Console UI or API contracts:

```text
docs/system/brain-console-architecture.md
docs/system/brain-console-design-system.md
```

## Phase 1 surfaces

- Overview cards from `/ops/system-metrics`, `/ops/ai-usage-windows`, and `/ops/ai-costs`
- Local Applications from `/local-apps/dashboard`, `/local-apps/action-readiness`, and `/local-apps/actions/status`
- Dokploy status from `/infra/dokploy`
- Canonical New Relic production host telemetry from `/infra/telemetry` (the legacy `/infra/monitoring` view remains available)
- Office nightly scheduler status from `/infra/scheduler`
- Cloudflare Tunnels from `/infra/tunnels`
- Video Analyzer from `/research/video-analysis` and `/research/video-analysis/history`
- AWS Video Pipeline from the current Brain Core AWS Video endpoints

The Overview surface also shows the read-only Infinite Brain review queue from `/projections/review`, including items needing attention and terminal decision counts. It is a visibility aid only: review decisions remain in the Mind Steward workflow, and the Console does not approve, promote, or write Mind.

## Design system

Before changing the UI or operational contracts, read:

```text
docs/system/brain-console-architecture.md
docs/system/brain-console-design-system.md
```

The dashboard follows a shadcnblocks admin-dashboard style: compact shell, left navigation, page tabs, bounded cards, clear status states, and no overlapping controls.

## Safety

- The browser never executes shell commands.
- Start/stop/restart buttons call Brain Core only.
- Unsupported actions remain disabled and explain why.
- YouTube publishing routes exist in Brain Core but are intentionally absent from Phase 1.



## Validate

```bash
npm run typecheck
npm run build
```

Current Phase 1 validation:

```text
✓ typecheck passes
✓ production build passes
```

## Current AWS Video contract

Use the current Brain Core route for requesting script changes:

```text
POST /api/video-orchestrator/scripts/:jobId/request-changes
```

Do not use the older `/changes` path.

## Phase 1 parity

See:

```text
docs/system/brain-console-phase-1-parity-checklist.md
```



## Manual QA

Before importing the next legacy-dashboard feature slice, run:

```text
operations/runbooks/brain-console-manual-qa.md
```
