# Unified Orchestrator Command Center Implementation Plan

**Date:** 2026-05-17  
**Status:** Ready for Phase 2 execution  
**Related:** 
- `docs/system/obsidian-mind-model-router-roadmap.md` (unified cockpit roadmap)
- `docs/system/stb-to-video-orchestrator-migration-plan-2026-05-17.md` (STB migration details)
- `docs/system/probot-to-brain-console-migration-review-2026-05-17.md` (ProBot feature disposition)

---

## Objective

Build Brain Console as a unified command center for all system intelligence: machine state, local apps, orchestrators, pipelines, approvals, and operational decisions. Migrate valuable ProBot features through Brain Core. Preserve Says the Bible operational pipeline. Build Video Orchestrator as canonical future architecture alongside STB with dual-run validation.

**Core mission:** One primary dashboard (Obsidian Brain Console) + one API boundary (Brain Core) + one machine runtime (brain repo).

---

## Architecture Summary

### Key Principles

1. **Brain Console is primary** — Obsidian plugin dashboard with 8 sections (Overview, Apps, Orchestrators, Pipelines, Projects, Approvals, Research, System)
2. **Brain Core is API layer** — Local-only HTTP service exposing typed read-only + approval-request-only endpoints
3. **Says the Bible is operational** — Daily production pipeline, visible as "legacy/operational" in dashboard, no code modifications until STB→video parity
4. **Video Orchestrator is canonical future** — Built alongside STB (not replacement), 12 modules rebuilt from STB, dual-run validation before any production switch
5. **ProBot is legacy** — Features migrate through Brain Core → Brain Console; ProBot remains secondary
6. **Decommission safeguards** — Nothing deleted/disabled until Brain Core equivalent exists, Brain Console section displays it, tests pass, and user approves

### Data Flow

```
Obsidian Brain Console Plugin
    ↓ requestUrl IPC (localhost fallback)
Brain Core API (local-only HTTP)
    ↓
Adapters (status, sessions, apps, orchestrators, pipelines, projects, approvals, scheduler)
    ↓
ProBot (legacy status), STB (operational status), Video Orchestrator (progress), 
Local apps, Scheduler, Model-router, Skills, Projects/domains
```

---

## Phase 0: Architecture Lock and Preservation (COMPLETE)

### Goal
Lock direction, document architecture, preserve existing systems, stop ProBot dashboard expansion.

### Completed Tasks
- ✅ Unified cockpit roadmap created (`obsidian-mind-model-router-roadmap.md`)
- ✅ STB migration plan created (`stb-to-video-orchestrator-migration-plan-2026-05-17.md`)
- ✅ ProBot feature disposition analyzed (`probot-to-brain-console-migration-review-2026-05-17.md`)
- ✅ Brain Console architecture documented
- ✅ Verified Brain Core exists and runs on 4877
- ✅ Brain Console connected to Brain Core via requestUrl API

### Exit Criteria Met
- ✅ Roadmap and implementation plan committed
- ✅ Says the Bible marked non-negotiable/operational (untouched)
- ✅ Video Orchestrator marked canonical/future (status tracking only)
- ✅ ProBot migration phases documented (legacy/secondary)
- ✅ Decommission safeguards explicit
- ✅ Brain Core port = 4877 (preserved)
- ✅ All existing endpoints preserved

---

## Phase 1: Inventory and Endpoint Gap Analysis (READY)

### Goal
Verify existing Brain Core state, document current endpoints, identify gaps for unified orchestrator registries.

### Tasks

#### 1.1 Inventory existing Brain Core
**Brain Core already exists at `projects/brain-core/`**

**Files to inspect:**
```
projects/brain-core/
  package.json           (Node built-in http, not Express)
  tsconfig.json          (TypeScript strict mode)
  src/
    index.ts             (entry point)
    api/
      server.ts          (binds to 127.0.0.1:4877)
      routes.ts          (existing routes)
      types.ts           (existing types)
    adapters/            (status, local-apps, sessions, skills)
    security/
      localhost.ts       (4877 port = BRAIN_CORE_PORT env var)
      redaction.ts       (credentials removal)
    tests/               (jest-based, follow existing patterns)
```

**Verification checklist:**
- ✅ Brain Core port = 4877 (PRESERVED, do NOT change)
- ✅ Localhost-only binding (127.0.0.1)
- ✅ Existing adapters documented
- ✅ Test patterns understood
- ✅ Redaction layer verified

**Exit criteria:**
- Current structure documented
- Port 4877 confirmed  
- Existing endpoints catalogued
- No breaking changes planned

#### 1.2 Identify endpoints to add/extend

**Existing endpoints (PRESERVE AS-IS):**
- ✅ GET /status
- ✅ GET /local-apps
- ✅ GET /sessions
- ✅ GET /skills
- ✅ GET /runtime/readiness
- ✅ GET /execution/maintenance-previews
- [other existing endpoints]

**Endpoints to add/extend (Phase 2):**
- NEW: `GET /orchestrators` — registry of all orchestrators
- NEW: `GET /orchestrators/:id` — detail
- NEW: `GET /pipelines` — Says the Bible + video + migration
- NEW: `GET /pipelines/:id` — detail
- NEW: `GET /projects` (or `/domains`) — project registry  
- NEW: `GET /platforms` — YouTube, Pinterest, Facebook, etc.
- EXTEND: `GET /approvals` (if not present)
- EXTEND: `GET /scheduler/...` (if not present)

**Exit criteria:**
- Gap list documented
- No breaking changes to existing endpoints
- New adapters scoped and named
- Port remains 4877


---

## Phase 2: Extend Existing Brain Core (2-3 weeks)

### Goal
Add read-only unified orchestrator registry surfaces to existing Brain Core running on 4877.

### Tasks

#### 2.1 Extend Brain Core adapters
**Files to create/extend in `projects/brain-core/src/adapters/`:**

- **orchestrators.ts** — Index all orchestrators (video, research, design, code, model-router, scheduler)
- **pipelines.ts** — STB status adapter (read ProBot), video orchestrator adapter (progress tracking), migration card (aggregated)
- **projects.ts** or **domains.ts** — Project registry (link to pipelines and orchestrators)
- **platforms.ts** — Platform registry (YouTube, Pinterest, Facebook, etc.)
- **approvals.ts** (if missing) — Read Brain Core approval queue
- **scheduler.ts** (if missing) — Read scheduler status

**Data sources (read-only, no mutations):**
- ProBot STB operational state
- ProBot design artifacts (video orchestrator)
- `brain/projects/*/` (orchestrators)
- `mind/` vault (projects, domains)
- Office scheduler state

**Exit criteria:**
- All new adapters follow existing patterns
- STB status reads from ProBot (read-only)
- Video orchestrator progress tracked (read-only)
- Migration card aggregates both (read-only)
- Port remains 4877
- No breaking changes to existing adapters

#### 2.2 Add routes to Brain Core
**File:** `projects/brain-core/src/api/routes.ts`

**Routes to add/extend:**
- `GET /orchestrators` → call adapters.getOrchestrators()
- `GET /orchestrators/:id` → call adapters.getOrchestrator(id)
- `GET /pipelines` → call adapters.getPipelines()
- `GET /pipelines/:id` → call adapters.getPipeline(id)
- `GET /projects` (or `/domains`) → call adapters.getProjects()
- `GET /platforms` → call adapters.getPlatforms()

**Exit criteria:**
- All new routes added
- Existing routes preserved (no breaking changes)
- Routes test pass
- Request handling consistent with existing patterns

#### 2.3 Update types for new endpoints
**File:** `projects/brain-core/src/api/types.ts`

**Types to add:**
- `Orchestrator`, `OrchestratorRegistry`
- `Pipeline`, `PipelineRegistry`, `STBPipelineStatus`, `VideoOrchestratorStatus`
- `MigrationCard`
- `Project`, `ProjectRegistry`
- `Platform`, `PlatformRegistry`

**Exit criteria:**
- All new types added
- TypeScript strict mode passes
- No unused types

#### 2.4 Write/extend tests
**Follow existing test patterns in `projects/brain-core/src/tests/`**

- Test each new adapter independently
- Happy path (data available)
- Error case (service offline, graceful 503)
- Schema validation
- Redaction applied

**Exit criteria:**
- npm test passes
- Existing tests still pass (no breaking changes)
- Coverage maintained or improved

---

## Phase 3: Extend Brain Console to Consume Registry Endpoints (2 weeks)

### Goal
Update existing Brain Console Obsidian plugin to consume Phase 2 Brain Core registry endpoints and display orchestrators, pipelines, projects/domains, platforms, and STB/video side-by-side.

### Production acceleration — Render Readiness / Export Policy

Phase 3o adds a read-only render/export policy surface:

- Brain Core endpoint: `GET /video-orchestrator/render-export-policy`.
- Brain Console Pipelines card: Video Render / Export Policy.
- Scope: policy checklist only for rendering, export package, artifact sandbox, output-path placeholders, approval/rollback, cleanup, and safety.
- Explicitly disabled: rendering, export, file writing, downloads, approval creation, ffmpeg/export runner registration, platform publishing, and Mind writes.
- No POST route or executable action was added; the production gate remains blocked/not-ready.
- Next safe implementation choices: approval policy design, artifact sandbox design, controlled dry-run execution design.

### Current State
- ✅ Brain Console plugin exists at `projects/brain-console-obsidian/`
- ✅ Already loads in Obsidian
- ✅ Already connects to Brain Core via requestUrl IPC API
- ✅ Already has basic card rendering framework
- ✅ Already has dark theme and styling
- ✅ Do NOT recreate plugin skeleton or scaffolding

### Tasks

#### 3.1 Extend Brain Console HTTP client
**File:** `projects/brain-console-obsidian/src/client.ts`

**Existing capability:**
- Uses Obsidian `requestUrl` API (IPC-based HTTP)
- Fallback to localhost/127.0.0.1:4877
- Already implements exponential backoff and error diagnostics

**New additions:**
- Add client reader methods:
  - `getOrchestrators()` → GET `/orchestrators`
  - `getOrchestrator(id)` → GET `/orchestrators/:id`
  - `getPipelines()` → GET `/pipelines`
  - `getPipeline(id)` → GET `/pipelines/:id`
  - `getProjects()` or `getDomains()` → GET `/projects` or `/domains`
  - `getPlatforms()` → GET `/platforms`
- Add type definitions for responses
- Add graceful error handling per endpoint

**Exit criteria:**
- All new client methods callable
- Responses type-safe and validated
- Error handling matches existing patterns
- Tests updated for new methods

#### 3.2 Add Orchestrators panel to Brain Console dashboard
**File:** `projects/brain-console-obsidian/src/view.ts` and related

**New content:**
- Render orchestrator registry
- Show: name, category (skill/pipeline/system), status, last run, queue count
- Display all 7 agents: model-router, video, research, design, code, Bible research, scheduler
- Link to projects/pipelines if applicable
- Status pills (ready/partial/error/future)

**Exit criteria:**
- Orchestrators panel renders
- All orchestrators visible
- Responsive to data updates
- Tests pass

#### 3.3 Add Pipelines panel to Brain Console dashboard
**File:** `projects/brain-console-obsidian/src/view.ts` and related

**New content:**
- Render pipeline registry
- Show THREE cards side-by-side:
  1. **Says the Bible (Operational)** — status, last run, queue, platform status, "no changes during migration" warning
  2. **Video Orchestrator (Future)** — module progress, parity status, next task
  3. **Migration Card** — STB → video progress, safeguards enforced, timeline
- All three always visible during migration
- STB marked as "operational/legacy"
- Video marked as "canonical-future/designing"
- Read-only display (no mutations)

**Exit criteria:**
- Pipelines panel renders all three cards
- STB and video shown side-by-side
- Says the Bible clearly marked as operational
- Migration progress visible
- Tests pass

#### 3.4 Add Projects/Domains panel to Brain Console dashboard
**File:** `projects/brain-console-obsidian/src/view.ts` and related

**New content:**
- Render projects/domains registry
- Show: name, type, status, owner, linked pipeline, linked orchestrators
- Link to platforms if applicable
- List all active projects and their associations

**Exit criteria:**
- Projects/Domains panel renders
- Relationships clear (pipeline/orchestrator links)
- Tests pass

#### 3.5 Add Platforms panel to Brain Console dashboard
**File:** `projects/brain-console-obsidian/src/view.ts` and related

**New content:**
- Render platforms registry
- Show: YouTube, Pinterest, Facebook, etc.
- Linked project, last activity, queue status
- Associated with Says the Bible or video orchestrator

**Exit criteria:**
- Platforms panel renders
- Associations with projects clear
- Tests pass

#### 3.6 Update styles for new panels
**File:** `projects/brain-console-obsidian/styles.css`

**Changes:**
- Add styles for Orchestrators, Pipelines, Projects/Domains, Platforms panels
- Maintain dark cockpit aesthetic (#0a0e27 background, #ff6b3d accents)
- Ensure legible layout for side-by-side STB/video cards
- Monospaced system data, sans-serif descriptions
- Status pills, progress bars for visualization

**Exit criteria:**
- All panels styled consistently
- Dark theme maintained
- Legible and sparse (no clutter)
- Responsive layout

#### 3.7 Add tests for new panels
**Test scope:**
```
tests/
  orchestrators.test.ts (panel rendering)
  pipelines.test.ts (STB + video side-by-side)
  projects.test.ts (projects/domains rendering)
  platforms.test.ts (platforms rendering)
  client.test.ts (updated for new client methods)
```

**Coverage:**
- Panel rendering with mock data
- Error handling (offline Brain Core)
- Data refresh
- Type safety
- STB/video coexistence

**Exit criteria:**
- npm test passes
- 80% coverage maintained
- All new panels tested

---

## Phase 3b: Video Orchestrator Production Acceleration — First Module (2026-05-18)

### Goal
Implement the first Video Orchestrator production module (intake) as proof-of-concept for the production architecture. Validate dual-run infrastructure with deterministic, read-only, zero-risk module. Establish pattern for remaining modules.

### Status: COMPLETE (2026-05-18)

### Completed Tasks

#### 3b.1 Implement Video Orchestrator intake module
**Files created/modified:**
- ✅ `projects/brain-core/src/types/api.ts` — Added 3 new interfaces: BrainCoreVideoIntakeSource, BrainCoreVideoIntakePlan, BrainCoreVideoOrchestratorIntakeResponse
- ✅ `projects/brain-core/src/adapters/video-orchestrator-intake.ts` (NEW) — Adapter with getVideoOrchestratorIntake() and getVideoOrchestratorIntakePlan(planId) exports
- ✅ `projects/brain-core/src/api/routes.ts` — Added HTTP handlers for GET /video-orchestrator/intake and GET /video-orchestrator/intake/:id
- ✅ `projects/brain-core/src/tests/live-status-endpoints.test.ts` — 3 new tests (163/163 passing)

**Implementation details:**
- 5 test fixture sources (stories 052-056 from dual-run validation evidence)
- Each source maps to intake plan with normalized inputs
- All endpoints return aggregated response with safety flags hardcoded
- Safety flags: readOnly=true, executesStb=false, executesVideo=false, writesFiles=false, publishesContent=false, writesToMind=false
- GET /video-orchestrator/intake returns all sources + plans + summary
- GET /video-orchestrator/intake/:id returns individual plan with 404 for unknown

**Evidence:**
- Dual-run test suite passing: 10/10 passage selection tests validated (2026-05-17T14:00:00Z)
- Parity matrix entry-1-intake status: mapped, deterministic, tested
- Brain Core test suite: 163/163 passing (3 new intake endpoint tests)

#### 3b.2 Integrate intake module into Brain Console dashboard
**Files modified:**
- ✅ `projects/brain-console-obsidian/src/client.ts` — Added readBrainCoreVideoOrchestratorIntake() and readBrainCoreVideoOrchestratorIntakePlan() client methods
- ✅ `projects/brain-console-obsidian/src/view.ts` — Added videoOrchestratorIntake field to view state, renderVideoIntakeCard() function, integrated card into Pipelines section

**Visibility:**
- Brain Console Pipelines section now displays intake status card
- Shows sources count, plans count, available/blocked breakdown
- Displays all 6 safety flags in green checkmarks
- Card positioned after STB Live Status, before STB ↔ Video Parity Matrix

**Exit criteria:**
- ✅ Brain Console typecheck passes
- ✅ Brain Console build passes (dist/main.js 533.7kb)
- ✅ Brain Console package staged at release
- ✅ All safety flags verified as hardcoded false (no configuration overrides)

#### 3b.3 Update parity matrix with intake production evidence
**File modified:**
- ✅ `projects/brain-core/src/adapters/stb-video-parity.ts` — Updated entry-1-intake validationEvidence with 5 new lines documenting production readiness

**Evidence recorded:**
- Video Orchestrator intake module implemented: GET /video-orchestrator/intake (2026-05-18)
- Intake production fixtures available: 5 test sources normalized to plans
- GET /video-orchestrator/intake/:id returns individual intake plans
- All safety flags confirmed: readOnly=true, executesStb=false, executesVideo=false, writesFiles=false, publishesContent=false, writesToMind=false
- Brain Core tests: 163/163 passing (includes 3 new intake endpoint tests)

### Design Pattern for Remaining Modules

**Intake module is the first production module because:**
1. ✅ Already tested via dual-run (10 validation tests, 100% pass)
2. ✅ Deterministic (passage selection always produces same input)
3. ✅ Zero rendering risk (no video generation, no composition)
4. ✅ Zero execution risk (no STB calls, no Video calls)
5. ✅ Zero mutation risk (read-only fixtures, no state writes)

**Pattern established:**
- Read-only HTTP endpoints exposing adapter fixtures
- Safety flags hardcoded on all responses (never configurable)
- Test fixtures based on dual-run validation evidence
- Brain Console card displays module status + safety verification
- Parity matrix updated with production evidence

**Next modules follow this pattern:**
1. Script-generation stage (entry-2-structure, entry-3-script) — in-progress validation (4/5 tests passing)
2. Asset-generation stage (entry-4-assets) — partial implementation (preview-only)
3. Voiceover-generation stage (entry-6-voiceover) — partial implementation (preview-only)
4. [Remaining modules blocked by design orchestrator, video assembly, or pending implementation]

### Validation

**Safety validation:**
- ✅ No STB execution flags
- ✅ No Video orchestrator execution flags
- ✅ No file system writes
- ✅ No content publishing
- ✅ No Mind vault mutations
- ✅ Read-only preview mode only

**Functional validation:**
- ✅ HTTP endpoints return 200 OK
- ✅ Response types match interface definitions
- ✅ Error handling returns 404 for invalid IDs
- ✅ Safety flags present and correct on all responses
- ✅ Brain Console integration operational

**Test coverage:**
- ✅ Unit tests for adapter functions
- ✅ Integration tests for HTTP endpoints
- ✅ Type safety in TypeScript strict mode
- ✅ Brain Console card rendering
- ✅ 163/163 tests passing (0 failures)

### Next Steps

1. **Validate script-generation stage (entry-2-structure)** — Complete in-progress testing (currently 4/5 passing, timing variance under investigation)
2. **Implement script-generation module** — Follow intake pattern once entry-2 testing completes
3. **Extend asset-generation stage (entry-4-assets)** — Move from preview-only to full validation
4. **Build design orchestrator** — Required blocker for entry-5 thumbnail design
5. **Implement video-assembly stage** — Required for entries 7-9 (publish stages)

---

## Phase 2C: Brain-Native Agentic OS Scaffold (2-3 weeks)

### Goal
Build lean, approval-gated agent orchestration layer in Brain Core + Brain Console. Persistent agent state, skill registry, run tracking, learning proposals. No autonomous writes.

### Key Decisions
1. **Brain Core owns agent state** — Not in Mind, not in external framework
2. **Claude Code/Codex are external executors** — Third-party agentic tools, not wrapped
3. **Skills are capabilities, not OS** — Reusable, versioned, discoverable instruction sets
4. **Model-router is one registered agent** — Not the container; vault maintenance orchestrator inside the OS
5. **Approval-gated only** — All state mutations require human decision

### Tasks

#### 2C.1 Create agent registry adapter
**File:** `projects/brain-core/src/adapters/agent-registry.ts`

**Data models:**
```typescript
interface AgentRole {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  permissions: {
    canRead: string[];
    canWrite: string[];
    canExecute: string[];
  };
  approvalRequired: boolean;
  metadata: Record<string, unknown>;
}

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  category: "code" | "design" | "research" | "content" | "system" | "orchestrator";
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  dependencies: string[];
  approvalRequired: boolean;
  status: "ready" | "beta" | "deprecated" | "archived";
}
```

**Responsibility:**
- Register 7 agent roles: model-router, video, research, design, code, Bible research, scheduler
- Index skills from `brain/ai/skills/active/` and orchestrators from `brain/projects/*/`
- Expose as read-only HTTP

**Endpoint:** `GET /agents` → AgentRole[]

**Exit criteria:**
- All 7 agents registered
- Skills indexed correctly
- Fast queries (<100ms)
- No side effects

#### 2C.2 Create agent run ledger
**File:** `projects/brain-core/src/adapters/agent-runs.ts`

**Data model:**
```typescript
interface AgentRun {
  id: string;
  planId: string;
  agentId: string;
  status: "queued" | "running" | "paused" | "completed" | "failed" | "blocked";
  startedAt?: Date;
  completedAt?: Date;
  currentStep?: number;
  steps: Array<{
    sequence: number;
    skillId: string;
    status: "pending" | "running" | "completed" | "failed";
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    error?: string;
    duration?: number;
  }>;
  blockers?: string[];
  approvalsPending?: string[];
}
```

**Responsibility:**
- Store agent runs (append-only, file-based or in-memory for Phase 1)
- Track run state and step progress
- Read-only in Phase 1 (no write endpoint yet)

**Endpoints:**
```
GET /agent-runs → AgentRun[] (paginated)
GET /agent-runs/latest → AgentRun[] (most recent per agent)
GET /agent-runs/:id → AgentRun (full detail)
```

**Exit criteria:**
- Runs stored and retrievable
- Append-only (no mutations in Phase 1)
- Timestamped
- Tests pass

#### 2C.3 Create agent skills registry
**File:** `projects/brain-core/src/adapters/agent-skills.ts`

**Responsibility:**
- Index all skills from `brain/ai/skills/active/`
- Categorize by type (code, design, research, content, system, orchestrator)
- Expose version, status, dependencies, approval requirements

**Endpoints:**
```
GET /agent-skills → AgentSkill[]
GET /agent-skills/:id → AgentSkill (detail)
```

**Exit criteria:**
- Skills indexed with metadata
- Categories accurate
- Dependencies tracked
- Tests pass

#### 2C.4 Create agent event audit trail
**File:** `projects/brain-core/src/adapters/agent-events.ts`

**Data model:**
```typescript
interface AgentEvent {
  id: string;
  timestamp: Date;
  agentId: string;
  runId?: string;
  type: "started" | "step_completed" | "blocked" | "approval_requested" | "approval_granted" | "failed" | "completed";
  message: string;
  metadata: Record<string, unknown>;
}
```

**Responsibility:**
- Record events from all agents
- Provide observability for run tracking, failures, blockers
- Append-only

**Endpoint:**
```
GET /agent-events → AgentEvent[] (paginated, time-sorted)
GET /agent-events/:runId → AgentEvent[] (per run)
```

**Exit criteria:**
- Events recorded and retrievable
- Timestamps accurate
- Filterable by agent/run
- Tests pass

#### 2C.5 Create Agent View in Brain Console
**File:** `projects/brain-console-obsidian/src/components/agent-view.ts`

**New Brain Console section: "Agents" (between Orchestrators and Pipelines)**

**Cards to build:**

1. **Active Runs** — Currently executing runs
   - Agent name, run ID, current step
   - Progress (x/y steps)
   - Time running, ETA
   - Blockers (if any)

2. **Agent Queue** — Pending runs
   - Agent name, run ID, position in queue
   - Priority, age, next task
   - Ready to execute? (blockers?)

3. **Current Plan** — For focused agent
   - Plan title, steps, dependencies
   - Approval gates, current step
   - Next task to execute

4. **Skills Used** — In active run
   - Skill names, versions, status (pending/running/done/error)
   - Category, dependencies

5. **Approvals Needed** — For agents
   - Plan approval, step approval, memory update approval
   - Requested by, timestamp, pending decision

6. **Recent Outcomes** — Last 5 runs per agent
   - Status (passed/failed/blocked), duration, error if any
   - Timestamp, outcome

7. **Learning Proposals** — Memory updates from agents
   - Agent name, proposed update description
   - Source (why proposed), pending review
   - Approve / Review / Reject buttons (disabled, Phase 2+)

8. **Agent Roles** — Registry of all agents
   - Name, status (ready/idle/blocked)
   - Capabilities, permissions
   - Last activity timestamp

**Design rule:** Sparse dark cockpit, monospaced data, progressive disclosure. Same visual as other cards.

**Exit criteria:**
- All cards render without errors
- Data updates on refresh
- No mutations (read-only)
- Tests pass

#### 2C.6 Integrate model-router as first registered agent
**File:** `projects/brain-core/src/adapters/agent-registry.ts` (extend)

**Responsibility:**
- Query model-router job history from `~/.office-scheduler/`
- Expose vault maintenance runs as agent runs
- Register model-router capabilities (compile, memory, hygiene, drift loops)

**Endpoints:**
- `GET /agents/model-router` → model-router role + capabilities
- `GET /agent-runs?agentId=model-router` → vault maintenance run history

**Exit criteria:**
- Model-router appears as registered agent
- Runs visible in Agent View
- Vault maintenance capabilities exposed
- Tests pass

#### 2C.7 Register all 7 orchestrator agents
**File:** `projects/brain-core/src/adapters/agent-registry.ts` (extend)

**Agents to register:**
1. Model Router (vault maintenance)
2. Video Orchestrator (pipeline)
3. Research Orchestrator (web search, synthesis)
4. Design Orchestrator (image generation, thumbnails)
5. Code Orchestrator (refactoring, testing, shipping)
6. Bible Research Orchestrator (scripture research)
7. Scheduler (nightly jobs)

**Responsibility:**
- Hardcode agent definitions with capabilities
- Link to orchestrator entries in Brain Core
- Expose in Agent View

**Exit criteria:**
- All 7 agents registered
- Roles and permissions defined
- Brain Console shows all agents
- Tests pass

#### 2C.8 Create approval infrastructure (read-only in Phase 1)
**File:** `projects/brain-core/src/adapters/agent-approvals.ts`

**Data model:**
```typescript
interface AgentApproval {
  id: string;
  type: "run_approval" | "step_approval" | "memory_update" | "skill_modification";
  targetId: string;
  requestedAt: Date;
  requestedBy: string;
  status: "pending" | "approved" | "rejected";
  decidedAt?: Date;
  decidedBy?: string;
  reason?: string;
}
```

**Responsibility:**
- Read-only approval queue (Phase 1)
- Prepare for mutation endpoints (Phase 2+)

**Endpoint:**
```
GET /agent-approvals → AgentApproval[] (pending + recent)
GET /agent-approvals/:id → AgentApproval (detail)
```

**Exit criteria:**
- Approvals readable
- Serializable as JSON
- Tests pass

#### 2C.9 Add agent readiness endpoint
**Endpoint:** `GET /agent-readiness`

**Response:**
```typescript
{
  timestamp: Date;
  agents: Array<{
    id: string;
    name: string;
    status: "ready" | "idle" | "blocked";
    blockers?: string[];
  }>;
  ready: boolean;  // all agents ready?
  criticalBlockers?: string[];
}
```

**Exit criteria:**
- Endpoint returns accurate status
- Used by Brain Console for diagnostics
- Tests pass

#### 2C.10 Write tests for agentic OS layer
**Test scope:**
- Agent registry (CRUD, indexing)
- Agent runs (creation, appending, retrieval)
- Agent skills registry (indexing, filtering)
- Agent events (recording, audit trail)
- Agent readiness (status detection)
- Model-router integration
- All endpoints callable and return typed data
- Error cases (agent offline, missing data)

**Coverage:** Minimum 80%

**Exit criteria:**
- `npm test` passes
- All new adapters tested
- No breaking changes to existing tests

### Safety Model (Phase 1)

- **Read-only by default** — All agent endpoints read-only
- **No autonomous writes** — No agent can mutate Mind/Brain without approval
- **Skill whitelisting** — Only registered agents can execute registered skills
- **Event audit trail** — All runs, approvals, and learning proposals logged
- **Graceful degradation** — If an agent offline, return "unavailable" not crash
- **No broad shell** — Agents use typed skill interfaces only
- **No external repo blind install** — All orchestrators authored in Brain, not external

### Success Criteria

- ✅ 7 agent roles registered in Brain Core
- ✅ Agent runs tracked (queued → running → completed/failed)
- ✅ Agent skills indexed and discoverable
- ✅ Agent events recorded for audit trail
- ✅ Agent View section renders all cards
- ✅ Model-router appears as first registered agent
- ✅ All 7 orchestrators registered (video, research, design, code, Bible research, scheduler, model-router)
- ✅ Brain Core `/agent-readiness` reports accurate status
- ✅ No autonomous writes to Mind
- ✅ Tests pass (80% coverage)
- ✅ Ready for Phase 2C+ approval-gated mutations

---

## Phase 2B: Orchestrator Registry Brain Core API (1-2 weeks)

### Goal
Create read-only orchestrator registry in Brain Core.

### Tasks

#### 2B.1 Create orchestrators adapter
**File:** `projects/brain-core/src/adapters/orchestrators.ts`

**Responsibility:**
- Read orchestrator inventory from `brain/projects/*/` and `brain/ai/skills/active/`
- Expose: name, category, status, modules, execution status

**Data model:**
```typescript
interface Orchestrator {
  id: string;
  name: string;
  category: "skill" | "pipeline" | "system" | "future";
  status: "ready" | "partial" | "error" | "future";
  description?: string;
  modules?: string[];
  lastRun?: Date;
  queueCount?: number;
  errorCount?: number;
  nextTask?: string;
  linkedProject?: string; // e.g., "Says the Bible"
  linkedPipeline?: string; // e.g., "stb-daily-pipeline"
}
```

**Orchestrators to index:**

1. Model Router — `brain/projects/model-router/`
2. Video Orchestrator — `brain/projects/video-orchestrator/` (future)
3. Research Orchestrator — `brain/ai/skills/active/research/` or similar
4. Design Orchestrator — `brain/ai/skills/active/design/`
5. Code Orchestrator — `brain/ai/skills/active/code/`
6. Bible Research Orchestrator — planned
7. Scheduler — Office nightly scheduler
8. Skills Hub — indexed from `brain/ai/skills/active/`

**Exit criteria:**
- All orchestrators indexed and typed
- Status reflects actual state
- No external shell execution
- Fast index (<100ms)

#### 2B.2 Add orchestrator detail endpoint
**Endpoint:** `GET /orchestrators/:id`

**Response includes:**
- Full metadata
- Module list (if applicable)
- Execution history (last 5 runs)
- Current queue (if applicable)
- Next scheduled task
- Linked pipelines/projects

**Exit criteria:**
- Endpoint returns typed data
- 404 for unknown orchestrators
- Tests pass

---

## Phase 4: Projects/Domains Registry (1-2 weeks)

### Goal
Create read-only projects and domains registry in Brain Core.

### Tasks

#### 3.1 Create projects adapter
**File:** `projects/brain-core/src/adapters/projects.ts`

**Data model:**
```typescript
interface Project {
  id: string;
  name: string;
  type: "content" | "system" | "business" | "research";
  status: "active" | "paused" | "archived";
  owner?: string;
  linkedPipeline?: string; // e.g., "stb-daily-pipeline"
  linkedOrchestrators?: string[];
  platforms?: string[]; // YouTube, Pinterest, etc.
  lastModified?: Date;
}
```

**Projects to index:**
1. Says the Bible (linked to stb-daily-pipeline)
2. Machine Brain (linked to model-router, video-orchestrator)
3. Active research projects (from mind vault)
4. Other active business projects

**Exit criteria:**
- Projects indexed from multiple sources
- Links to pipelines/orchestrators accurate
- Tests pass

---

## Phase 5: Approvals Framework (1-2 weeks)

### Goal
Create read-only approvals display for Brain Console.

### Tasks

#### 4.1 Create approvals adapter
**File:** `projects/brain-core/src/adapters/approvals.ts`

**Responsibility:**
- Read pending approvals from Brain Core state
- Expose: action, description, requested, expires, status

**Data model:**
```typescript
interface Approval {
  id: string;
  action: "app-start" | "app-stop" | "orchestrator-run" | "stb-switch" | "video-cutover" | "other";
  description: string;
  requestedAt: Date;
  requestedBy?: string;
  expiresAt?: Date;
  status: "pending" | "approved" | "rejected" | "expired";
  metadata?: Record<string, any>;
}
```

**Exit criteria:**
- Approvals read from storage
- Type-safe responses
- Tests pass

#### 4.2 Add approval display to Brain Console
**Changes to `view.ts`:**
- Add Approvals card to Brain Console
- Show pending approvals with request date
- Show approve/reject buttons (disabled, "planned for Phase 5")

**Exit criteria:**
- Card renders correctly
- Approval details visible
- Type-safe

---

## Phase 5: Approval-Gated Actions (2-3 weeks)

### Goal
Add action capability behind approval gates.

### Tasks

#### 5.1 Create action request endpoint
**Endpoint:** `POST /actions/request`

**Request body:**
```json
{
  "action": "stb-switch-to-video" | "app-start" | "app-stop" | "other",
  "description": "Switch Says the Bible to video orchestrator for YouTube",
  "metadata": {}
}
```

**Response:**
```json
{
  "approvalId": "...",
  "status": "pending",
  "requestedAt": "...",
  "expiresAt": "..."
}
```

**Rules:**
- Create approval record
- Send notification (if configured)
- Store in Brain Core state
- Return approval ID

**Exit criteria:**
- Endpoint creates and stores approvals
- Tests pass
- Notifications work (local mock)

#### 5.2 Create approval decision endpoints
**Endpoints:**
```
POST /approvals/:id/approve
POST /approvals/:id/reject
```

**Rules:**
- Require local-only access
- Log decision with timestamp
- Trigger action if approved
- Audit trail maintained

**Exit criteria:**
- Decisions recorded
- Actions triggered correctly
- Audit trail present

#### 5.3 Connect approval actions to Brain Console
**Changes to plugin:**
- Enable approve/reject buttons on Approvals card
- Show action results
- Update card after decision

**Exit criteria:**
- Plugin can approve/reject
- Actions execute correctly
- Dashboard updates

---

## Phase 6: ProBot Deprecation and Brain Console Transition (1-2 weeks)

### Goal
Announce ProBot as legacy, shift daily operation to Brain Console.

### Tasks

#### 6.1 Add deprecation notice to ProBot
**Files:**
- `projects/probot/README.md` (deprecation banner)
- `projects/probot/src/bot/dashboard.ts` (deprecation notice on dashboard)

**Content:**
```
⚠️ DEPRECATED: ProBot dashboard is legacy. 
Use Obsidian Brain Console instead (primary cockpit).
ProBot remains available for emergency access only.
```

**Exit criteria:**
- Deprecation clearly visible
- Documentation updated

#### 6.2 Migrate ProBot features no longer needed
**Decision:**
- Features migrated → archived in Brain Core, removed from ProBot
- Features not migrated → document as "not planned"
- Emergency-only features → kept but marked legacy

**Exit criteria:**
- Clear list of what stays/goes/migrates
- Brain Console has replacements for all "stays"

#### 6.3 Update operational runbooks
**Files to update:**
- `operations/runbooks/probot-dashboard.md` → renamed to `probot-legacy.md`
- Create new `operations/runbooks/brain-console-operations.md`

**Content:**
- Brain Console primary dashboard instructions
- Brain Core diagnostics
- ProBot fallback instructions

**Exit criteria:**
- Clear operational docs
- Team knows Brain Console is primary

---

## Phase 7: STB Operational Status Visibility (1-2 weeks)

### Goal
Ensure Says the Bible status is visible in Brain Console with proper safeguards.

### Tasks

#### 7.1 Create STB status dashboard card (Phase 2A+)
**File:** `projects/brain-console-obsidian/src/components/stb-card.ts`

**Card content:**
- Status (active/paused/error)
- Last run + duration
- Queue count + failure count
- Current processing
- Platform status (YouTube, Pinterest, Facebook)
- "No production changes during migration" warning

**Exit criteria:**
- Card renders STB status
- Warning visible
- Read-only (no mutations)

#### 7.2 Create STB operational preservation documentation
**File:** `docs/system/stb-operational-preservation.md`

**Content:**
- Why STB remains non-breakable
- What Brain Core can and cannot do to STB
- Approval requirements for any STB changes
- Rollback procedures

**Exit criteria:**
- Documentation clear
- Team understands safeguards

---

## Phase 8: Video Orchestrator Progress Tracking (2-3 weeks)

### Goal
Build visual tracking of video orchestrator module progress in Brain Console.

### Tasks

#### 8.1 Create module completion tracker
**Data model:**
```typescript
interface VideoModuleProgress {
  module: string; // e.g., "research-intake"
  stbConcept: string; // e.g., "Scripture research"
  status: "planned" | "partial" | "implemented" | "tested" | "validated";
  parityStatus: "not-started" | "partial" | "complete";
  estimatedCompletion?: Date;
  parity: { correctness, quality, performance, compatibility, safety };
  dualRunMetrics?: {
    testsPassed: number;
    testsFailed: number;
    outputMatches: number;
  };
}
```

**Exit criteria:**
- Tracker stores module progress
- Can query per-module status
- Parity metrics accurate

#### 8.2 Create migration progress visualization
**Brain Console card:**
- Module progress bar (3/12 complete)
- Per-module status (✓/◐/✗)
- Next task to start
- Timeline estimate

**Exit criteria:**
- Dashboard shows accurate progress
- Visual is clear and actionable

---

## Phase 9: STB→Video Dual-Run Validation Infrastructure (3-4 weeks)

### Goal
Build infrastructure for running STB and video orchestrator in parallel with output comparison.

### Tasks

#### 9.1 Create dual-run test framework
**Files:**
```
projects/video-orchestrator/
  tests/
    dual-run/
      test-runner.ts
      comparators.ts
      fixtures/
        stb-test-inputs.json
        stb-expected-outputs.json
```

**Capability:**
- Load test input
- Run STB module
- Run video module equivalent
- Compare outputs (correctness, quality, performance)
- Generate report

**Exit criteria:**
- Framework compares outputs
- Report shows parity %
- Tests can be run manually or via CI

#### 9.2 Create first dual-run test (Research/Intake Module)
**Test:**
- Input: 10 Bible passages
- Run: STB research → Bible research orchestrator
- Compare: passage selection, metadata, formatting
- Report: parity %

**Exit criteria:**
- Test runs successfully
- Report generated
- Parity tracked

---

## Phase 10: STB Module Rebuild (Building First 3 Modules) (6-8 weeks)

### Goal
Build first 3 video orchestrator modules with parity validation.

### Tasks (Per Module: 2-3 weeks each)

#### 10.1 Module 1: Research/Scripture Intake
**Target:** `projects/video-orchestrator/src/stages/bible-research/`

**Replaces:** STB scripture research module

**Deliverables:**
- Input: Bible passages, topics
- Output: structured scripture data (matching STB)
- Tests: dual-run comparison with STB
- Validation: parity achieved

**Exit criteria:**
- Module matches STB output
- Dual-run tests pass
- Code reviewed and merged

#### 10.2 Module 2: Script Generation
**Target:** `projects/video-orchestrator/src/stages/script-generation/`

**Replaces:** STB outline + script generation

**Exit criteria:**
- Module matches STB output quality
- Dual-run tests pass
- Code reviewed and merged

#### 10.3 Module 3: Asset Generation
**Target:** `projects/video-orchestrator/src/stages/asset-generation/`

**Replaces:** STB asset generation

**Exit criteria:**
- Module matches STB asset metadata
- Dual-run tests pass
- Code reviewed and merged

---

## Phase 11: Remaining Modules (Phases 10b-10d) (8-12 weeks)

### Goal
Build remaining 9 video orchestrator modules.

**Modules (in order):**
4. Video Assembly
5. Design Orchestrator Integration (Thumbnail)
6. Metadata Enrichment
7. YouTube Publishing
8. Pinterest Publishing
9. Facebook Publishing
10. Approval/Review Gate
11. Archive/Logging
12. Future extensibility

**Per-module pattern:** Same as Phase 10 (build, validate, dual-run, merge)

**Exit criteria:** All 12 modules complete, dual-run parity achieved for each

---

## Phase 12: Integration Testing and Full Pipeline Validation (3-4 weeks)

### Goal
Validate full end-to-end pipeline with dual-run on both STB and video orchestrator.

### Tasks

#### 12.1 Run full pipeline dual-run test
**Test:**
- Input: 5-10 Bible topics (full end-to-end)
- Run: STB pipeline (research → script → assets → video → publish test account)
- Run: Video orchestrator pipeline (same input, test account)
- Compare: all outputs (video quality, metadata, platform compatibility)

**Exit criteria:**
- Both pipelines complete successfully
- Video outputs match STB (or better)
- No platform rejections
- Performance acceptable

#### 12.2 Monitor dual-run for 2 weeks
**Activity:**
- Run both pipelines daily
- Compare outputs
- Track metrics (success rate, processing time, platform acceptance)
- Adjust video modules as needed

**Exit criteria:**
- 100% success rate on test data
- Performance similar to STB
- Quality acceptable

---

## Phase 13: User Approval and Gradual Cutover (4-5 weeks)

### Goal
Get explicit user approval and switch one platform at a time.

### Tasks

#### 13.1 Prepare cutover brief
**Document:**
- Summary of dual-run validation
- Video orchestrator readiness assessment
- Platform-by-platform cutover plan
- Rollback procedures

**Exit criteria:**
- Brief ready for user review

#### 13.2 Get explicit user approval
**Process:**
- Present dual-run results
- Show side-by-side video output
- Get documented approval
- Timestamp approval in Brain Core

**Exit criteria:**
- Approval documented and timestamped

#### 13.3 Gradual platform cutover
**Order:**
1. YouTube (largest audience)
2. Pinterest (medium audience)
3. Facebook (smallest audience)

**Per-platform process:**
- Switch production to video orchestrator
- Monitor for 1 week
- Check platform acceptance, user feedback
- If successful: proceed to next
- If problem: rollback to STB, investigate

**Exit criteria:**
- All 3 platforms successfully switched
- 1 week of monitoring per platform
- No user-facing issues

#### 13.4 Decommission Says the Bible (After 4 weeks production success)
**Steps:**
1. Archive STB code (not delete)
2. Update documentation
3. Remove from daily execution queue
4. Keep rollback capability for 3 months
5. Announce transition complete

**Exit criteria:**
- STB archived, video in production
- Documentation updated
- Team notified

---

## Definition of Done

### For Phase 1 (Brain Core Foundation)
- ✅ Brain Core service starts locally
- ✅ All read-only endpoints return typed JSON
- ✅ STB and Video Orchestrator adapters exist
- ✅ Localhost-only binding verified
- ✅ Tests pass (80% coverage)
- ✅ No secrets in responses

### For Phase 2 (Brain Console MVP)
- ✅ Obsidian plugin loads
- ✅ 6 core cards render
- ✅ Brain Core client works
- ✅ Dark theme applied
- ✅ Read-only (no mutations)
- ✅ Tests pass

### For Phase 3-4 (Registries and Approvals)
- ✅ Orchestrator registry indexed
- ✅ Projects registry indexed
- ✅ Approvals framework functional
- ✅ Brain Console displays approvals
- ✅ Tests pass

### For Phase 5-6 (Actions and Transition)
- ✅ Approval-gated actions work
- ✅ ProBot marked deprecated
- ✅ Brain Console is primary
- ✅ Operational docs updated
- ✅ Tests pass

### For Phase 7-9 (STB and Video Status)
- ✅ STB status visible in Brain Console
- ✅ Video progress tracked
- ✅ Migration card shows progress
- ✅ Dual-run infrastructure ready
- ✅ Tests pass

### For Phase 10-13 (Module Buildout and Cutover)
- ✅ All 12 video modules built
- ✅ Dual-run parity achieved
- ✅ User approval documented
- ✅ Gradual cutover successful
- ✅ STB archived
- ✅ Production stable

---

## Timeline Estimate

| Phase | Duration | Total |
|-------|----------|-------|
| 0 | 1 week (complete) | 1 week |
| 1 | 2-3 weeks | 3-4 weeks |
| 2 | 2-3 weeks | 5-7 weeks |
| 2A | 2 weeks (parallel) | 5-7 weeks |
| 2B | 1-2 weeks | 6-9 weeks |
| 3-4 | 2-3 weeks | 8-12 weeks |
| 5-6 | 2-3 weeks | 10-15 weeks |
| 7-9 | 5-7 weeks | 15-22 weeks |
| 10-13 | 13-22 weeks | 28-44 weeks |

**Total estimate:** 6-11 months (depends on parallelization, design orchestrator availability)

---

## Safety Rules

### For Says the Bible
- ✅ Read-only access to STB status only
- ✅ No code modifications during migration
- ✅ Approval required before any STB mutation
- ✅ Dual visibility in dashboard during migration
- ✅ Rollback capability preserved

### For Video Orchestrator
- ✅ Built alongside STB (not replacement)
- ✅ Modules validated one at a time
- ✅ Dual-run validation before any production use
- ✅ No production switch until parity + user approval
- ✅ Decommission safeguards enforced

### For Brain Console
- ✅ Read-only by default
- ✅ Actions require approval
- ✅ No direct shell execution
- ✅ No Mind mutations
- ✅ Credentials never exposed
- ✅ Localhost-only binding

### For ProBot
- ✅ Mark as legacy/deprecated
- ✅ Features migrate through Brain Core
- ✅ ProBot remains fallback only
- ✅ No new features in ProBot
- ✅ Archive code after transition

---

## Next Immediate Task

**Phase 1 Execution (Start):**

1. Create `projects/brain-core/` scaffold
2. Implement `GET /status` endpoint
3. Implement `GET /local-apps` endpoint
4. Implement `GET /pipelines` endpoint with STB + video adapters
5. Add unit tests
6. Deploy and verify

**Estimated duration:** 2-3 weeks  
**Effort level:** Medium (scaffold, adapters, tests)  
**Risk level:** Low (read-only, no side effects)  
**Blockers:** None

---

## Reference

**Related documents:**
- Roadmap: `docs/system/obsidian-mind-model-router-roadmap.md`
- STB migration: `docs/system/stb-to-video-orchestrator-migration-plan-2026-05-17.md`
- ProBot review: `docs/system/probot-to-brain-console-migration-review-2026-05-17.md`
- Architecture: `docs/system/obsidian-command-center-orchestrator-architecture-2026-05-17.md`

**Key team contacts:**
- Brain Core maintainer: [TBD]
- Video Orchestrator lead: [TBD]
- ProBot transition lead: [TBD]

**Success criteria:**
- Brain Console is the single primary dashboard
- Says the Bible remains operational (zero downtime)
- Video Orchestrator is production-ready for Says the Bible content
- ProBot marked as legacy
- All decommission safeguards enforced

---

## Post Orchestrator Implementation Phases

After Brain Console section navigation (Phase 5 complete), the next safe implementation slice is to add Post Orchestrator read-only infrastructure alongside existing pipeline/orchestrator/project visibility.

### Phase P1: Post Orchestrator Read-Only Status Scaffold (NEXT — 2026-05-19+)

**Objective:** Add Post Orchestrator status endpoints and Brain Console visibility. No publishing, no Proofly/Xgrow code changes, no execution.

**Naming boundary:**
- Proofly and Xgrow are legacy/internal migration source names.
- Brain Console should not present them as primary products/providers.
- User-facing Post Orchestrator language should use flows such as Social Proof Asset Flow, Growth Optimization Flow, X Post Flow, GitHub Post Flow, LinkedIn Post Flow, and Platform Publishing Flow.
- Internal docs may retain Proofly/Xgrow references for migration traceability.
- Decommission tracking still references Proofly/Xgrow until migration is complete.

### Phase P2: Post flow fixtures/stubs (NEXT)

**Objective:** Add typed read-only post flow fixtures and draft examples. No publishing, no scheduling, no platform posting, no Playwright execution.

**Brain Core additions:**

- GET /post-orchestrator/flows
- GET /post-orchestrator/drafts
- Typed fixture data for X, GitHub, LinkedIn, Facebook, YouTube, Blog, Social Proof Asset Flow, and Growth Optimization Flow

**Brain Console additions:**

- Platform/Post Flows card
- Draft Fixtures / Preview Examples card
- Safety State card

**Safety boundaries:**

- Read-only fixtures only
- No Proofly/Xgrow code changes
- No platform execution
- No Mind writes

**Exit criteria:**

- Browser console shows neutral flow labels
- Draft fixtures are visible as preview-only examples
- Safety state remains fully disabled

**Brain Core additions:**

1. **New adapter:** `projects/brain-core/src/adapters/post-orchestrator.ts`
   - PostOrchestratorStatus interface
   - readPostOrchestratorStatus() function
   - Static/derived data:
     - orchestrationStatus: 'planned' | 'partial' | 'operational'
     - socialProofFlow: { status, lastSyncAt, contractVersion }
     - growthOptimizationFlow: { status, lastSyncAt, contractVersion }
     - publishing: { enabled: false, reason: 'approval-gated and security review pending' }
     - scheduleHealth: 'operational' | 'degraded'
     - analyticsHealth: 'planned'

2. **New endpoints:** `projects/brain-core/src/api/routes.ts`
   - GET /post-orchestrator/status
   - GET /post-orchestrator/contracts (service contract versions)
   - GET /post-orchestrator/integrations (legacy migration readiness)
   - GET /post-orchestrator/recovery (blockers and next steps)

3. **Types:** `projects/brain-core/src/types/api.ts`
   - PostOrchestratorStatus
   - PostOrchestratorContract
   - PostOrchestratorIntegration
   - PostOrchestratorRecoveryItem

**Brain Console additions:**

1. **Client reader:** `projects/brain-console-obsidian/src/client.ts`
   - readBrainCorePostOrchestratorStatus()

2. **Dashboard snapshot:** `projects/brain-console-obsidian/src/dashboard.ts`
   - postOrchestratorStatus field
   - postOrchestratorOperational flag
   - proofly/xgrow integration status flags

3. **New section:** `projects/brain-console-obsidian/src/view.ts`
   - renderPostsSection()
   - renderPostOrchestratorStatusCard()
   - renderPlatformReadinessCard()
   - renderPublishingDisabledCard()
   - renderProoflyIntegrationCard()
   - renderXgrowIntegrationCard()
   - renderPostQueueSummaryCard()
   - renderRecoveryCard()

4. **Dashboard integration:**
   - Add "Posts" or "Post Orchestrator" tab to SECTION_TABS
   - Dispatch to renderPostsSection() when active
   - Update section tab styling if needed

5. **Styling:** `projects/brain-console-obsidian/styles.css`
   - Card styles for Post Orchestrator (reuse existing patterns)
   - Platform grid if showing platform readiness
   - Publishing disabled state styling (prominent)

**Data is static/inventory-based:**
- All values come from Brain Core adapter
- No live integration with Proofly/Xgrow yet
- Publishing always shows "disabled (approval-gated)"
- Status shows "planned" or "partial"

**Tests:**

1. **Unit tests:** `projects/brain-core/tests/post-orchestrator.test.ts`
   - POST /post-orchestrator/status returns valid structure
   - All fields present and typed correctly
   - Static data matches expectations
   - Error handling for missing data

2. **Integration tests:** Brain Console client can read status without crash

**Safety boundaries:**
- ❌ No Proofly code changes
- ❌ No Xgrow code changes
- ❌ No actual Proofly asset requests
- ❌ No actual Xgrow optimization requests
- ❌ No publishing to platforms
- ❌ No scheduler changes
- ❌ Read-only visibility only

**Exit criteria:**
- ✅ Brain Console shows "Posts" or "Post Orchestrator" section
- ✅ Proofly and Xgrow visible as "planned" or "integrating" modules
- ✅ Publishing state clearly marked "disabled (approval-gated)"
- ✅ All tests pass
- ✅ No Proofly/Xgrow code modified
- ✅ No secrets exposed
- ✅ Documentation updated (handoff section)

**Likely files changed:**
```
projects/brain-core/src/adapters/post-orchestrator.ts (new)
projects/brain-core/src/api/routes.ts (add endpoints)
projects/brain-core/src/types/api.ts (add types)
projects/brain-core/tests/post-orchestrator.test.ts (new)
projects/brain-console-obsidian/src/client.ts (add reader)
projects/brain-console-obsidian/src/dashboard.ts (add snapshot fields)
projects/brain-console-obsidian/src/view.ts (add section and cards)
projects/brain-console-obsidian/styles.css (add styles if needed)
docs/system/1779034841996-obsidian-mind-model-router-handoff.md (continuation update)
```

---

### Phase P2: Service Contract Validation (2026-05-26+)

**Objective:** Define and validate service contracts with Proofly and Xgrow. Build stubs/mocks to test request/response cycle without live integration.

**Tasks:**
- Proofly contract: AssetRequest → AssetResult (HTTP endpoint stub)
- Xgrow contract: OptimizationRequest → OptimizationResult (HTTP endpoint stub)
- Measure latency, error modes, retry scenarios
- Refine contracts based on real behavior
- Update Brain Core to support contract versioning

**Exit criteria:**
- Service contracts documented and versioned
- Stub endpoints respond correctly
- Latency measurements taken
- Error handling validated
- Contract version mismatch detected safely

---

### Phase P3: Dry-Run Post Pipeline (2026-06-02+)

**Objective:** End-to-end dry-run of post generation, asset generation, and optimization. No persistence, no publishing.

**Tasks:**
- Brain Post Orchestrator draft generation (AI-based)
- Proofly asset request via contract (fetch asset result)
- Xgrow optimization request via contract (fetch optimization result)
- Combine into preview
- Display in Brain Console
- No publishing to platforms

**Exit criteria:**
- Drafts generate successfully
- Proofly assets fetch and display
- Xgrow optimization applies to copy
- Preview shows combined result
- No errors, no side effects

---

### Phase P3: Post Orchestrator Dry-Run Planner (2026-05-26+)

**Objective:** Convert fixture PostEvent inputs into preview-only PostDraftPlan outputs.

**Tasks:**
- Event fixture registry
- Dry-run planner adapter
- Dry-run endpoint exposure
- Brain Console dry-run preview cards
- Safety verification for read-only output

**Exit criteria:**
- Event fixtures are visible
- Dry-run plans generate from fixtures
- Draft previews remain read-only
- No publishing, scheduling, or platform posting

### Phase P4: Approval-Gated Scheduling (2026-06-09+)

**Objective:** User approves post in Brain Console. Create schedule item (no publication yet).

**Tasks:**
- Approval request workflow
- PostScheduleItem creation (approval-gated)
- Scheduled list display in Brain Console
- Approval tracking and audit trail

**Exit criteria:**
- Approval gate works
- Schedule items created and visible
- Audit trail captures approvals
- No platform publishing yet

---

### Phase P5: Platform Publishing (2026-06-16+)

**Objective:** Integrate platform publishing. ONLY after explicit user approval and Playwright security review.

**Tasks:**
- Platform-specific auth management (isolated in Xgrow or separate system)
- Rate limiting and backoff logic
- Fallback and retry logic
- Platform-specific error handling
- Publishing coordination (sequencing, timeouts)

**Exit criteria:**
- Posts publish to platforms (dry-run first)
- Rate limits respected
- Errors handled gracefully
- Audit trail complete

---

### Phase P6-P10: Dual-Run, Parity, Decommission

See `docs/system/post-orchestrator-proofly-xgrow-architecture-review-2026-05-18.md` for full decommission strategy.

---

**Related documents:**
- `docs/system/post-orchestrator-proofly-xgrow-architecture-review-2026-05-18.md` (full architecture)
- `docs/system/obsidian-mind-model-router-roadmap.md` (post orchestrator roadmap)

### Phase P4: Post Draft Review Queue (2026-06-02+)

**Objective:** Allow approval-request-only review of dry-run draft plans without publishing or scheduling.

**Tasks:**
- Review queue endpoint for dry-run draft plans
- Approval request endpoint for individual review items
- Reuse existing Brain Core approval request infrastructure
- Brain Console review queue card and request button
- Safety verification for review-only semantics

**Exit criteria:**
- Review queue renders from dry-run plans
- Approval request records can be created safely
- No execution, publishing, or scheduling is introduced
- Review-only state remains explicit in UI and API

### Phase P5: Schedule Preview Queue (2026-06-02+)

**Objective:** Add approval-gated schedule preview objects derived from reviewable draft items, still without real scheduling or publishing.

**Tasks:**
- Schedule preview endpoint for event-backed review items
- Schedule preview approval-request endpoint
- Deterministic schedule windows/timezones/rationales only
- Brain Console schedule preview card and request button
- Safety verification for preview-only semantics

**Exit criteria:**
- Schedule preview queue renders from review queue items
- Approval request records can be created safely
- No scheduler jobs, publishing, or execution are introduced
- Preview-only state remains explicit in UI and API

### Phase P6: Analytics Feedback Fixtures (2026-06-02+)

**Objective:** Add read-only analytics feedback fixtures for post flows with no external analytics API calls.

**Tasks:**
- Analytics fixtures endpoint for post flows
- Static metrics and interpretation payloads
- Brain Console analytics feedback card
- Safety verification for fixture-only semantics

**Exit criteria:**
- Analytics fixtures render from Brain Core
- No external analytics API calls are introduced
- No cookies, secrets, publishing, or scheduling are introduced
- Fixture-only state remains explicit in UI and API

### Phase P7: End-to-End Pipeline Summary (2026-06-02+)

**Objective:** Combine the event → dry-run → review → schedule preview → analytics feedback chain into a single read-only pipeline summary.

**Tasks:**
- Pipeline summary endpoint for a fixed event fixture
- Compose the pipeline from existing fixture stages
- Brain Console pipeline summary card
- Safety verification for end-to-end preview-only semantics

**Exit criteria:**
- Pipeline summary renders from Brain Core
- No publishing, scheduling, or execution is introduced
- Preview-only state remains explicit in UI and API

### Phase P8: Readiness Score and Blockers (2026-06-02+)

**Objective:** Add read-only readiness scoring and blocker modeling for the pipeline.

**Tasks:**
- Readiness score endpoint for event fixtures
- Blocker model with severity and next safe steps
- Brain Console readiness / quality score card
- Safety verification for review-only semantics

**Exit criteria:**
- Readiness score renders from Brain Core
- No publishing or scheduling is introduced
- Readiness remains review-only and blocked while execution is disabled

### Phase P9: Platform Policy / Security Review Registry (2026-06-02+)

**Objective:** Add a read-only policy registry that tracks platform security posture without enabling publishing or browser automation.

**Tasks:**
- Platform policy registry endpoint for post platforms
- Security review metadata for X, GitHub, LinkedIn, Facebook, YouTube, Blog, and Internal
- Brain Console platform policy / security review card
- Safety verification for policy-only semantics

**Exit criteria:**
- Policy registry renders from Brain Core
- No cookies, Playwright, or external writes are introduced
- Publishing and scheduling remain disabled

### Phase P10: Decommission Readiness Matrix (2026-06-02+)

**Objective:** Add a read-only decommission readiness matrix for legacy standalone Proofly/Xgrow orchestration targets.

**Tasks:**
- Decommission readiness endpoint for legacy asset, growth, scheduler, publishing, and analytics targets
- Readiness gates and next safe steps for each target
- Brain Console decommission readiness matrix card
- Safety verification for decommission-only semantics

**Exit criteria:**
- Decommission readiness renders from Brain Core
- No decommission action is introduced
- No files are deleted and no legacy repos are modified
- Publishing and scheduling remain disabled

### Phase P11: Operator Guidance (2026-06-02+)

**Objective:** Add a read-only operator guidance and blocker recovery surface for Post Orchestrator.

**Tasks:**
- Operator guidance endpoint derived from pipeline, readiness, policy, decommission, review, schedule, and analytics state
- Brain Console operator guidance card
- Safety verification for guidance-only semantics

**Exit criteria:**
- Operator guidance renders from Brain Core
- No auto-fix or execution paths are introduced
- Publishing and scheduling remain disabled

### Phase P12: Manual Export Preview (2026-06-02+)

**Objective:** Add a read-only manual export/package preview for post drafts without writing files, copying to clipboard, or publishing.

**Tasks:**
- Manual export preview endpoint derived from dry-run drafts
- Brain Console manual export preview card
- Safety verification for preview-only export semantics

**Exit criteria:**
- Manual export preview renders from Brain Core
- No file writes, downloads, clipboard writes, publishing, or scheduling are introduced
- Preview-only state remains explicit in UI and API

### Phase P13: Operator Acceptance Checklist (2026-06-02+)

**Objective:** Add a read-only operator acceptance checklist for Post Orchestrator preview readiness.

**Tasks:**
- Acceptance checklist endpoint derived from existing read-only endpoints and safety surfaces
- Brain Console operator acceptance checklist card
- Safety verification for checklist-only semantics

**Exit criteria:**
- Acceptance checklist renders from Brain Core
- No execution, publishing, scheduling, file writes, or external writes are introduced
- Future-gate checks remain blocked

### Phase P14: Migration Parity Report (2026-06-02+)

**Objective:** Add a read-only migration parity report for legacy asset/growth/scheduler/publishing/analytics responsibilities.

**Tasks:**
- Migration parity report endpoint derived from current preview-only surfaces
- Brain Console migration parity report card
- Safety verification for no legacy repo changes and no decommission

**Exit criteria:**
- Migration parity report renders from Brain Core
- No legacy repos are modified
- Publishing and scheduling remain disabled

### Phase P15: Roadmap Checkpoint (2026-06-02+)

**Objective:** Add a read-only roadmap checkpoint that records completed preview phases and gates any future publishing/scheduling design behind explicit user approval.

**Tasks:**
- Roadmap checkpoint endpoint derived from completed phases P1-P14
- Brain Console roadmap checkpoint card
- Safety verification for read-only roadmap semantics

**Exit criteria:**
- Roadmap checkpoint renders from Brain Core
- Future publishing/scheduling design remains blocked behind explicit user approval
- No execution, publishing, scheduling, or decommission actions are introduced

---

## Low-Priority Feature — BrainOS Projects & Roadmaps (R1-R4)

**Priority:** LOW. Does not block Video Orchestrator, STB continuity, or Post Orchestrator production work.

**Objective:** Standardize how every repo tracks and exposes roadmap, implementation plan, phases, tasks, validation evidence, and commits. Enable BrainOS dashboard and BuildFlow to query read-only project state.

### Phase R1: Standard Definition and Dashboard Scaffold (2026-05-18)

**Objective:** Define repo-agnostic standard, create standard doc, add lightweight Projects tab scaffold.

**Tasks:**
- Define `brainos-project-roadmap-standard-2026-05-18.md` with JSON schema
- Update roadmap and implementation plan docs with feature description
- Add minimal Projects tab cards (read-only, no execution controls)
- Ensure zero production risk (read-only, no writes, no auto-commits)

**Exit criteria:**
- Standard doc committed
- Projects tab renders without errors
- Brain Console build passes
- TypeScript typecheck passes
- No breaking changes to existing tabs

### Phase R2: Repository Indexer and Brain Core API (2026-06+)

**Objective:** Build optional repo indexer and Brain Core read-only endpoints for project state queries.

**Tasks:**
- Design Brain Core `/projects` endpoint (GET, read-only, supports configured repo list)
- Create repo scanner adapter (optional repo autodiscovery, respects .brain/project-state.json)
- Add project status endpoint to routes.ts
- Write tests for indexer and endpoints

**Exit criteria:**
- Brain Core endpoints return 200 with proper structure
- Zero repo mutations or writes
- All tests pass

### Phase R3: BuildFlow Status Sync Integration (2026-07+)

**Objective:** Allow BuildFlow to query and optionally update project task status during controlled operations.

**Tasks:**
- Design BuildFlow contracts for state queries
- Wire BuildFlow agent mode to query Brain Core project endpoints
- Add structured logging of BuildFlow operations to project-state.json

**Exit criteria:**
- BuildFlow can query project state safely
- All writes are explicit and logged
- No auto-commits or hidden changes

### Phase R4: Optional Dashboard Task Controls (2026-08+)

**Objective:** Add optional dashboard controls for task/phase updates, approval-gated.

**Status:** Not started, conditional on R1-R3 completion and user approval.

**Tasks:**
- Design approval gate framework for task updates
- Add optional dashboard buttons (start task, request validation, mark complete)
- Implement approval workflow in Brain Core
- Write comprehensive tests

**Exit criteria:**
- No controls activate without explicit user approval
- All changes are logged and reversible
- Tests prove no silent mutations or auto-commits

---

**Note:** This feature is foundational but low priority. Do not execute R2-R4 until Video Orchestrator production readiness, STB continuity, and Post Orchestrator publishing are stabilized. R1 scaffold is minimal and non-blocking.

## 2026-05-18 — Preview-only Video Orchestrator checkpoint

Preview-only readiness is complete through roadmap checkpoint, operator review packet, preview completion index, preflight checklist, and risk register surfaces.

Current state:
- planning, policy, dashboard, checkpoint, and review surfaces exist
- controlled execution remains blocked
- no execution, publishing, rendering, or decommissioning paths were enabled

Next macro-phase:
- Phase 5 only after explicit operator approval of controlled execution design boundaries
