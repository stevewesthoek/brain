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

## Phase 0: Architecture Lock and Inventory (COMPLETE)

### Goal
Lock direction, document architecture, stop ProBot dashboard expansion.

### Completed Tasks
- ✅ Unified cockpit roadmap created (`obsidian-mind-model-router-roadmap.md`)
- ✅ STB migration plan created (`stb-to-video-orchestrator-migration-plan-2026-05-17.md`)
- ✅ ProBot feature disposition analyzed (`probot-to-brain-console-migration-review-2026-05-17.md`)
- ✅ Brain Console architecture documented
- ✅ Brain Core API spec drafted

### Exit Criteria Met
- ✅ Roadmap and implementation plan committed
- ✅ Says the Bible marked non-negotiable/operational
- ✅ Video Orchestrator marked canonical/future
- ✅ ProBot migration phases documented
- ✅ Decommission safeguards explicit

---

## Phase 1: Brain Core Foundation (CURRENT FOCUS)

### Goal
Create small, testable local service for machine state without becoming a dashboard.

### Tasks

#### 1.1 Create Brain Core project scaffold
**Files to create:**
```
projects/brain-core/
  package.json
  tsconfig.json
  src/
    index.ts
    api/
      server.ts
      routes.ts
      types.ts
    adapters/
      status.ts
      local-apps.ts
      sessions.ts
      skills.ts
      orchestrators.ts
      pipelines.ts
      projects.ts
      approvals.ts
      scheduler.ts
    security/
      localhost.ts
      redaction.ts
    tests/
      adapters.test.ts
      server.test.ts
  README.md
```

**Dependencies:** Express, TypeScript, tsyringe (DI), zod (validation)

**Exit criteria:**
- Package builds with `npm install && npm run build`
- TypeScript strict mode enabled
- No external dependencies except Express, zod, and testing

#### 1.2 Implement read-only endpoints (Phase 1)
**Endpoints to create:**

```typescript
// Status
GET /status → { 
  ready: boolean, 
  runtime: { brainCore: string, models: string[] },
  services: { probot: string, scheduler: string, localStorage: string }[]
}

// Local apps
GET /local-apps → { name, status, port?, logs? }[]

// Sessions (Brain Core session resumption)
GET /sessions → { id, name, date, lastStep, model }[]

// Skills (available orchestrators)
GET /skills → { name, category, status, lastRun?, queuedItems? }[]

// Orchestrators (registry of all orchestrators: video, research, design, code, etc)
GET /orchestrators → { 
  name, category, status, modules[], lastRun?, 
  queueCount?, errorCount?, nextTask?
}[]

// Pipelines (Says the Bible + Video Orchestrator)
GET /pipelines → {
  name, category, status, lastRun?, queueCount?,
  failureCount?, health, metadata
}[]

// Pipeline detail
GET /pipelines/:id → { 
  name, status, lastRun, queueCount, failureCount,
  stages[], modules[], health, estimatedNext, notes 
}

// Projects/Domains
GET /projects → { 
  name, type, status, owner, lastModified, 
  linkedPipeline?, linkedOrchestrator?
}[]

// Approvals
GET /approvals → {
  id, action, description, requested, expires, status
}[]

// Scheduler status
GET /scheduler/status → { 
  lastRun, nextRun, jobs[], health
}

GET /scheduler/jobs → {
  id, name, schedule, lastRun, lastStatus, 
  duration, enabled
}[]

// Execution reports (dry-run previews, model-router reports)
GET /execution/maintenance-previews → {
  id, type, timestamp, title, status, preview
}[]

// Runtime readiness
GET /runtime/readiness → {
  ready: boolean,
  checks: { name, status, message }[]
}
```

**Implementation rules:**
- Return JSON only (no HTML)
- Localhost-only binding (127.0.0.1:9000)
- No secrets in responses
- Graceful 503 if adapter offline
- Fast responses (<100ms for status routes)
- Type-safe with Zod validation on output

**Exit criteria:**
- All read-only endpoints implemented
- Typecheck passes
- Unit tests for each adapter (80% coverage minimum)
- No external shell execution
- localhost-only binding verified

#### 1.3 Create initial adapters
**Adapters to build:**

| Adapter | Data Source | Responsibility |
|---------|---|---|
| `status.ts` | Brain Core internal state | runtime health, version, readiness checks |
| `local-apps.ts` | ProBot app registry + logs | app status, port, restart capability |
| `sessions.ts` | Brain Core session storage | session list, resumption tracking |
| `skills.ts` | Skill index + orchestrator state | skill registry, execution status |
| `orchestrators.ts` | Orchestrator registry in `brain/` | video, research, design, code, scheduler, model-router |
| `pipelines.ts` | ProBot (STB status) + Video Orchestrator adapter | Says the Bible status, video progress, migration card |
| `projects.ts` | Mind vault + project tracking | active projects, domains, platforms |
| `approvals.ts` | Brain Core approval queue | pending decisions, deadlines |
| `scheduler.ts` | Office nightly scheduler state | job status, last run, next run |

**Exit criteria:**
- Each adapter tested independently
- Error handling for missing data sources
- Fallback responses for offline services
- Redaction helpers applied (no credentials, no secrets)

#### 1.4 Add security layer
**Files:** `src/security/localhost.ts`, `src/security/redaction.ts`

**Rules:**
- Reject all non-localhost connections
- Redact credentials, tokens, API keys from responses
- Validate response schemas with Zod before returning
- Log all requests (no PII)
- Add rate limiting (100 req/minute per origin)

**Exit criteria:**
- Localhost-only binding tested
- Redaction applied to all outputs
- Security tests pass

#### 1.5 Add tests
**Test scope:**
```
tests/
  adapters/
    local-apps.test.ts
    orchestrators.test.ts
    pipelines.test.ts
    projects.test.ts
  api/
    server.test.ts
    routes.test.ts
    localhost.test.ts
  fixtures/
    mock-probot-status.json
    mock-scheduler-state.json
```

**Coverage:**
- Happy path for each endpoint
- Error cases (service offline, malformed data)
- Response schema validation
- Redaction logic
- Localhost binding

**Exit criteria:**
- npm test passes
- 80% coverage minimum
- No skipped tests

---

## Phase 2: Brain Core Deployment and Integration (2-3 weeks)

### Goal
Deploy Brain Core locally alongside ProBot. Verify all read-only endpoints work.

### Tasks

#### 2.1 Start Brain Core as supervised service
**Setup:**
- Start script: `tools/scripts/start-brain-core.sh`
- Supervisor integration (LaunchAgent on macOS)
- Automatic restart on failure
- Local logging to `~/.brain/logs/`

**Exit criteria:**
- `brain-core` service starts automatically
- Listens on 127.0.0.1:9000
- Health check: `curl http://localhost:9000/status`
- Logs show no errors

#### 2.2 Create Brain Core adapter for Says the Bible
**File:** `projects/brain-core/src/adapters/pipelines/stb.ts`

**Responsibility:**
- Read ProBot STB status (read-only: no mutations)
- Expose: name, status, lastRunAt, queueCount, failureCount, health, platforms[]
- Provide: operational status card data for Brain Console

**Data model:**
```typescript
interface STBPipelineStatus {
  id: "stb-daily-pipeline";
  name: "Says the Bible Daily Pipeline";
  category: "operational";
  status: "active" | "paused" | "error";
  health: "ok" | "warning" | "error";
  lastRunAt?: Date;
  lastRunDuration?: number;
  queueCount: number;
  failureCount: number;
  nextItemTopic?: string;
  currentProcessing?: {
    topic: string;
    stage: string;
    progress: 0-100;
  };
  platforms: Array<{
    name: "youtube" | "pinterest" | "facebook";
    lastPublished?: Date;
    failureCount: number;
  }>;
}
```

**Exit criteria:**
- Adapter reads ProBot STB status
- Schema matches above type
- Returns valid JSON
- Handles ProBot offline gracefully

#### 2.3 Create Brain Core adapter for Video Orchestrator
**File:** `projects/brain-core/src/adapters/pipelines/video-orchestrator.ts`

**Responsibility:**
- Read video orchestrator progress
- Expose: module count, parity status, migration progress, next task
- Provide: migration card data for Brain Console

**Data model:**
```typescript
interface VideoOrchestratorStatus {
  id: "video-orchestrator";
  name: "Video Orchestrator (Future Canonical Architecture)";
  category: "canonical-future";
  status: "designing" | "partial" | "validating" | "ready" | "production";
  health: "unknown" | "ok" | "warning";
  migrationProgress: 0-100;
  modulesImplemented: number; // e.g., 3/12
  parityStatus: "mapping" | "partial" | "dual-run" | "ready" | "complete";
  
  modules: Array<{
    name: string;
    stbConcept: string;
    status: "planned" | "partial" | "implemented" | "legacy";
    parityStatus?: "not-started" | "partial" | "complete";
    nextTask?: string;
  }>;
  
  linkedLegacyPipeline: "stb-daily-pipeline";
  decommissionBlocked: true; // until parity complete
  estimatedCompletion?: Date;
  nextSafeTask?: string;
}
```

**Exit criteria:**
- Adapter reads video orchestrator state
- Schema matches above type
- Handles missing state gracefully (fresh deployment)
- Provides accurate migration progress

#### 2.4 Create migration card adapter
**File:** `projects/brain-core/src/adapters/pipelines/stb-video-migration.ts`

**Responsibility:**
- Aggregate STB + Video Orchestrator status
- Calculate migration metrics
- Provide dashboard migration card

**Data model:**
```typescript
interface MigrationCard {
  legacyPipeline: "says-the-bible";
  canonicalFuture: "video-orchestrator";
  status: "planning" | "mapping" | "infrastructure" | "building" | "validating" | "cutover" | "complete";
  progress: { completed: number, total: number };
  progressPercent: 0-100;
  
  nextPhase: {
    phase: number;
    name: string;
    status: string;
    nextTask: string;
  };
  
  safeguards: {
    legacyOperational: boolean; // STB still running, no production risk
    dualVisibility: boolean; // both shown in dashboard
    dualRunValidation: boolean; // comparing outputs
    userApprovalRequired: boolean; // before any switch
  };
}
```

**Exit criteria:**
- Card accurately reflects migration state
- Status matches roadmap phases
- Safeguards correctly enforced
- Dashboard can display this data

#### 2.5 Add Health Check endpoint
**Endpoint:** `GET /runtime/health`

**Response:**
```json
{
  "status": "ok",
  "checks": [
    { "name": "ProBot connection", "status": "ok", "latency": 45 },
    { "name": "STB status adapter", "status": "ok", "lastUpdate": "2026-05-17T14:23:00Z" },
    { "name": "Video orchestrator adapter", "status": "ok", "lastUpdate": "2026-05-17T14:23:00Z" },
    { "name": "Scheduler status", "status": "ok", "nextRun": "2026-05-18T02:00:00Z" },
    { "name": "Model-router health", "status": "warning", "message": "dry-run only" }
  ],
  "readyForProduction": false,
  "blockers": ["STB-to-video parity not complete"]
}
```

**Exit criteria:**
- All adapters report status
- Blockers detected (e.g., decommission safeguards)
- Dashboard can use this for readiness gates

---

## Phase 2A: Brain Console Obsidian Plugin MVP (2 weeks)

### Goal
Render Brain Core data in Obsidian with 6 core status cards (read-only MVP).

### Tasks

#### 2A.1 Create Brain Console plugin skeleton
**File structure:**
```
projects/brain-console-obsidian/
  esbuild.config.mjs
  manifest.json
  package.json
  tsconfig.json
  src/
    main.ts
    view.ts
    client.ts
    styles.css
    components/
      cards.ts
      buttons.ts
      spinner.ts
    types.ts
  tests/
    view.test.ts
```

**Dependencies:** obsidian, esbuild, TypeScript

**Exit criteria:**
- Plugin loads in Obsidian without errors
- esbuild bundles to single entry point
- No TypeErrors

#### 2A.2 Create Brain Core HTTP client
**File:** `projects/brain-console-obsidian/src/client.ts`

**Responsibility:**
- Use Obsidian `requestUrl` API (IPC-based HTTP)
- Fallback to localhost/127.0.0.1:9000
- Exponential backoff for retries
- Detailed error diagnostics

**Exit criteria:**
- Can fetch all Brain Core read-only endpoints
- Handles localhost offline gracefully
- Provides user-friendly error messages
- No browser fetch API

#### 2A.3 Render 6 core status cards
**Cards to build:**

1. **Wiki Health Card** — model-router lint results
   - OK / warnings / errors count
   - Latest lint report timestamp
   - Action: "Run dry-run"

2. **Brain Core Card** — runtime status
   - Readiness status
   - Health checks (Pro Box, STB, scheduler, etc.)
   - Blockers (if any)

3. **Local Apps Card** — running services
   - App status pills (running/idle/error)
   - Port (if available)
   - Action: start/stop (disabled, "planned for Phase 4")

4. **Says the Bible Card** — operational pipeline status
   - Status (active/paused/error)
   - Last run time + duration
   - Queue count, failure count
   - Current processing (if any)
   - Platforms (YouTube, Pinterest, Facebook status)

5. **Video Orchestrator Card** — future canonical architecture
   - Modules implemented (3/12)
   - Migration progress %
   - Parity status
   - Next task
   - Decommission status (blocked)

6. **Migration Card** — STB → Video progress
   - Legacy operational status
   - Dual visibility badge
   - Next phase name + task
   - Safeguards enforced

**Implementation rules:**
- Use dark theme (#0a0e27 background, #ff6b3d accents)
- Monospaced system data
- Progressive disclosure (hover for details)
- Status indicators (pills, progress bars)
- No user input (read-only MVP)

**Exit criteria:**
- All 6 cards render without errors
- Data refreshes on demand
- Cards display correctly with mock data
- Dark theme applied

#### 2A.4 Add action row buttons (read-only for MVP)
**Buttons:**

1. **Refresh** — Poll all Brain Core endpoints
2. **Open Mind** — Navigate to mind vault
3. **View Logs** — Show Brain Core logs
4. **Diagnostics** — Show connection details

**Exit criteria:**
- All buttons functional
- Refresh polls Brain Core successfully
- No mutations (read-only)

#### 2A.5 Add tests
**Test scope:**
```
tests/
  view.test.ts (card rendering)
  client.test.ts (HTTP client)
  fixtures/mock-*.json (mock Brain Core responses)
```

**Coverage:**
- Card rendering with mock data
- Error handling (offline Brain Core)
- Refresh functionality
- Type safety

**Exit criteria:**
- npm test passes
- 80% coverage

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

## Phase 3: Projects/Domains Registry (1-2 weeks)

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

## Phase 4: Approvals Framework (1-2 weeks)

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
