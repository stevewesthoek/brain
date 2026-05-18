# Brain Core

Brain Core is the small local API boundary for the Obsidian-first operating cockpit.

## Status

Phase 3d: Video Orchestrator Asset Plan (Active). The service exposes deterministic read-only asset planning module for video intake → research → script → asset-plan pipeline. Phase 4G (Agent View Foundation) endpoints remain operational.

**2026-05-18 Latest:**
- ✅ Phase 3d: Video Orchestrator Asset Plan module (Planning, not generation)
  - ✅ Asset plan fixtures: 5 stories with 15-17 asset requirements each
  - ✅ Asset requirement types: thumbnail, title-card, passage-card, scene-visual, b-roll, platform-derivative, metadata-visual
  - ✅ Structural placeholders only (no image generation, no design synthesis)
  - ✅ Design orchestrator blocker correctly documented
  - ✅ Video assembly stage blocker correctly documented
  - ✅ GET /video-orchestrator/asset-plan (list all plans with summary)
  - ✅ GET /video-orchestrator/asset-plan/:id (single plan with upstream links)
  - ✅ Brain Console integration: minimal card in Pipelines section showing plan count, requirements, blocked count
  - ✅ All 172 tests passing (169 existing + 3 new asset-plan endpoint tests)
- ✅ All safety flags hardcoded: readOnly=true, generatesImage=false, callsExternalAI=false, writesFiles=false, publishesContent=false, writesToMind=false
- Read-only by design; no asset generation, no image generation, no Mind mutations

## Goals

- Return machine/session/skill state as JSON.
- Bind to localhost by default.
- Avoid dashboard HTML.
- Avoid broad shell execution.
- Avoid secrets in responses.
- Provide a stable API for future Obsidian integration.

## Current endpoints

**Status & Infrastructure:**
```text
GET /status
GET /sessions
GET /skills
GET /repos
GET /orchestrators
GET /platforms
GET /projects
GET /capabilities
```

**Agent Operations Ledgers (Phase 4G):**
```text
GET /agents
GET /agents/:id
GET /agent-runs
GET /agent-runs/:id
GET /agent-events
GET /approval-audit
GET /recovery
GET /recovery/:id
```

**Approval & Action Management:**
```text
GET /approvals
GET /approvals/:id
GET /approvals/store
GET /actions
GET /actions/:id
```

**Scheduler & Execution:**
```text
GET /scheduler/status
GET /scheduler/latest-run
GET /scheduler/jobs
GET /execution/plans
GET /execution/plans/:kind
GET /execution/readiness
GET /execution/mind-preview-policy
GET /execution/mind-previews
GET /execution/mind-previews/:id
GET /execution/maintenance-previews
GET /execution/maintenance-previews/:id
```

**Runtime Infrastructure:**
```text
GET /local-apps
GET /video/status
GET /video/queue
GET /stb/status
GET /video-orchestrator/status
GET /video-orchestrator/intake
GET /video-orchestrator/intake/:id
GET /video-orchestrator/research
GET /video-orchestrator/research/:id
GET /video-orchestrator/script
GET /video-orchestrator/script/:id
GET /video-orchestrator/asset-plan
GET /video-orchestrator/asset-plan/:id
GET /stb-video-migration/status
GET /stb-video/parity-matrix
GET /stb-video/dual-run-status
GET /runtime/reports
GET /runtime/reports/model-router
```

Current `/sessions` scans optional directories configured by `BRAIN_CORE_SESSION_DIRS`, `CLAUDE_PROJECTS_DIR`, `CODEX_SESSIONS_DIR`, and `GEMINI_SESSIONS_DIR`. It recursively discovers session-like files, infers the tool from names/paths, adds age and intent labels, applies simple recency/intent scoring, and returns a placeholder when no readable session directory is configured.

Current `/skills` indexes skill folders from `BRAIN_CORE_SKILLS_DIR` or the default repo-local `operations/system-configs/codex/skills` path and reports folders containing `SKILL.md` as indexed.

Current `/repos` reads `BRAIN_CORE_REPO_ALIASES` or `PROBOT_REPO_ALIASES` in `name:/absolute/path` format, reports whether each repo exists, and detects known handoff files without reading secrets or runtime logs.

Current `/orchestrators` returns placeholder summaries for Video Orchestrator, Mind Model Router, and Office Nightly Scheduler. Current `/capabilities` returns a manifest of read endpoints and approval-request endpoints with `executableActionsEnabled: false`, `runtimeReportsSupported: true`, and `runtimeReportEndpoint: /runtime/reports`, plus read-only metadata for Mind cleanup state, Brain Console scaffold status, and ProBot thin-client wiring.

Current `/runtime/reports` returns read-only runtime report summaries for the model-router dry-run report, approval audit JSONL health, video runtime status, and local-app runtime status. It does not read Mind content and always reports `writesToMind: false` and `executableActions: false`.

Current `/scheduler/status`, `/scheduler/latest-run`, and `/scheduler/jobs` are read-only scheduler surfaces. They report placeholder state until a runtime report is available. When `runtime/local/model-router/latest.json` exists, or when `BRAIN_CORE_MODEL_ROUTER_REPORT_PATH` points to a safe JSON report, `/scheduler/status` and `/scheduler/latest-run` expose that report as read-only scheduler state. They do not inspect logs, run jobs, or mutate scheduler state.

Current `/local-apps` is a read-only placeholder or report-backed list for local services. When `runtime/local/local-apps/latest.json` exists, or when `BRAIN_CORE_LOCAL_APPS_REPORT_PATH` points to a safe JSON report, the endpoint returns report-backed summaries. It still does not start, stop, or restart apps.

Current `/video/status` and `/video/queue` are read-only placeholder or report-backed surfaces for the future Video Orchestrator adapter. When `runtime/local/video/latest.json` exists, or when `BRAIN_CORE_VIDEO_REPORT_PATH` points to a safe JSON report, the endpoint returns read-only queue/status summaries. They do not inspect media folders, start renders, upload files, or trigger workflow execution.

Those report-backed local app and video surfaces were live-verified over `http://127.0.0.1:4877` during the current roadmap pass.

**Phase 3d: Video Orchestrator Asset Plan (NEW)**

Current `/video-orchestrator/asset-plan` and `/video-orchestrator/asset-plan/:id` expose a deterministic, read-only asset planning module. This is **planning only, not asset generation**. The module converts intake + research + script fixtures into a structured asset plan that defines what assets **will be needed** (not what will be generated). All requirements use structural placeholders (no image generation, no design prompt synthesis). Requirements are marked `planned` when design-orchestrator dependency is documented, or `blocked` when multiple blockers exist (design-orchestrator not implemented, video-assembly not implemented, image-generation disabled). Each requirement specifies `designDependency` ('design-orchestrator', 'manual-design', or 'none') to allow future design systems to understand blocker types. All safety flags are hardcoded: `readOnly: true`, `generatesImage: false`, `callsExternalAI: false`, `writesFiles: false`, `publishesContent: false`, `writesToMind: false`.

**Phase 4G: Agent View Foundation**

Current `/agent-runs` returns derived agent run summaries from approval records, including status (queued/running/blocked/completed/failed/cancelled/planned), age, and safety flags. External executor placeholders (Claude Code, Codex) are always included as `planned` runs. All safety flags are hardcoded: `writesToMind: false`, `executesShell: false`, `mutatesRuntime: false`, `executionEnabled: false`.

Current `/agent-events` returns agent event summaries mapped from approval audit trail events. Each event has type (requested/approved/rejected/executed/failed/blocked), severity (info/warning/error), and relatedApprovalId linking to the source approval. Events are read-only snapshots; they do not reflect real execution.

Current `/recovery` returns a read-only incident/blocker list capped at 10 items. Items include execution readiness blockers, missing/stale reports, scheduler health issues, and STB/video orchestrator health warnings. Each item has `canAutoFix: false` and `writesToMind: false` (pure observability).

Current `/approvals/:id` now includes `auditEvents` alongside the approval record, showing the full lifecycle trail (requested → approved/rejected → executed/missing).

**Previous Phase Endpoints**

Current `/approvals` reads the in-memory approval request store, or returns persisted records from JSON when `BRAIN_CORE_APPROVAL_STORE_PATH` is configured, returning a placeholder when no requests exist.

Current `/approvals/store` exposes read-only approval-store health and record counts. When `BRAIN_CORE_APPROVAL_STORE_PATH` points to a safe JSON file, Brain Core persists approval records there and reports `status: "available"`; otherwise it falls back to memory and reports `status: "memory"`. Unsafe paths are rejected and reported as `status: "unsafe"`.

Current `/execution/plans`, `/execution/plans/:kind`, and `/execution/readiness` expose a read-only execution-gate scaffold. The first candidate is `scheduler-run-model-router-dry-run`, but Brain Core still reports `executionEnabled: false`, `wouldExecute: false`, and `executed: false`.

Current mutation surface is intentionally minimal:

```text
POST /actions/request?kind=<safe-action-kind>
POST /scheduler/jobs/:id/request-run
POST /skills/profile?profile=<profile>
POST /sessions/:id/resume
POST /local-apps/:id/start
POST /local-apps/:id/stop
POST /local-apps/:id/restart
POST /approvals/:id/approve
POST /approvals/:id/reject
```

These endpoints are local-only, approval-aware scaffolding. They create or update approval records but always return `executed: false`; they do not run shell commands, start/stop apps, trigger scheduler jobs, switch profiles, resume sessions, or mutate external systems.

These adapters intentionally do not import ProBot dashboard code. Future slices should migrate richer read-only backend logic from ProBot without importing dashboard rendering or browser state.

## Validation

```bash
npm run typecheck
npm test
```

The Phase 1 tests cover the read-only route contract: `/status`, `/sessions`, `/skills`, GET-only behavior, and non-local request rejection.

## Local run

```bash
npm install
npm run dev
```

Default URL:

```text
http://127.0.0.1:4877/status
```

Configuration:

```text
BRAIN_CORE_HOST=127.0.0.1
BRAIN_CORE_PORT=4877
```

## Operations runbook

Restore, health-check, and rollback instructions live in:

```text
operations/runbooks/brain-core.md
```

## Brain Console integration contract

`src/obsidian.ts` exposes a read-only widget snapshot contract for a future Obsidian `brain-console` plugin or integration layer.

Current widget IDs:

```text
brain-status
brain-sessions
brain-repos
brain-skills
brain-scheduler
brain-local-apps
brain-video-queue
brain-approvals
```

This is not an Obsidian plugin yet. It is the audited data shape that a plugin can render without importing the legacy ProBot dashboard.

## Safety boundary

- Read/status endpoints are `GET` only.
- Approval-request endpoints are local-only `POST` routes that always return `executed: false`.
- Non-local requests are rejected.
- Runtime state should be returned from adapters, not duplicated into markdown.
- Execution-readiness endpoints are read-only and do not enable execution.
- Executable mutation behavior must wait for persistent audit storage, explicit UX, and separate approval.
