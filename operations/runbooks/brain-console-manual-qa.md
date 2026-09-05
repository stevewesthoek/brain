# Brain Console Manual QA Runbook

> **Superseded historical QA checklist.** The Brain Console 2.0 release is
> complete. Use `operations/runbooks/brain-console-2-operations.md` for the
> current release smoke test and recovery procedure. This dated checklist is
> retained for historical regression context and is not an active migration
> gate.

**Status:** historical Phase 1 checklist
**Dashboard:** Brain Console  
**Port:** `4881`  
**Brain Core:** `http://localhost:4877`  
**Related docs:**

- `projects/brain-console/README.md`
- `docs/system/brain-console-architecture.md`
- `operations/runbooks/brain-console-2-operations.md`

## Purpose

This runbook verifies that Brain Console is operational in the browser after Phase 1 build validation.

Build validation proves the app compiles. Manual QA proves it is usable as a local operations dashboard.

## Start services

Preferred macOS operator path:

```bash
/opt/homebrew/bin/node tools/scripts/install-brain-console-app.mjs
open "$HOME/Applications/Brain Console.app"
```

The app reuses the existing persistent `com.office.brain-core` LaunchAgent,
starts Brain Console only when needed, and opens the monitoring tab after both
local services are ready. It does not kill an unknown process on either
port. If the app reports an ownership conflict, inspect the diagnostic log at
`~/Library/Logs/Brain Console/launcher.log` and resolve the conflict manually.

Fallback developer path:

From the Brain repo:

```bash
cd projects/brain-core
npm start
```

In another terminal:

```bash
cd projects/brain-console
npm run dev
```

Open:

```text
http://localhost:4881
```

## Preflight checks

Before testing dashboard behavior:

- [ ] Brain Core responds at `http://localhost:4877/status`.
- [ ] Brain Console opens at `http://localhost:4881`.
- [ ] Topbar shows Brain Core as online.
- [ ] No browser console errors appear on initial page load.
- [ ] Navigation works on desktop width.
- [ ] Navigation works on mobile/narrow width.

## Overview page

- [ ] Overview page loads without crashing.
- [ ] CPU load card renders.
- [ ] Memory pressure card renders.
- [ ] GPU load card renders as not-instrumented when no GPU telemetry exists.
- [ ] Uptime card renders.
- [ ] Codex current window card renders as value or not-instrumented.
- [ ] Codex 5-hour window card renders as value or not-instrumented.
- [ ] Codex 7-day window card renders as value or not-instrumented.
- [ ] Claude Code Haiku cost card renders as value or not-instrumented.
- [ ] Claude Code Sonnet cost card renders as value or not-instrumented.
- [ ] Claude Code Opus cost card renders as value or not-instrumented.
- [ ] Cards show freshness/status and last-updated information.
- [ ] Auto-refresh does not visually flicker or reset layout.

## Local Applications page

- [ ] Local Apps page loads without crashing.
- [ ] App inventory table renders.
- [ ] Every app has a name/label.
- [ ] Every app has a canonical id.
- [ ] Ports are shown when available.
- [ ] Open button opens `http://localhost:<port>` when a port is available.
- [ ] Start/Restart button is enabled only when Brain Core reports support.
- [ ] Stop button is enabled only when Brain Core reports support.
- [ ] Disabled buttons expose a meaningful reason through title/disabled state.
- [ ] Triggering a supported action calls Brain Core only.
- [ ] After action mutation, Local Apps data refetches.
- [ ] Action readiness panel renders without exposing secrets.
- [ ] Action status panel renders without exposing secrets.

## AWS Video page

- [ ] AWS Video page loads without crashing.
- [ ] Pipeline status request succeeds or shows a clear partial-error state.
- [ ] Recent jobs table renders.
- [ ] Selecting a job updates the selected job panel.
- [ ] Selected job progress renders.
- [ ] Timeline renders for selected job.
- [ ] Artifacts panel renders.
- [ ] AWS execution panel renders.
- [ ] Create draft form validates channel id and prompt length.
- [ ] Create draft calls `POST /api/video-orchestrator/jobs/create-from-prompt`.
- [ ] Approve script calls `POST /api/video-orchestrator/scripts/:jobId/approve`.
- [ ] Request changes calls `POST /api/video-orchestrator/scripts/:jobId/request-changes`.
- [ ] Generate calls `POST /api/video-orchestrator/scripts/:jobId/generate`.
- [ ] No UI exposes `/changes`.
- [ ] No UI exposes YouTube publish controls.
- [ ] Activity/error feed updates after actions.

## Settings page

- [ ] Settings page loads.
- [ ] Brain Core URL is visible.
- [ ] Dashboard port is visible.
- [ ] Safety boundary is visible.
- [ ] Legacy dashboard policy is visible.

## Responsive checks

Test at:

```text
1440px desktop
1024px laptop/tablet
768px tablet
390px mobile
```

Required behavior:

- [ ] Navigation remains usable.
- [ ] Tables are horizontally scrollable rather than clipped.
- [ ] Cards wrap cleanly.
- [ ] Text does not overflow cards.
- [ ] Action buttons remain reachable.

## Failure-state checks

Stop Brain Core temporarily and verify:

- [ ] Topbar shows offline/error state.
- [ ] Overview shows section-level errors without blanking the app shell.
- [ ] Local Apps shows section-level errors without crashing.
- [ ] AWS Video shows section-level errors without crashing.

Restart Brain Core and verify:

- [ ] Topbar returns to online.
- [ ] Pages recover through auto-refresh or manual refresh.

## QA result template

```text
Date:
Tester:
Brain Core commit:
Brain Console commit:
Browser:
Result: pass / partial / fail

Findings:
- 

Historical required fixes recorded before the next migration slice:
- 
```

## Exit criteria

Manual QA passes when:

- Overview, Local Apps, AWS Video, and Settings all load.
- No page crashes when Brain Core is online.
- No page crashes when Brain Core is offline.
- Local Apps actions are gated by Brain Core support.
- AWS Video uses `/request-changes`, not `/changes`.
- YouTube publish controls remain absent.
- Mobile/narrow layout is usable.

After this runbook passes, the next implementation slice can start.
