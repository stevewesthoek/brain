# Brain Console Center Implementation Plan

**Date:** 2026-06-03  
**Status:** Phase 1 implemented; validation passing  
**Related roadmap:** `docs/system/brain-console-center-roadmap.md`  
**Leading dashboard:** Brain Console Center  
**Legacy dashboards:** ProBot dashboard, Brain Console Obsidian Plugin, Brain Console Web

## Objective

Create Brain Console Center as the single leading local operations dashboard for the `brain` repo.

The implementation must preserve the successful architectural boundary from previous attempts:

```text
Dashboard UI → Brain Core API → safe adapters/runtime sources
```

It must avoid the failure mode of earlier dashboards:

```text
Dashboard UI → direct files / shell / duplicated state / custom ad hoc logic
```

## Implementation rule

Brain Console Center is a new project. Do not modify the three legacy dashboard codebases for Phase 1 except documentation labels and migration references.

## Current endpoint decision

A current route review found that Phase 1 must use the current AWS Video script-change endpoint:

```text
POST /api/video-orchestrator/scripts/:jobId/request-changes
```

Do not use the older `/changes` path in Brain Console Center.

The review also found controlled YouTube publish endpoints. They are intentionally out of scope for Phase 1:

```text
POST /api/video-orchestrator/jobs/:jobId/publish/youtube/dry-run
POST /api/video-orchestrator/jobs/:jobId/publish/youtube
```

## Existing Brain Core API coverage

Local Apps coverage already exists:

```text
GET  /local-apps
GET  /local-apps/dashboard
GET  /local-apps/operational-readiness
GET  /local-apps/operator-summary
GET  /local-apps/action-readiness
GET  /local-apps/action-enablement-backlog
GET  /local-apps/source-diagnostics
GET  /local-apps/actions/status
GET  /local-apps/orchestrator
GET  /local-apps/onboarding-checklist
GET  /local-apps/action-plans
POST /local-apps/:id/start
POST /local-apps/:id/stop
POST /local-apps/:id/restart
```

AWS Video coverage already exists:

```text
GET  /api/video-orchestrator/status
GET  /api/video-orchestrator/jobs/recent
GET  /api/video-orchestrator/jobs/:jobId
GET  /api/video-orchestrator/jobs/:jobId/timeline
GET  /api/video-orchestrator/jobs/:jobId/artifacts
GET  /api/video-orchestrator/jobs/:jobId/execution
POST /api/video-orchestrator/jobs/create-from-prompt
POST /api/video-orchestrator/scripts/:jobId/approve
POST /api/video-orchestrator/scripts/:jobId/request-changes
POST /api/video-orchestrator/scripts/:jobId/generate
```

Agent cost/console summary routes already exist, but they do not directly satisfy the exact requested Codex/Claude dashboard cards:

```text
GET /agent-console
GET /agent-cost-summary
```

## Required Brain Core additions

Add normalized dashboard endpoints before the UI depends on system/usage/cost cards:

```text
GET /ops/system-metrics
GET /ops/ai-usage-windows
GET /ops/ai-costs
```

These endpoints must return explicit `not_instrumented` or `unavailable` states rather than fake values for metrics that cannot yet be measured safely.

## Proposed project location

```text
projects/brain-console-center/
```

Suggested port:

```text
4881
```

Reason: Brain Console Web uses `4880`, and Brain Core uses `4877`. Brain Console Center should have a separate port while legacy dashboards remain available.

## Tech stack

Use:

```text
Next.js App Router
React
TypeScript
Tailwind CSS
shadcn/ui
shadcnblocks-style admin dashboard shell
TanStack Query
TanStack Table
Zod
Recharts
Lucide icons
React Hook Form
```

## Target structure

```text
projects/brain-console-center/
  README.md
  package.json
  next.config.ts
  tsconfig.json
  app/
    layout.tsx
    page.tsx
    aws-video/page.tsx
    local-apps/page.tsx
    settings/page.tsx
  components/
    shell/
    overview/
    local-apps/
    aws-video/
    ui/
  lib/
    braincore-client.ts
    braincore-schemas.ts
    query-keys.ts
    refresh-policy.ts
    formatters.ts
```

## Phase 0 — Documentation consolidation

Goal: make the repo stop describing multiple dashboards as the active primary dashboard.

Tasks:

- [x] Add `docs/system/brain-console-center-roadmap.md`.
- [x] Add this implementation plan.
- [x] Add supersession notices to previous dashboard direction docs.
- [x] Update legacy dashboard READMEs so they identify Brain Console Center as the leading dashboard.
- [x] Update project index documentation.

Exit criteria:

- The repo has one canonical dashboard direction.
- Every legacy dashboard README identifies itself as legacy.
- The roadmap and implementation plan agree on the same direction.

## Phase 1A — Brain Core API contract check and gap fill

Goal: confirm and expose the Brain Core contracts needed by Phase 1 without frontend hacks.

Tasks:

- [x] Verify Local Apps routes still exist.
- [x] Verify AWS Video routes still exist.
- [x] Detect changed AWS script-change route: `/request-changes`.
- [x] Detect new controlled YouTube publish routes and exclude them from Phase 1.
- [x] Add `/ops/system-metrics`.
- [x] Add `/ops/ai-usage-windows`.
- [x] Add `/ops/ai-costs`.
- [x] Ensure every metric can return `fresh`, `stale`, `unavailable`, or `not_instrumented`.

Exit criteria:

- Brain Console Center can rely on documented Brain Core contracts.
- Overview cards do not need fake data.

## Phase 1B — Create Brain Console Center skeleton

Goal: create the new dashboard app without touching legacy dashboards.

Tasks:

- [x] Create `projects/brain-console-center/`.
- [x] Configure Next.js, TypeScript, Tailwind, and shadcn-style component structure.
- [x] Add app shell patterned after the shadcnblocks admin dashboard style.
- [x] Add responsive navigation:
  - Overview
  - AWS Video
  - Local Apps
  - Settings
- [x] Add Brain Core URL configuration with default `http://localhost:4877`.
- [x] Add status/freshness display in the topbar.

Exit criteria:

- App starts locally on port `4881` after dependencies are installed.
- App shell is responsive on desktop and mobile.
- Brain Core connection state is visible.

## Phase 1C — BrainCore client and schemas

Goal: make data access standardized before UI features expand.

Tasks:

- [x] Implement `lib/braincore-client.ts` with timeout, JSON parsing, typed errors, and base URL handling.
- [x] Implement Zod schemas for Phase 1 endpoints.
- [x] Implement query keys and refresh policies through TanStack Query query keys/refetch intervals.
- [x] Add freshness/status handling for dashboard sections and cards.
- [x] Ensure failed sections render independently and do not crash the whole dashboard.

Exit criteria:

- All dashboard data flows through one client.
- API response drift is visible during development.
- UI can distinguish loading, fresh, stale, error, unavailable, and not-instrumented states.

## Phase 1D — Overview cards

Goal: implement the first dashboard screen without fake values.

Cards:

- CPU load
- memory pressure
- GPU load
- uptime
- Codex current window
- Codex 5-hour window
- Codex 7-day window
- Claude Code Haiku cost
- Claude Code Sonnet cost
- Claude Code Opus cost

Exit criteria:

- The overview is useful immediately and honest about unavailable data.

## Phase 1E — Local Applications tab

Goal: replace the safe parts of the Obsidian Local Apps dashboard in the new center.

Tasks:

- [x] Read from Brain Core local-app dashboard/action-readiness/action-status endpoints.
- [x] Display all local apps with canonical id, status, health, port, URL, and action readiness.
- [x] Provide Start/Restart, Stop, and Open actions.
- [x] Make Open use `http://localhost:<port>` when a port is present.
- [x] Disable unsafe actions with a visible reason.
- [x] Refetch local-app data after every action mutation.
- [x] Show recent local-app action results and readiness/error state.

Exit criteria:

- Browser never executes commands.
- Buttons call only Brain Core POST endpoints.
- Unsupported apps produce visible structured feedback.

## Phase 1F — AWS Video Pipeline tab

Goal: migrate the current Brain Console Web AWS Video surface into the new shadcn dashboard.

Tasks:

- [x] Read pipeline status from Brain Core.
- [x] Read recent jobs.
- [x] Select and display job detail.
- [x] Display job timeline.
- [x] Display job artifacts.
- [x] Display AWS execution status.
- [x] Implement create draft workflow.
- [x] Implement approve script workflow.
- [x] Implement request changes workflow using `/request-changes`.
- [x] Implement generate artifacts/AWS workflow with longer timeout handling.
- [x] Preserve the no-YouTube-publish boundary in Phase 1.
- [x] Add activity/error feed.

Exit criteria:

- Functional parity with the current Brain Console Web AWS operator view except YouTube publish controls.
- Better structure, responsiveness, and visual quality than the legacy web console.

## Refresh policy

Use auto-refresh, but avoid noisy polling.

```text
Brain Core status:        5 seconds
system metrics:           3–5 seconds
local apps:               5 seconds
local app action status:  2–5 seconds while action pending, 10 seconds idle
AWS video jobs:           10 seconds
selected active job:      5–10 seconds
cost/usage windows:       30–60 seconds
```

Every mutation should invalidate and refetch affected queries.

## Safety policy

- Frontend never accepts raw command strings.
- Frontend never sends arbitrary shell commands.
- Frontend never reads filesystem paths directly.
- Frontend never displays secrets, tokens, OAuth values, or private credential material.
- Mutations go through Brain Core allowlisted endpoints only.
- Unsupported actions are disabled and explain why.
- Publishing controls remain absent until separately approved.

## Stop conditions

Stop implementation and reassess if:

- Brain Core cannot safely expose a required metric.
- The frontend starts duplicating business/runtime logic.
- A feature requires direct shell execution from browser code.
- Legacy dashboard code would need to be modified for Phase 1.
- External publishing or credential access becomes necessary.
