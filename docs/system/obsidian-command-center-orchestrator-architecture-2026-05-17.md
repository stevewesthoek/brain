# Obsidian Command Center: Unified Orchestrator Architecture

**Date:** 2026-05-17  
**Status:** Architecture Definition (Blueprint for Phased Implementation)  
**Scope:** Brain Console as the single future cockpit for all operational pipelines and orchestrators  

---

## Executive Conclusion

Brain Console is the **single future cockpit** for:

1. **System Health**: Brain Core status, execution readiness, approvals, runtime reports
2. **Local Apps & Services**: app lifecycle, Brain Core, ProBot, STB pipeline runner, build/dev tools
3. **ProBot Features**: Legacy dashboard features being migrated through Brain Core APIs
4. **Says the Bible (STB)**: Operational daily pipeline, currently legacy/primary workflow
5. **Video Orchestrator**: Future canonical content pipeline architecture, currently partial/planned
6. **Orchestrator Skills**: design, code, research, Bible research, project/domain orchestration
7. **Projects & Domains**: Says the Bible, Brain/Mind system, research/code/content domains
8. **Approvals & Actions**: Approval queue, safe approval-request-only actions, runtime audits
9. **Pipeline Health**: Runtime reports, scheduler health, maintenance queue, next safe actions

### Core Architecture Rule

**Nothing is turned off, disabled, or deleted until:**
- Brain Core API surface equivalent exists ✅
- Brain Console displays equivalent status/control ✅
- Approval model exists for any actions ✅
- Tests pass ✅
- User explicitly approves decommissioning ✅

**Corollary:** STB remains operational. ProBot remains operational. Video orchestrator is built alongside, not as a replacement. Migration happens module-by-module with dual visibility, never blind cutover.

---

## 1. Current Operational Systems

### Brain Console MVP (Current)

**Status**: ✅ Deployed locally, operational  
**Features**: Status pills, 6 MVP cards (wiki health, maintenance, approvals, scheduler, Brain Core, next action)  
**API**: Brain Core read-only endpoints (status, runtime reports, approvals, scheduler, execution readiness)  
**Safety**: Read-only only, no Mind mutations, no shell execution, approval-request-only future actions  
**Limitations**: No app/orchestrator/pipeline/project sections yet  

### Brain Core (Current)

**Status**: ✅ Operational, read-only HTTP API  
**Endpoints**:
- `GET /status` — system ready, execution readiness
- `GET /capabilities` — feature flags, installed components  
- `GET /runtime/reports` — model-router health, runtime state
- `GET /scheduler/status` — nightly job queue
- `GET /scheduler/jobs` — individual jobs
- `GET /approvals` — pending approval requests
- `GET /execution/readiness` — execution candidates, blockers
- `GET /execution/plans` — maintenance/capture plans
- `GET /execution/mind-previews` — queued actions
- `GET /sessions` — recent AI sessions
- `GET /repos` — repo inventory
- `GET /local-apps` — app status, port, health
- `GET /video/status` — video queue partial support

**Limitations**: Missing orchestrator/pipeline/project/platform registries

### ProBot Dashboard (Current)

**Status**: ✅ Operational, legacy secondary dashboard  
**Role**: Web-based command surface, video orchestrator credential/account management  
**Features**:
- Local apps tab (start/stop/status)
- Video orchestrator studio (OAuth, credentials, accounts)
- Viral Flow integration (account summary)
- Stripe billing (financial only)
- Session history
- System updates
- Production pipeline queue (ProBot-specific)

**Intended Transition**: Brain Console replaces ProBot dashboard once feature parity achieved. ProBot remains operational for credential/command workflows.

### Says the Bible (STB) Pipeline (Current)

**Status**: ✅ Operational, daily-use primary pipeline  
**Role**: Converts Bible/faith research into published video content  
**Platforms**: YouTube, Pinterest, Facebook (being expanded)  
**User Context**: Currently the user's daily working pipeline; essential operational system  
**Architecture**: Legacy monolithic app/scripts (not yet modular)  
**Risk Profile**: High — cannot break without full validation  

**Operational Requirements**:
- Must remain running and accessible via ProBot dashboard
- Must remain in daily user workflow
- Must be visible in Brain Console as operational/legacy
- Cannot be decommissioned until video orchestrator achieves full parity

### Video Orchestrator (Current)

**Status**: 🏗️ Partially built, future canonical architecture  
**Role**: Modular content/video pipeline supporting multiple projects, platforms, workflows  
**Current Implementation**: ProBot has design-phase mapping for STB migration, not yet live execution  
**Architecture**: Designed to be reusable across projects (Says the Bible, future projects)  

**Key Design Principle**: STB will be **rebuilt** into video orchestrator modules over time, not blind-copied. This allows video orchestrator to be more modular, cleaner, and reusable.

**Missing Pieces**:
- Live queue/run tracking
- Stage execution
- Platform publishing (design-only currently)
- Error handling/recovery
- Status surfaces for Brain Console

### Orchestrator Skills (Planned)

**model-router**: ✅ Exists, primary orchestrator for Mind compilation and model routing  
**video/content**: 🏗️ Partial, video orchestrator (STB migration target)  
**design**: 🔴 Planned/future skill  
**code**: 🔴 Planned/future skill  
**research**: 🔴 Planned/future skill  
**Bible research**: 🔴 Planned/future skill  
**project/domain**: 🔴 Planned, maps projects to orchestrator workflows  
**scheduler**: ✅ Exists, nightly job runner  
**Save-to-Mind**: ✅ Exists, n8n capture pipeline  

---

## 2. Future Canonical Model

### Core Entities

```typescript
// Orchestrator registry
type OrchestratorRole = "system" | "video" | "design" | "code" | "research" | "bible-research" | "automation";
type LifecycleStatus = "operational" | "legacy" | "partial" | "planned" | "blocked" | "migrating" | "unknown";
type HealthState = "ok" | "warning" | "error" | "unknown";

interface Orchestrator {
  id: string;
  name: string;
  role: OrchestratorRole;
  status: LifecycleStatus;
  health: HealthState;
  description: string;
  currentRole: "primary" | "legacy" | "future" | "supporting";
  dashboardSection: string; // "overview" | "orchestrators" | "pipelines" | "projects"
}

// Pipeline registry
interface Pipeline {
  id: string;
  name: string;
  projectId?: string;
  orchestratorId: string;
  status: LifecycleStatus;
  health: HealthState;
  role: "primary" | "legacy" | "migration-target" | "experimental";
  description: string;
  stages: PipelineStage[];
  runs: PipelineRun[];
  queue: Queue;
  migration?: {
    sourcePipelineId?: string;
    targetPipelineId?: string;
    parityStatus: "not-started" | "mapping" | "partial" | "dual-run" | "ready" | "complete";
    decommissionBlocked: true; // until user approves
  };
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  status: "implemented" | "partial" | "planned" | "legacy" | "unknown";
  description?: string;
}

interface PipelineRun {
  id: string;
  pipelineId: string;
  startedAt: string;
  completedAt?: string;
  status: "pending" | "running" | "success" | "failed" | "blocked";
  stageResults: Record<string, { status: "success" | "failed" | "skipped"; duration: number }>;
}

interface Queue {
  id: string;
  pipelineId: string;
  items: QueueItem[];
  status: "healthy" | "warning" | "error";
  failureCount: number;
}

interface QueueItem {
  id: string;
  position: number;
  createdAt: string;
  status: "pending" | "processing" | "ready" | "failed";
  retryCount: number;
  metadata: Record<string, any>;
}

// Project/domain registry
interface Project {
  id: string;
  name: string;
  category: "faith" | "content" | "system" | "research" | "code" | "business" | "unknown";
  status: LifecycleStatus;
  health: HealthState;
  description?: string;
  orchestratorIds: string[];
  pipelineIds: string[];
  platformIds: string[];
  mindPath?: string;
  brainPath?: string;
}

interface Platform {
  id: string;
  name: string;
  category: "video" | "social" | "publishing" | "website" | "repository" | "unknown";
  status: LifecycleStatus;
  health: HealthState;
  projectIds: string[];
  pipelineIds: string[];
  description?: string;
  config?: {
    url?: string;
    apiKey?: boolean; // never expose actual key
    status?: string;
  };
}

// Approval/action registry
interface ApprovalRequest {
  id: string;
  kind: "app-start" | "app-stop" | "app-restart" | "pipeline-run" | "orchestrator-run" | "update-system" | "unknown";
  target: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected" | "expired";
  risk: "low" | "medium" | "high";
  requiredApprovals: number;
  approvals: Array<{ approver: string; approvedAt: string; comment?: string }>;
}
```

---

## 3. Relationship Model

### System Architecture

```
┌─ Brain Console (Obsidian Plugin) ──────────────────────┐
│  - read-only cockpit                                    │
│  - displays orchestrator/pipeline/project/platform      │
│  - renders real-time status                             │
│  - requests approvals for actions                        │
└───────────────────────────────────────────────────────┬─┘
                    │
                    │ GET (read-only)
                    │ POST /actions/request (approval-only)
                    ↓
┌─ Brain Core API (Local HTTP) ──────────────────────────┐
│  - /status, /capabilities, /runtime/reports            │
│  - /orchestrators, /pipelines, /projects, /platforms   │
│  - /local-apps, /scheduler, /approvals                 │
│  - /actions/request (approval-gated)                   │
│  - safety boundary: local-only, read-only, approved    │
└───────────────────────────────────────────────────────┬─┘
                    │
                    ↓
┌─ Brain Core Adapters ──────────────────────────────────┐
│  - read from ProBot, model-router, STB runner, video   │
│  - expose normalized read-only summaries               │
│  - no writes, no execution, no mutations               │
└───────────────────────────────────────────────────────┬─┘
                    │
                    ↓
┌─ Operational Systems (Unchanged) ──────────────────────┐
│  STB Pipeline: operational, primary daily workflow     │
│  ProBot Dashboard: legacy command surface              │
│  Video Orchestrator: future architecture (partial)     │
│  Model Router: Mind compilation                        │
│  Scheduler: nightly jobs                               │
│  Local Apps: Brain Core, ProBot, build tools           │
└────────────────────────────────────────────────────────┘
                    │
                    ↓
┌─ Mind Vault (Durable Memory) ──────────────────────────┐
│  - wiki/log.md: append-only maintenance ledger         │
│  - router/model-router.md: orchestrator contract       │
│  - live/dashboard.md: fallback Markdown dashboard      │
│  - live/machine.md: Brain Core visibility (readonly)   │
│  - capture/, live/, wiki/: human memory layers         │
└────────────────────────────────────────────────────────┘
```

### STB → Video Orchestrator Migration

**Current state**:
- STB is operational, legacy monolithic pipeline
- Video orchestrator is partial architecture, design-phase STB mapping exists
- Both must remain visible in dashboard during migration

**Migration approach**:
1. Map STB modules to video orchestrator modules (one by one)
2. Build video module equivalently
3. Dry-run video module beside STB
4. Compare output
5. Only after parity → switch to video for that module
6. Never: blind copy, force cutover, or decommission STB before validation

**Example module map**:
```
STB concept              → Video orchestrator target module
research → scripture     → bible-research orchestrator
outline                  → script-generation stage
asset generation         → asset-generation stage
thumbnail               → design orchestrator (future)
video assembly          → video-assembly stage
metadata                → metadata-enrichment stage
youtube publish         → platform-publish stage
facebook publish        → platform-publish stage
approval/review         → approval-gate stage
archive/logging         → archive-logging stage
```

---

## 4. Brain Console Information Architecture

### Dashboard Sections (Phased Rollout)

#### **Overview Tab** (Phase 1, Current MVP)
- System health: Brain Core, model-router, wiki health
- Attention score: 0-100 burn bar
- Next safe action
- Pending approvals (count, risk summary)
- Scheduler health (last run, queue depth)
- High-priority alerts

#### **Apps Tab** (Phase 2)
- Local apps list (running/stopped/unknown)
- Brain Core (read-only status)
- ProBot dashboard legacy (read-only status)
- STB runner (read-only operational status if discoverable)
- Build/dev tools (discoverable apps)
- Start/stop buttons: read-only UI for now, planned approval-gated later

#### **Orchestrators Tab** (Phase 3)
- **model-router**: ✅ operational/primary, wiki health, next run
- **video-orchestrator**: 🏗️ partial/future, STB migration target relationship
- **Says the Bible (STB)**: ⭐ legacy/operational, daily primary use, migration status
- **design-orchestrator**: 🔴 planned/future
- **code-orchestrator**: 🔴 planned/future
- **research-orchestrator**: 🔴 planned/future
- **bible-research**: 🔴 planned/future
- **Save-to-Mind**: ✅ operational/system
- **Scheduler**: ✅ operational/system

Each row/card:
- name + status badge (operational/legacy/partial/planned)
- health indicator (ok/warning/error/unknown)
- role label (primary/legacy/future/supporting)
- last activity/run timestamp
- action state (read-only/approval-required/locked/planned)

#### **Pipelines Tab** (Phase 4)
- **STB Daily Pipeline**: ⭐ operational/legacy/primary, queue status, last run, next item
- **Video Orchestrator Pipeline**: 🏗️ future/partial, migration status, parity %
- **Build/Test Pipelines**: if discoverable

For STB/video specifically:
```
┌─ STB Legacy Pipeline (Operational) ──────────────┐
│  Status: RUNNING (daily use)                      │
│  Last run: 2 hours ago ✓                          │
│  Queue: 3 pending items                           │
│  Next item: "Topic: 1 Corinthians 13:1-7"        │
│  Failure state: ok                                │
│  Links: [live output] [Mind docs] [Logs]          │
└──────────────────────────────────────────────────┘

┌─ Video Orchestrator (Migration Target) ───────────┐
│  Status: PARTIAL (future architecture)            │
│  Modules implemented: 3/8 (outline, assembly)     │
│  Parity status: MAPPING (designing equivalents)   │
│  Decommission blocked: YES (until full parity)    │
│  Next task: [Map research module] [View plan]     │
└──────────────────────────────────────────────────┘

┌─ Migration Status ────────────────────────────────┐
│  STB → Video Orchestrator                        │
│  Parity: 40% (modules implemented / total)       │
│  Dual-run status: not started                    │
│  Blockers: design-orchestrator dependency        │
│  Next safe action: implement outline module      │
└──────────────────────────────────────────────────┘
```

#### **Projects/Domains Tab** (Phase 5)
- **Says the Bible**: faith/content, operational primary, linked to STB pipeline + video migration
- **Brain/Mind System**: system, operational, linked to model-router
- **Research**: research domain, planned orchestrators
- **Code/Buildflow**: code domain, planned orchestrators
- **Video/Content**: content domain, linked to video orchestrator

#### **Approvals Tab** (Phase 6)
- Pending approval requests
- Risk level (low/medium/high)
- Requested action (app-start, pipeline-run, orchestrator-run, etc)
- Target system
- Approve/reject/audit buttons

#### **System Tab** (Phase 7)
- Runtime reports summary (no raw JSON, counts only)
- Scheduler details
- Wiki/maintenance health
- No raw logs, no stack traces
- Safe error summaries only

---

## 5. Action & Control Model

### Classification

**READ-ONLY** (safe, no approval needed):
- View status (all sections)
- View history (runs, approvals, events)
- View project/pipeline/orchestrator overview
- View operational details
- Manual refresh

**APPROVAL-REQUEST-ONLY** (creates request, user must approve):
- App start/stop/restart
- Pipeline dry-run
- Pipeline run request
- Orchestrator execution request
- System update apply
- STB/video migration task (future)

**ALLOWLISTED LOCAL APP ACTION** (if safe and allowlisted):
- Restart Brain Core (if well-tested)
- Restart ProBot (if well-tested)
- (Nothing else without approval)

**NEVER ALLOWED**:
- Arbitrary shell execution
- Credential display/modification
- Billing/payment mutations
- Direct Mind vault mutation (use model-router instead)
- STB script modification from dashboard
- Video orchestrator direct execution (approval-gated only)

### Approval Flow

```
User clicks "Run pipeline" button in Brain Console
  ↓
Brain Console calls: POST /actions/request
  { kind: "pipeline-run", pipelineId: "stb-daily", dryRun: true/false }
  ↓
Brain Core creates approval request (not executed yet)
  ↓
Brain Console shows: "Requesting approval..."
  ↓
User navigates to Approvals tab
  ↓
User reviews: target pipeline, risk level, action details
  ↓
User approves or rejects request
  ↓
Brain Core executes action (only if approved)
  ↓
Brain Console shows result
  ↓
Audit trail recorded
```

---

## 6. Phased Implementation (Blueprint)

### Phase 0: Preserve (CURRENT)
✅ STB remains operational  
✅ ProBot remains operational  
✅ Brain Console MVP operational  
✅ Nothing deleted or disabled  

### Phase 1: Inventories & Mapping (CURRENT)
✅ Feature inventory: completed  
✅ STB pipeline inventory: in progress  
✅ Video orchestrator inventory: in progress  
✅ Brain Core gap analysis: in progress  

### Phase 2: Brain Core Registries (NEXT)
- Orchestrator registry endpoint: `/orchestrators`
- Pipeline registry endpoint: `/pipelines`
- Project/domain registry endpoint: `/projects`
- Platform registry endpoint: `/platforms`
- Status: return operational state accurately, never fake
- Include: STB as legacy/operational, video as partial/planned

### Phase 3: Brain Console Orchestrators Section
- Render orchestrator registry
- Show STB operational status, last activity
- Show video orchestrator partial status, migration relationship
- Show other orchestrators (planned/partial/operational)
- No execution buttons yet

### Phase 4: Brain Console Pipelines Section
- Render pipeline registry
- Show STB daily pipeline status, queue, runs
- Show video orchestrator migration card
- Show STB → video migration parity status
- Show decommission blocker clearly

### Phase 5: Brain Console Projects Section
- Render project registry
- Show Says the Bible, Brain/Mind, other projects
- Link to orchestrators, pipelines, platforms
- Link to Mind wiki paths

### Phase 6: STB Operational Status Adapter
- Read STB pipeline runner status if discoverable
- Expose operational status, last run, queue state
- Render in Pipelines tab
- Make STB visible in Brain Console without modifying STB code

### Phase 7: Video Orchestrator Status Adapter
- Read video orchestrator current state
- Expose modules implemented, parity %, migration status
- Render in Orchestrators + Pipelines tabs
- Show STB ↔ video relationship

### Phase 8: Approval-Request Action Layer
- Implement `POST /actions/request` in Brain Core
- UI for app start/stop buttons (formerly disabled)
- UI for pipeline dry-run request
- UI for STB/video migration task requests
- No direct execution from plugin

### Phase 9: STB/Video Migration Planning
- Map STB modules to video modules
- Define parity checkpoints
- Plan dual-run validation
- Define rollback preservation

### Phase 10: Implementation & Migration
- Implement video modules one by one
- Dual-run modules beside STB
- Validate output parity
- Only then: switch production

### Phase 11: Decommissioning (User Approval Only)
- Document STB migration completion
- Get explicit user approval
- Archive STB runner/legacy code
- Freeze ProBot dashboard

---

## 7. Safety Guarantees

### Protected Systems

**STB Pipeline**:
- ✅ Remains operational 24/7
- ✅ Cannot be modified from Brain Console
- ✅ Cannot be stopped from Brain Console without approval
- ✅ Visible in dashboard as operational/legacy
- ✅ Decommissioning blocked until video orchestrator parity approved

**ProBot Dashboard**:
- ✅ Remains operational
- ✅ Documented as legacy/secondary
- ✅ Frozen once Brain Console reaches feature parity
- ✅ Never deleted or disabled mid-migration

**Mind Vault**:
- ✅ No direct writes from Brain Console
- ✅ No shell execution
- ✅ Model-router only write path

### Invariants

- No credentials exposed in Brain Console
- No secrets in dashboard summaries
- No arbitrary command execution
- No silent decommissioning
- No blind cutover (always validation first)
- All action requests approval-gated
- All status read-only
- All tests pass before each phase

---

## 8. Success Criteria

- ✅ Brain Console is the primary cockpit for all operational systems
- ✅ STB remains operational and visible
- ✅ Video orchestrator progress is visible
- ✅ Orchestrator/pipeline/project/platform registries exist
- ✅ STB → video migration status is transparent
- ✅ All actions are approval-gated or read-only
- ✅ User explicitly approves decommissioning before anything is turned off
- ✅ No operational systems broken
- ✅ No secrets exposed
- ✅ All tests pass

---

## References

- Brain Console plugin: `projects/brain-console-obsidian/src/`
- Brain Core API: `projects/brain-core/src/api/`
- ProBot dashboard: `projects/probot/src/bot/dashboard.ts`
- ProBot video orchestrator mapping: `projects/probot/src/bot/video-orchestrator-says-the-bible-mapping-design.ts`
- STB operational status: `mind/KANBAN.md`, active daily use
- Mind structure: `mind/live/`, `mind/wiki/`, `mind/router/`
