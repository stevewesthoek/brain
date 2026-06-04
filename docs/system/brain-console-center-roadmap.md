# Brain Console Center Roadmap

**Date:** 2026-06-03  
**Status:** accepted direction for the fourth and final dashboard attempt  
**Leading dashboard:** Brain Console Center  
**Planned location:** `projects/brain-console-center/`  
**Data source:** Brain Core API only  
**Legacy dashboards:** ProBot dashboard, Brain Console Obsidian Plugin, Brain Console Web

## Decision

Brain Console Center is the single forward-looking operational dashboard for the `brain` repo.

```text
Brain Console Center → Brain Core API → runtime/job/config sources
```

The existing dashboards are legacy reference implementations. They must not receive new dashboard product feature work. Useful features should be migrated gradually into Brain Console Center through Brain Core API contracts.

```text
ProBot dashboard              = legacy reference / thin-client fallback path
Brain Console Obsidian Plugin = legacy native Obsidian reference
Brain Console Web             = legacy AWS Video reference
Brain Console Center          = new and leading dashboard
```

## Current endpoint assessment

A fresh route review on 2026-06-03 found that the Local Apps endpoints are still present and suitable for Phase 1.

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

A fresh AWS Video route review on 2026-06-03 found one important route change compared with earlier notes: requesting script changes now uses `/request-changes`, not `/changes`.

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

The route review also found controlled YouTube publish routes:

```text
POST /api/video-orchestrator/jobs/:jobId/publish/youtube/dry-run
POST /api/video-orchestrator/jobs/:jobId/publish/youtube
```

Brain Console Center Phase 1 must not expose YouTube publishing controls. These routes are recognized but intentionally out of scope until separate explicit approval.

## Factual legacy inventory

### ProBot dashboard

Documented feature inventory from `projects/probot/README.md` and `docs/system/probot-to-brain-console-dashboard-parity-handoff.md`:

- Overview
- Local Apps
- Production Pipeline
- Video Orchestrator Studio
- Viral Flow
- Stripe
- Session History
- System Updates
- Slack and Telegram fallback commands
- approvals and jobs visibility
- session discovery and continuation helpers
- local app lifecycle logic

Migration policy:

- Do not add product dashboard features to ProBot.
- Reuse only clean backend capabilities through Brain Core.
- Keep Slack/Telegram as optional thin fallback clients only.
- Stripe and external admin surfaces remain legacy/admin-only unless safe metadata endpoints are explicitly designed.

### Brain Console Obsidian Plugin

Documented feature inventory from `projects/brain-console-obsidian/README.md`:

- shared system health
- execution readiness
- scheduler status
- AI selector health
- approvals
- controlled Local Apps operations
- ProBot migration/parity cards
- sessions and continuations
- local app start/stop/restart controls through Brain Core
- runtime reports including Mind Steward and video summaries
- manual refresh and offline state
- native Obsidian responsive layout
- AWS Video native-plugin experiments ending in `v2.22-aws-video-panel-reset`

Migration policy:

- Do not add new features to the Obsidian plugin.
- Use it only as a reference for feature inventory, local apps UX lessons, parity cards, and offline/error-state behavior.
- Do not preserve the manual-refresh-only model; Brain Console Center should use automatic refresh with explicit freshness state.

### Brain Console Web

Documented and code-inventoried from `projects/brain-console-web/README.md` and `projects/brain-console-web/src/main.js`:

- Brain Core connection diagnostics
- AWS Video pipeline status
- recent operational jobs
- selected job detail
- selected job timeline
- selected job artifacts
- selected job AWS execution status
- create draft workflow
- approve script workflow
- request changes workflow
- generate artifacts/AWS workflow
- activity log
- channels view
- controlled YouTube publish dry-run/private upload controls in the latest code

Migration policy:

- Brain Console Web is the direct Phase 1 AWS Video reference.
- Do not continue the dependency-free dashboard shell.
- Rebuild the AWS Video operator UX in Brain Console Center using typed React, shadcn/ui, TanStack Query, and normalized Brain Core clients.
- Do not migrate YouTube publish controls in Phase 1.

## Technology direction

Use a proper modern dashboard stack:

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
React Hook Form where forms are needed
```

The UI should take visual direction from the shadcnblocks admin dashboard demo and shadcn UI block/template ecosystem, but the repository must own the final implementation.

## Phase 1 scope

Phase 1 intentionally starts small and must not become another cluttered console.

### AWS Video Pipeline tab

Migrate the current Brain Console Web AWS Video operational surface except YouTube publishing:

- pipeline status
- recent jobs
- selected job detail
- selected job timeline
- selected job artifacts
- selected job AWS execution status
- create draft
- approve script
- request changes through `/request-changes`
- generate artifacts/AWS workflow
- activity/errors
- channel context
- no YouTube publish controls

### Local Applications tab

Show all local applications from Brain Core with:

- application name
- canonical app id
- specific port number
- local URL
- status and health
- managed/executable state
- start/restart action
- stop action
- open action for `http://localhost:<port>`

Buttons must call Brain Core only. The browser must not execute shell commands.

### Overview cards

Add cards for:

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

Each card must expose freshness state and last-updated state. If Brain Core cannot provide a value yet, the card should show `Unavailable` or `Not instrumented` rather than fake data.

## Phase 1 non-goals

- No new feature work in ProBot dashboard.
- No new feature work in Brain Console Obsidian Plugin.
- No new feature work in Brain Console Web.
- No direct shell execution from the frontend.
- No direct repo/file reads from the frontend.
- No YouTube publishing control.
- No Stripe financial dashboard.
- No broad external admin/OAuth surfaces.
- No attempt to port every legacy feature at once.

## Acceptance criteria for Phase 1

- Brain Console Center runs on its own local port without replacing legacy dashboards.
- It uses Brain Core API only.
- It has a shadcn-based admin shell and responsive navigation.
- AWS Video tab reaches functional parity with the current Brain Console Web AWS operator view, excluding YouTube publish controls.
- Local Applications tab reaches functional parity with the safe Brain Core local-app action model.
- Overview cards show real values or explicit not-instrumented states.
- Every auto-refreshed section displays freshness/error/loading state.
- Legacy dashboard documentation clearly identifies Brain Console Center as the only leading dashboard.
- The old dashboards remain untouched except documentation labels and migration references.

## Decommission strategy

Legacy dashboards are not deleted immediately. They are decommissioned only after Brain Console Center has imported the required features and the user explicitly approves removal or archival.

Order:

1. Freeze all legacy dashboard feature work.
2. Migrate Phase 1 surfaces into Brain Console Center.
3. Add parity checklist for each legacy dashboard feature.
4. Mark migrated features as covered by Brain Console Center.
5. Decommission or archive legacy code only after explicit approval.
