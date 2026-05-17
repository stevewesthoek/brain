# Obsidian Mind + Model Router Roadmap

**Date:** 2026-05-16
**Status:** accepted direction for planning
**Related:** `docs/system/obsidian-brain-core-roadmap.md`

## Decision

The `mind` repo will become an unnumbered, Obsidian-first, model-router-maintained personal operating memory.

The `brain` repo will own the executable infrastructure: Brain Core API, model-router implementation, scheduler integration, skills, orchestrators, and machine-level automations.

Obsidian remains the only primary human dashboard. Brain Core exposes machine and scheduler state. The model router continuously keeps `mind` small, coherent, useful, and fast.

## Unified Orchestrator Command Center Roadmap

**Mission:** Brain Console is the single unified cockpit for all system intelligence, machine state, pipelines, approvals, and operational decisions. ProBot is legacy/secondary. Says the Bible operational pipeline remains non-breakable. Video Orchestrator is the future canonical architecture.

### Non-Negotiables

1. **Says the Bible remains operational** — Daily production pipeline. No code changes until full video orchestrator parity. Zero production downtime.
2. **ProBot is legacy, not replaced** — Brain Console migrates valuable ProBot features through Brain Core APIs. ProBot remains secondary until feature parity complete.
3. **Video Orchestrator is canonical future** — Rebuilt from STB modules (not blind copy), cleaner design, supports multiple projects/platforms. No decommissioning of STB until video is production-ready.
4. **Dual visibility during migration** — Both STB (legacy/operational) and video orchestrator (future/partial) visible in dashboard simultaneously with migration card tracking progress.
5. **No decommissioning without approval** — Requires: Brain Core API equivalent, Brain Console section deployed, tests passing, dual-run validation complete, explicit user approval.
6. **All actions approval-gated** — Read-only dashboard by default. App/orchestrator/system controls go through Brain Core approval requests. No direct shell execution from plugin.
7. **Brain Core is API boundary** — Typed, local-only HTTP layer (127.0.0.1:4877). All dashboard data flows through Brain Core. No direct vault mutations from Obsidian plugin. Brain Core already exists and is operational.

### STB → Video Orchestrator Architecture

**Current state:**
- Says the Bible: active daily pipeline (research → script → assets → video → publish across YouTube, Pinterest, Facebook)
- Video Orchestrator: design-only ProBot concepts (no live execution yet)
- Brain Console: emerging dashboard (no STB/video visibility yet)

**Target state:**
- Says the Bible: visible as "legacy/operational" status in Brain Console Pipelines tab
- Video Orchestrator: visible as "future/canonical" progress card with module completion %, parity status, dual-run validation
- Migration card: shows STB→video module mapping, completion timeline, next safe task

**Module rebuild strategy (not blind copy):**

| STB Concept | Video Orchestrator Target | Status | Validation |
|---|---|---|---|
| Research/scripture intake | bible-research orchestrator | not-started | Compare passage selection |
| Outline/structure | script-generation stage | not-started | Compare outline equivalence |
| Script generation | script-generation stage | not-started | Compare script quality |
| Asset generation | asset-generation stage | not-started | Compare asset metadata |
| Thumbnail design | design orchestrator (planned) | blocked | Compare thumbnail output |
| Video assembly | video-assembly stage | not-started | Compare bitrate/quality |
| Metadata enrichment | metadata-enrichment stage | not-started | Compare SEO metadata |
| YouTube publishing | platform-publish stage | not-started | Compare published video |
| Pinterest publishing | platform-publish stage | not-started | Compare pin appearance |
| Facebook publishing | platform-publish stage | not-started | Compare post formatting |
| Approval/review | approval-gate stage | not-started | Compare approval flow |
| Archive/logging | archive-logging stage | not-started | Compare audit trail |

**Dual-run validation:**
- Build video module alongside STB
- Run both on identical test input
- Compare outputs (correctness, quality, performance, compatibility, safety)
- No production switch until parity achieved
- Rollback capability preserved until decommission approval

### ProBot Migration to Brain Console

**Current state:** ProBot web dashboard with local app status, orchestrator registry, session history, domain/project overview.

**Target state:** All valuable ProBot features migrate through Brain Core APIs into Brain Console. ProBot remains secondary reference.

**Feature disposition:**
- KEEP: Local app status, session history, domain/project overview
- REDESIGN: App start/stop, orchestrator run (approval-gated)
- NEW API: Orchestrator registry, domain/project registry
- DROP: Credentials, OAuth, Stripe billing

**Phased rollout:**
- Phase 2A: Local apps section + Brain Core endpoint
- Phase 2B: Session history cards
- Phase 3: Orchestrator registry + Pipelines section
- Phase 4: Domain/project registry + Projects section
- Phase 5: Approval-gated actions framework
- Phase 6: Visual refinement + ProBot deprecation

### Brain Core Infrastructure (Current State)

**Brain Core already exists and is operational:**
- ✅ Located at: `projects/brain-core/`
- ✅ Port: 127.0.0.1:4877 (configurable via BRAIN_CORE_PORT env var)
- ✅ Technology: Node.js built-in http module (no external frameworks)
- ✅ Connected to Brain Console: Obsidian plugin uses requestUrl API to call Brain Core
- ✅ Existing adapters: status, local-apps, sessions, skills
- ✅ Existing endpoints: GET /status, GET /local-apps, GET /sessions, GET /skills, GET /runtime/readiness, GET /execution/maintenance-previews, [others]
- ✅ Security: localhost-only binding, credential redaction, no external internet

**Next implementation extends Brain Core, not creates it:**
- Phase 1: Inventory existing state and identify endpoint gaps
- Phase 2: Add new read-only adapters and endpoints for orchestrators, pipelines, projects, platforms
- Phase 3: Brain Console consumes new endpoints and displays unified cockpit

### Brain Console Cockpit Architecture

**Eight dashboard sections:**
1. **Overview** — Health status, last run, warnings, next safe action
2. **Apps** — Local app status (running/idle/error), start/stop controls (approval-gated)
3. **Orchestrators** — Skill registry (6 planned), video, research, design, code, scheduler
4. **Pipelines** — Says the Bible (legacy/operational), video orchestrator (future/partial), migration progress card
5. **Projects/Domains** — Active projects, platforms, queues, accounts
6. **Approvals** — Pending action requests, decision tracking
7. **Research** — Active queries, sources, captures
8. **System** — Brain Core runtime, scheduler jobs, maintenance previews, model-router health

**Data sources:**
- Brain Core `/status`, `/orchestrators`, `/pipelines`, `/projects`, `/approvals`, `/runtime/reports`, `/scheduler/jobs`, `/execution/maintenance-previews`
- Says the Bible operational status (read-only ProBot integration)
- Video orchestrator progress (Brain Core adapter)
- Model-router maintenance insights (wiki health, lint status, proposed actions)

### Implementation Timeline

| Phase | Deliverable | Duration | Dependencies |
|---|---|---|---|
| 0 | Roadmap + architecture docs | 1 week | None |
| 1 | Brain Core API design (orchestrators, pipelines, projects, approvals, status) | 1-2 weeks | Roadmap |
| 2A | Local apps Brain Core endpoint + Brain Console section | 1 week | API design |
| 2B | Session history cards polish | 1 week | Phase 2A |
| 3 | Orchestrator registry API + Brain Console Orchestrators section | 1-2 weeks | Phase 2B |
| 4 | Domain/project registry API + Brain Console Projects section | 1-2 weeks | Phase 3 |
| 5 | Approval-gated actions framework (app start/stop, orchestrator run) | 2-3 weeks | Phase 4 |
| 6 | Visual refinement + ProBot → Brain Console transition + ProBot deprecation announcement | 1-2 weeks | Phase 5 |
| 7 | STB operational status adapter (Brain Core read-only) | 1 week | Phase 2A (established pattern) |
| 8 | Video orchestrator status adapter + migration card | 1 week | Phase 7 |
| 9 | Build + validate first video module (research/intake) + dual-run tests | 2-3 weeks | Phase 8 |
| 10 | Build remaining modules (script, assets, design, assembly, metadata, publishing, approval, archive) | 2-4 months | Phase 9 (iterative) |
| 11 | Integration testing + dual-run validation all modules | 2-4 weeks | Phase 10 |
| 12 | User approval + gradual cutover (YouTube → Pinterest → Facebook) | 3-4 weeks | Phase 11 |
| 13 | Decommission STB (archive code, update docs) | 1 week | Phase 12 success |

**Total estimate:** 5-8 months (depends on design orchestrator availability and testing speed)

### Decommission Safeguards

Nothing is deleted or disabled until ALL of these conditions are met:

1. ✅ Brain Core API equivalent exists and is tested
2. ✅ Brain Console section displays the replacement feature
3. ✅ Tests pass for both Brain Core and Brain Console
4. ✅ Dual-run validation shows parity (correctness, quality, performance, safety)
5. ✅ User explicitly approves the switch
6. ✅ Code is archived (not deleted)
7. ✅ Documentation is updated
8. ✅ Rollback capability is preserved

**Application:**
- ProBot features → decommissioned only after Brain Console parity + user approval
- Says the Bible → never decommissioned; archived after video orchestrator reaches production parity
- Legacy STB code → archived, not deleted, after cutover success

### Orchestrator Skills (Future)

Six orchestrators planned for Brain Console:
1. **Model Router** — vault maintenance, compilation, memory loops
2. **Video Orchestrator** — research, script, assets, design, assembly, metadata, publishing
3. **Research Orchestrator** — web search, source synthesis, knowledge compilation
4. **Design Orchestrator** — image generation, thumbnail design, visual asset creation
5. **Code Orchestrator** — codebase comprehension, refactoring, testing, shipping
6. **Bible Research Orchestrator** — scripture research, theological analysis, passage synthesis

All orchestrators expose read-only status through Brain Core. Execution requests go through approval layer.

### Success Criteria

- ✅ Brain Console is the single operational cockpit for all system intelligence
- ✅ ProBot is acknowledged as legacy; migration plan is tracked and transparent
- ✅ Says the Bible remains operational throughout with zero production downtime
- ✅ Video orchestrator is built alongside STB (not replacement), with dual-run validation
- ✅ Each STB module successfully rebuilt into video orchestrator equivalent
- ✅ User explicitly approves production switch before cutover
- ✅ Migration progress visible in Brain Console dashboard

## Post Orchestrator / Proofly / Xgrow Consolidation Roadmap

**Strategic Direction:** Brain owns canonical post orchestration. Proofly and Xgrow remain operational as specialized modules (social proof assets, growth optimization) but no longer own duplicate scheduling/publishing/approval/analytics systems.

### Current State

- **Proofly**: Independent social proof product surface with scheduling/publishing logic
- **Xgrow**: Independent growth optimization system with posting automation and Playwright
- **Brain**: Emerging orchestration engine (scheduler, approvals, reports, dashboard)
- **Problem**: Three separate orchestration systems = inconsistent approval gates, conflicting schedules, fragmented audit trails, impossible to see unified post lifecycle

### Target Architecture

**Brain Post Orchestrator:**
- Event ingestion (GitHub, product events, video renders, blogs, manual)
- Workflow sequencing (draft → asset → optimize → approve → schedule → publish)
- Canonical scheduler (not Xgrow, not Proofly)
- Approval gates and audit trail
- Publishing coordination (rate limiting, fallbacks, error handling)
- Analytics feedback loop
- Dashboard visibility

**Proofly (module, not orchestrator):**
- Social proof / product asset generation only
- Branded screenshots, milestone cards, MRR visuals, achievement visuals
- Asset rendering templates
- Branded UI/export

**Xgrow (module, not orchestrator):**
- Growth strategy and optimization logic only
- Hook/copy analysis, virality scoring, timing recommendations
- Audience segmentation, engagement prediction
- Analytics interpretation and feedback

### Non-Negotiables for This Consolidation

1. **No physical repo merge yet** — Keep Proofly and Xgrow separate. Use service contracts. Prove boundaries first.
2. **No decommissioning Proofly or Xgrow** — Both remain operational. Only decommission duplicate orchestration after parity.
3. **No breaking changes to Proofly/Xgrow** — They adapt via contracts (HTTP API calls). Existing APIs unchanged.
4. **Preserve all existing functionality** — Until Brain Post Orchestrator proves equivalent capability.
5. **Dual-run validation required** — Both systems run in parallel. Outputs compared. Only after validation can old system be decommissioned.
6. **Publishing remains disabled initially** — Approval-gated, no Playwright posting until security review complete.

### Consolidation Phases

**Phase 0 — Preserve Current Systems (CURRENT)**
- ✅ Proofly operational as-is
- ✅ Xgrow operational as-is
- ✅ No repo merge
- ✅ No deletion
- ✅ Architecture documented (see `post-orchestrator-proofly-xgrow-architecture-review-2026-05-18.md`)

**Phase 1 — Inventory and Boundary Mapping**
- Read Proofly code: product surface, asset logic, scheduler/publishing logic
- Read Xgrow code: optimization logic, posting automation, scheduler/publishing logic
- Identify what stays (Proofly visual templates, Xgrow algorithms) vs what moves (orchestration)
- Document service boundaries

**Phase 2 — Service Contract Design**
- PostEvent, PostDraft, ProoflyAssetRequest/Result, XgrowOptimizationRequest/Result, PostScheduleItem, PostAnalyticsResult
- HTTP API contracts defined
- Latency, error modes, retry logic specified

**Phase 3 — Brain Post Orchestrator Read-Only Registry (NEXT — See Phase P1 in implementation plan)**
- Brain Core endpoints: `/post-orchestrator/status`, `/post-orchestrator/contracts`, `/post-orchestrator/integrations`, `/post-orchestrator/recovery`
- Brain Console "Posts" or "Post Orchestrator" section
- Static data: "planned/partial", integrations marked as "planning"
- Publishing clearly marked "disabled (approval-gated)"
- No code changes to Proofly/Xgrow
- No execution

**Phase 4 — Brain Console Post Orchestrator Dashboard**
- Post queue preview
- Asset pipeline preview
- Optimization preview
- Approval readiness status
- Recovery/blockers

**Phase 5 — Dry-Run Post Pipeline**
- Generate draft preview only
- Request Proofly asset preview (via contract, no persistence)
- Request Xgrow optimization preview (via contract, no persistence)
- No publishing

**Phase 6 — Approval-Gated Scheduling**
- Create schedule item only after approval
- No platform publishing yet
- Scheduled list visible in Brain Console

**Phase 7 — Platform Publishing Integration**
- ONLY after explicit approval policy review
- ONLY after Playwright security review
- ONLY after dry-run validation
- Integrate platform delivery with rate limiting and fallback

**Phase 8 — Analytics Feedback Loop**
- Read-only analytics import from platforms
- Xgrow optimization feedback
- Performance tracking in Brain Console

**Phase 9 — Dual-Run and Parity**
- Compare old Proofly/Xgrow orchestration vs Brain Post Orchestrator
- Validate quality, reliability, audit trails
- Measure performance, error rates, user satisfaction

**Phase 10 — Decommission Duplicate Orchestration**
- ONLY with explicit user approval
- Keep product surfaces (Proofly UI, Xgrow intelligence) where useful
- Archive orchestration code from old systems
- Update documentation

### Decommission Gates

Decommission old Proofly/Xgrow orchestration ONLY when ALL of:

1. ✅ Brain Post Orchestrator has equivalent event ingestion, drafting, scheduling, publishing, analytics
2. ✅ Service contracts proven (Proofly responds, Xgrow responds, latency acceptable, errors handled)
3. ✅ Brain Console shows full post pipeline end-to-end
4. ✅ Approval workflow is visible and audit trail is captured
5. ✅ Dual-run outputs are compared and validated (same posts, same timing, same metrics)
6. ✅ User explicitly approves decommission in writing
7. ✅ Rollback plan is documented and tested
8. ✅ No active posts affected by the migration

### Timeline

| Phase | Deliverable | Duration | Status |
|---|---|---|---|
| 0 | Architecture review + roadmap expansion | 1 week | CURRENT (2026-05-18) |
| 1 | Inventory Proofly/Xgrow orchestration logic | 1-2 weeks | NEXT |
| 2 | Service contract design | 1 week | After Phase 1 |
| 3 | Brain Post Orchestrator read-only status scaffold | 1-2 weeks | After Phase 2 |
| 4 | Brain Console Post Orchestrator section | 1 week | After Phase 3 |
| 5 | Dry-run post pipeline (preview-only) | 2-3 weeks | After Phase 4 |
| 6 | Approval-gated scheduling | 1-2 weeks | After Phase 5 |
| 7 | Platform publishing (after security review) | 2-3 weeks | After Phase 6 |
| 8 | Analytics feedback loop | 1-2 weeks | After Phase 7 |
| 9 | Dual-run validation | 2-4 weeks | After Phase 8 |
| 10 | Decommission (after explicit approval) | 1-2 weeks | After Phase 9 |

**Total estimate:** 4-8 months (depends on contract validation speed and dual-run results)

### Related Documents

- `docs/system/post-orchestrator-proofly-xgrow-architecture-review-2026-05-18.md` — Full architecture review and service contracts
- `docs/system/unified-orchestrator-command-center-implementation-plan-2026-05-17.md` — Brain implementation phases (includes Post Orchestrator P1 as next slice)
- ✅ All decommission safeguards are enforced
- ✅ Rollback capability preserved until decommission approval

## Obsidian Command Center Dashboard

The Brain Console plugin provides a polished black-box Obsidian dashboard that replaces ad-hoc browsing of raw Markdown files.

**Visual direction:** dark gray-black cockpit (#0a0e27), monospaced system data, warm red-orange accents (#ff6b3d), sparse card layout, progressive disclosure.

**Dashboard cards:**
- Wiki Health: model-router lint status and error/warning counts
- Maintenance Previews: proposed maintenance queue from model-router
- Approvals: pending approval requests from Brain Core
- Scheduler Status: nightly job queue and last-run health
- Brain Core: runtime/execution status and readiness gates
- Next Safe Action: recommended action from Brain Core/model-router
- (optional) Captures: today's saved notes
- (optional) Latest Preview: most recent maintenance preview artifact

**Action row:**
- Refresh (poll all endpoints)
- Request Dry Run (trigger model-router preview)
- View Latest (inspect latest artifact/preview)
- Open Mind (navigate to mind vault in Obsidian)
- Open Wiki Log (jump to wiki/log.md)

**Safety:** all endpoints are read-only; all action buttons request approval or fire request-only signals; no Mind mutations; plugin never writes Obsidian settings.

**Data sources:** Brain Core `/status`, `/runtime/reports`, `/execution/maintenance-previews`, `/approvals`, `/scheduler/jobs`.

## Current Status

- Report-only model-router dry-run and Brain Core preview/status surfaces are complete.
- Preview-only wiki-health linting is now available in dry-run reports.
- `wiki/log.md` exists as the append-only maintenance ledger for Mind.
- Write/apply behavior for Mind remains blocked pending the approved policy and tests.
- Legacy numbered-folder archival remains blocked until a separate validated cleanup phase.
- Obsidian Command Center dashboard specification is complete; implementation underway.

## Final Mental Model

```text
Obsidian = human cockpit
mind     = personal memory, live work, compiled wiki, sources, archive
brain    = machine intelligence, model router, Brain Core API, scheduler, skills
Brain Core API = safe machine and scheduler boundary
Model Router = AI steward for mind + brain workflows
Save-to-Mind = official capture ingress
Office Nightly Scheduler = automatic maintenance lane
```

## Target `mind` Structure

Folder names are intentionally unnumbered. Visual ordering in Obsidian should use the Manual Sorting / Custom Sort plugin rather than numeric prefixes.

```text
mind/
  HOME.md
  TODAY.md
  README.md
  AGENTS.md

  router/
    current.md
    map.md
    rules.md
    taxonomy.md
    maintenance.md
    model-router.md

  capture/
    inbox/
    daily/
    failed/

  live/
    dashboard.md
    tasks.md
    projects.md
    workflows.md
    decisions.md

  wiki/
    index.md
    people.md
    organisations.md
    business.md
    faith.md
    family.md
    health.md
    finance.md
    content.md
    ai.md
    tools.md

  sources/
    index.md
    web/
    books/
    papers/
    transcripts/
    files/

  archive/
    index.md
    completed/
    old/
```

## Manual Sort Decision

Use Option B: clean folder names plus a manual sorting Obsidian plugin.

Rules:

- Do not reintroduce numeric prefixes just for sorting.
- The human dashboard is `HOME.md`; folder order is a convenience, not architecture.
- If the manual sorting plugin is unavailable, Obsidian remains usable through `HOME.md` and links.

## Save-to-Mind Direction

Save-to-Mind remains permanent.

Current state:

```text
ChatGPT/local shortcut -> n8n /webhook/mind-inbox -> Gemini -> mind/01-inbox/
```

Target state:

```text
ChatGPT/local shortcut -> n8n /webhook/mind-inbox -> Gemini -> mind/capture/inbox/
```

Keep the public webhook path `/mind-inbox` for compatibility. Change the internal target path after the new folder structure and router contract exist.

Failure buffer target:

```text
mind/capture/failed/
```

## Model Router Placement

The model-router implementation belongs in `brain`, because it is executable infrastructure.

Target location:

```text
brain/projects/model-router/
```

The `mind/router/` folder contains the vault contract consumed by the model router, not the implementation.

```text
mind/router/current.md      short-term context
mind/router/map.md          retrieval map
mind/router/rules.md        write and safety rules
mind/router/taxonomy.md     allowed note types, domains, tags
mind/router/maintenance.md  loop definitions and thresholds
mind/router/model-router.md human-readable contract
```

## Scheduler Direction

The existing Office nightly scheduler is the right execution lane for automatic vault maintenance.

The scheduler should run these model-router jobs:

1. Compile loop — captures/sources into wiki.
2. Memory loop — promote important facts, refresh current context, expire stale short-term memory.
3. Hygiene loop — deduplicate, prune, split oversized files, detect stale captures/tasks.
4. Drift/error loop — verify folder contract, schemas, broken links, Brain Core availability, Save-to-Mind output path, stale scheduler state.

Brain Core should expose scheduler state and safe controls:

```text
GET  /scheduler/status
GET  /scheduler/latest-run
GET  /scheduler/jobs
POST /scheduler/jobs/:id/request-run
```

Mutation endpoints must remain approval-aware and local-only.

## Model-Agnostic Router Policy

The model router is the LLM interface from the user's perspective. Claude, Codex, Gemini, and local models are interchangeable workers beneath it.

Default division of labor:

```text
local/small model  -> classify, tag, lint, dedupe, simple summaries
Gemini Flash       -> bulk preprocessing and large-context compression
Claude Haiku       -> routine vault maintenance and simple writing
Claude Sonnet      -> synthesis, strategy, architecture, multi-file reasoning
Claude Opus        -> high-risk decisions and final architecture review
Codex              -> repo edits, code changes, validation
local multimodal   -> private/local media processing where available
```

## Anti-Clutter Rules

Hard limits should prevent the system from becoming slow or bloated:

```text
router/current.md      max 150 lines
TODAY.md               max 200 lines
live/tasks.md          max 300 lines
live/projects.md       max 250 lines
wiki/*.md              target max 500 lines
capture/inbox/         no files older than 7 days
capture/failed/        no files older than 3 days without retry/review
```

When a file exceeds limits, the model router must summarize, split, archive, or compile it.

## Expansion Rule

Every new thing follows one pipeline:

```text
capture -> classify -> route -> compile -> dashboard -> maintain
```

New knowledge:

```text
Save-to-Mind -> capture/inbox -> model router -> wiki/sources/live/archive
```

New skill:

```text
brain/ai/skills -> skill index -> Brain Core skill adapter -> mind/live/workflows.md
```

New orchestrator:

```text
brain or external repo -> Brain Core adapter -> mind/live/workflows.md -> Obsidian dashboard card
```

New project:

```text
capture or user request -> live/projects.md -> live/tasks.md -> wiki if durable
```

## Agentic OS Layer (Brain-Native)

**Mission:** Build a lightweight, approval-gated agent orchestration layer inside Brain Core + Brain Console. Persistent agent state, skill registry, run tracking, and learning proposals. No autonomous writes. All state mutations require human approval.

### Core Principles

1. **Brain Core owns agent state** — Agents (STB, video, research, design, code, Bible research, model-router) are registered entities with persistent runs, plans, roles, and event logs. All state lives in Brain Core, not Mind.
2. **Claude Code/Codex are external executors** — These are third-party agentic tools. Brain does not wrap them; Brain consumes their output and logs runs. Model-router, video orchestrator, and other agents invoke them as needed.
3. **Skills are reusable capabilities, not the OS** — Skills are tagged, versioned, discoverable instructions (code, design, research, system). They are NOT the operating system layer. Skills are how agents do work; the OS is how agents are orchestrated, approved, and learned from.
4. **Model-router is one registered agent** — Not the container for all agents. Model-router is a specialized agent inside the OS responsible for vault maintenance. It has roles (compiler, memory curator, linker), runs, and learning proposals like any other agent.
5. **Approval-gated mutations only** — Agent plans, runs, and memory updates are read-only until approved. No autonomous writes to Mind, no autonomous skill installations, no autonomous platform actions.
6. **Brain Console Agent View required** — New Brain Console section for active runs, queue, plans, blockers, approvals, learning proposals. User sees all agent activity in one place.

### Core Entities (TypeScript)

Full specifications in: `docs/system/agentic-os-external-repo-review-2026-05-17.md`

```typescript
// Agent roles: persistent identities with permissions
interface AgentRole {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  permissions: {
    canRead: string[];     // paths/APIs
    canWrite: string[];    // paths/APIs (approval-gated)
    canExecute: string[];  // skills/orchestrators
  };
  approvalRequired: boolean;
  metadata: Record<string, unknown>;
}

// Skills: versioned, discoverable capabilities
interface AgentSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  category: "code" | "design" | "research" | "content" | "system" | "orchestrator";
  inputs: Record<string, { type: string; description: string }>;
  outputs: Record<string, { type: string; description: string }>;
  dependencies: string[];
  approvalRequired: boolean;
  status: "ready" | "beta" | "deprecated" | "archived";
}

// Plans: sequenced skill execution with dependencies
interface AgentPlan {
  id: string;
  agentId: string;
  title: string;
  description: string;
  steps: Array<{
    sequence: number;
    skillId: string;
    inputs: Record<string, unknown>;
    dependencies: number[];
    approvalRequired: boolean;
  }>;
  estimatedDuration?: number;
  status: "proposed" | "approved" | "executing" | "completed" | "failed";
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// Runs: execution state and step tracking
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
    startedAt?: Date;
    completedAt?: Date;
  }>;
  blockers?: string[];
  approvalsPending?: string[];
}

// Events: audit trail for observability
interface AgentEvent {
  id: string;
  timestamp: Date;
  agentId: string;
  runId?: string;
  type: "started" | "step_completed" | "blocked" | "approval_requested" | "approval_granted" | "failed" | "completed";
  message: string;
  metadata: Record<string, unknown>;
}

// Memory updates: learning proposals and approved facts
interface AgentMemoryUpdate {
  id: string;
  agentId: string;
  timestamp: Date;
  type: "learning" | "observation" | "capability" | "constraint";
  description: string;
  source: string;
  approvalStatus: "proposed" | "approved" | "rejected";
  approvedAt?: Date;
  approvedBy?: string;
  targetPath?: string;  // where in mind/ it goes
}

// Approvals: decision tracking
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

// Handoffs: orchestration between agents
interface AgentHandoff {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  timestamp: Date;
  context: {
    currentRunId: string;
    step: number;
    state: Record<string, unknown>;
    reasonForHandoff: string;
  };
  status: "proposed" | "accepted" | "rejected";
}
```

### Brain Core New Endpoints

**Phase 1 (Read-Only, Brain Core MVP):**
```typescript
GET  /agents               → AgentRole[]
GET  /agents/:id           → AgentRole + recent runs
GET  /agent-skills         → AgentSkill[]
GET  /agent-skills/:id     → AgentSkill detail
GET  /agent-runs           → AgentRun[] (all, paginated)
GET  /agent-runs/latest    → AgentRun[] (most recent per agent)
GET  /agent-runs/:id       → AgentRun (full detail with all steps)
GET  /agent-events         → AgentEvent[] (audit trail)
GET  /agent-events/:runId  → AgentEvent[] (per run)
GET  /agent-memory         → AgentMemoryUpdate[] (proposals + approved)
GET  /agent-readiness      → { timestamp, agents: AgentRole[], ready: boolean, blockers?: string[] }
```

**Phase 2+ (Approval-Gated Mutations, separate specification):**
```typescript
POST /agent-approvals                      → submit approval request
POST /agent-approvals/:id/approve          → grant approval (admin only)
POST /agent-approvals/:id/reject           → deny approval (admin only)
POST /agents/:id/request-run               → queue new run (approval-gated)
POST /agent-memory/:id/approve             → commit memory update to mind/ (approval-gated)
POST /agent-handoffs/:id/accept            → inter-agent handoff acceptance
```

### Registered Agents (7 Orchestrators)

1. **Model Router** — vault maintenance (compile, memory, hygiene, drift loops)
2. **Video Orchestrator** — research, script, assets, design, assembly, publishing
3. **Research Orchestrator** — web search, synthesis, source capture
4. **Design Orchestrator** — image generation, thumbnails, visual assets
5. **Code Orchestrator** — refactoring, testing, shipping
6. **Bible Research Orchestrator** — scripture research, theological analysis
7. **Scheduler** — nightly job queue and maintenance triggers

### Brain Console Agent View (New Section)

**Cards:**
1. **Active Runs** — Currently executing runs with step progress, blockers, ETA
2. **Agent Queue** — Pending runs, sorted by priority/age
3. **Current Plan** — For focused agent: steps, dependencies, approval gates, next task
4. **Skills Used** — In current run: names, versions, status (pending/running/done/error)
5. **Approvals Needed** — Pending decisions: plan approval, step approval, memory update approval
6. **Recent Outcomes** — Last 5 run results: status, duration, error if any
7. **Learning Proposals** — Memory updates proposed by agents (pending review)
8. **Handoff State** — Any inter-agent handoffs in progress
9. **Agent Roles** — Registry of all agents, status (ready/idle/blocked)
10. **Validation** — Readiness check: all agents available, no critical blockers

**Design rule:** Legible dark cockpit, monospaced system data, sparse card layout, progressive disclosure. One card per concept. No nested UI.

### Implementation Phases

**Phase 0 (Current):** Agentic OS architecture review and roadmap alignment

**Phase 1 (Immediate):** Brain Core agent registry scaffolding (read-only)
- Create agent registry adapter (hardcoded 7 agents, STB/video/research/design/code/Bible/scheduler)
- Create agent run ledger (in-memory or file-based, append-only)
- Create agent skills registry (hardcoded for now, tied to skills/ folder)
- Create agent event model (audit trail from runs)
- Brain Console Agent View section MVP (cards, static layout)
- Model-router integration as first registered agent
- Tests: registry, run creation, event recording, agent readiness

**Phase 2+ (Deferred):** Learning loop, approval gates, memory integration, mutations

### Safety Model

- **Read-only by default** — All Brain Core agent endpoints read-only in Phase 1
- **No autonomous writes** — Agents cannot write to Mind without approval
- **Approval-gated plans** — Agent plans require explicit approval before execution
- **Skill whitelisting** — Only approved skills can be executed by agents
- **Event audit trail** — All runs, steps, approvals, and memory updates logged
- **Graceful degradation** — If an agent is offline, Brain Core returns "unavailable" not crash
- **No broad shell** — Agents use typed skill interfaces, not arbitrary shell commands
- **No external repo blind install** — All agent code is authored in Brain or Mind, not pulled from external sources

### Success Criteria

- ✅ Agent roles registered in Brain Core
- ✅ Agent runs tracked (queued → running → completed/failed)
- ✅ Agent skills discoverable and versioned
- ✅ Agent events recorded for audit trail
- ✅ Brain Console Agent View displays active runs, queue, plans, approvals, learning proposals
- ✅ Model-router appears as first registered agent with vault maintenance runs visible
- ✅ All 7 orchestrators registered (model-router, video, research, design, code, Bible research, scheduler)
- ✅ No autonomous writes to Mind (all approval-gated)
- ✅ Tests passing (registry, runs, events, readiness)
- ✅ Ready for Phase 2 approval-gated mutations

---

## Karpathy LLM Wiki Alignment

The roadmap intentionally follows the LLM Wiki pattern where durable knowledge compounds in a maintained markdown wiki instead of being re-derived from raw documents on every query.

Lean additions from the 2026-05-17 alignment review:

- Raw sources and original captures are source-of-truth material and must not be silently rewritten.
- Compiled `wiki/` and `live/` pages are the model-router-maintained synthesis layer.
- `wiki/index.md` remains the content catalog.
- `wiki/log.md` should become an append-only human-readable maintenance ledger for ingests, compilations, lint passes, important queries, and accepted updates.
- Lint/health checks must run before any approved write/apply phase: contradictions, stale claims, orphan pages, missing links, missing source trace, oversized files, stale captures, and failed captures.
- Keep the Obsidian dashboard sparse: changed, failed, needs approval, and continue-next only.

Related review:

```text
docs/system/1779040171684-karpathy-llm-wiki-alignment-review-2026-05-17.md
```

## ProBot Dashboard Migration into Obsidian Command Center

**Decision:** Obsidian Brain Console replaces ProBot web dashboard as the primary system cockpit. All valuable ProBot features migrate through Brain Core APIs. ProBot remains legacy/secondary until Brain Console reaches feature parity.

**Principles:**
- Brain Console is primary (Obsidian), ProBot is secondary (web)
- Brain Core is the integration API layer (all features expose through read-only HTTP)
- Logic stays in Brain repo (no logic in Obsidian plugin)
- Mind remains durable Markdown memory and fallback dashboard
- No direct shell execution from Obsidian plugin
- All actions are read-only, safe navigation, or approval-request-only
- Credentials stay in ProBot or out of dashboards entirely
- Features migrate only if they add real value

**Features analyzed (full inventory: `docs/system/probot-to-brain-console-migration-review-2026-05-17.md`):**

| Feature | Scope | Decision | Phase |
|---------|-------|----------|-------|
| Local app status | HIGH | KEEP | 2A |
| Local app start/stop | HIGH | REDESIGN | 5 |
| Orchestrator registry | HIGH | NEW API | 3 |
| Orchestrator run | MEDIUM | REDESIGN | 5 |
| Session history | MEDIUM | KEEP | 2B |
| Domain/project overview | MEDIUM | NEW API | 4 |
| Video orchestrator status | MEDIUM | REDESIGN | 3 |
| Viral Flow summary | MEDIUM | REDESIGN | 3 |
| System updates | MEDIUM | REDESIGN | 5 |
| Buildflow verify | LOW | LATER | 5+ |
| Credentials / OAuth | N/A | DROP | - |
| Stripe billing | N/A | DROP | - |
| Production pipeline | LOW | DROP | 6+ |

**Phased rollout:**

1. **Phase 1:** Feature inventory, classification, Brain Core gap analysis → complete
2. **Phase 2A:** Local apps UI section + session history refresh
3. **Phase 2B:** Session cards + activity panel polish
4. **Phase 3:** Orchestrator registry read-only API + Brain Console section
5. **Phase 4:** Domain/project registry read-only API + Brain Console section
6. **Phase 5:** Approval-gated actions (app start/stop, orchestrator run request, updates)
7. **Phase 6:** Visual refinement, ProBot deprecation, final transition

**Brain Core new endpoints (Phases 2-5):**

- `GET /orchestrators` — registry of all orchestrators (model-router, video, design, code, research, Bible research, scheduler, capture)
- `GET /domains` — domain/project overview (Brain/Mind, Says the Bible, active projects)
- `POST /actions/request` — approval-request-only endpoint for app/orchestrator/system mutations

**Safety guarantees:**
- No credentials exposed
- No arbitrary shell execution
- No direct Mind mutation (goes through model-router)
- All app/orchestrator controls approval-gated
- Plugin is read-only except for safe approval requests

**Success criteria for Phase 2A (next):**
- Local apps section renders with app cards
- All app data from `GET /local-apps` displays correctly
- Start/stop buttons visible but disabled with tooltip: "Approval-gated (planned)"
- Tests passing for Brain Core + Brain Console

## Success Criteria

- Obsidian is the only daily dashboard.
- `mind` has clean unnumbered folders.
- Save-to-Mind lands in `capture/inbox/` and never loses captures.
- Brain Core exposes scheduler status and model-router job results.
- Brain Core exposes safe, typed APIs for local apps, orchestrators, domains, system status
- The Office nightly scheduler runs compile, memory, hygiene, and drift/error loops.
- The model router keeps notes small, deduplicated, linked, and current.
- New skills, orchestrators, projects, and knowledge all enter through one predictable flow.
- The user experiences the system as a black box that stays organized automatically.
- ProBot is acknowledged as legacy, Brain Console is primary cockpit

## Current Status

- Report-only execution, preview policy surfaces, and preview artifact inspection are complete in Brain.
- Mind mutation remains blocked until a separately approved write/apply route exists.
- Legacy numbered-folder archival remains blocked until a separate explicit cleanup plan is approved.
- Obsidian Brain Console MVP (MVP status pills + cards) is deployed locally.
- Brain Console Brain Core connection fixed (requestUrl API).
- ProBot feature inventory complete, migration plan drafted.
- Current safe continuation point: Phase 2A (local apps UI section) or approval-gated actions framework.
