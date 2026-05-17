# Agentic OS: External Repo Review & Architecture Direction

**Date:** 2026-05-17  
**Status:** Architecture research and direction-setting  
**Scope:** Evaluate external agent/skill frameworks, extract lean patterns, define Brain-native layer

---

## Executive Verdict

**The user should NOT install external agent frameworks.** Instead:

1. **Claude Code + Codex** are external agentic executors—use them as-is, don't wrap them
2. **Skills** are reusable task instructions/capabilities—curate and version them, don't auto-execute
3. **Model-router** is ONE registered orchestrator/agent inside a larger OS, not the whole OS
4. **Brain Core + Brain Console** must implement a thin, approval-gated agent state layer
5. **Mind** remains durable memory/wiki/sources only—no agent runtime logic

External frameworks offer valuable **architectural patterns** but are bloated for this workflow. A lean Brain-native layer is the right call.

---

## What "Agentic OS" Means for This System

An agentic OS is NOT:
- ❌ Installing an external agent framework
- ❌ Making agents autonomous writers to Mind
- ❌ Broad shell execution
- ❌ Automatic self-modification
- ❌ A replacement for Claude Code/Codex

An agentic OS IS:
- ✅ Persistent agent state (runs, roles, plans, events)
- ✅ Skill registry (what capabilities exist)
- ✅ Event ledger (what agents did, why, outcome)
- ✅ Learning proposals (discoverable, approval-gated)
- ✅ Agent View in Brain Console (legible orchestration)
- ✅ API boundary in Brain Core (typed, read-only first)
- ✅ Approval gates on all state mutations
- ✅ Model-agnostic (Claude, Codex, Gemini, local models all work)

The OS layer is **infrastructure for orchestrating and tracking agentic work**, not the execution itself.

---

## What Claude Code / Codex Already Provide

**Native agentic capabilities:**
- Session resumption + handoff state
- Tool calling (file read/write, bash, API calls)
- Structured reasoning + planning
- Multi-turn context preservation
- Error recovery and retry logic

**The user does not need to rebuild this.** Instead:
- Expose Claude Code sessions through Brain Core API
- Track session metadata in agent runs ledger
- Render session state in Agent View
- Let Claude Code execute; track outcomes in Brain

**What's missing:** Persistent agent run state visible across sessions + approval gates on state mutations.

---

## What Skills Are

Skills are **reusable task instructions/capabilities**, not an OS layer.

Examples:
- `/code` — understand/improve/fix/build code (master orchestrator)
- `/design` — design system work, UI/UX
- `/viral-flow` — content strategy and posting
- `/video` — video production and uploading
- `/research` — web search and synthesis
- `/memory` — recall/capture personal memory

Skills:
- ✅ Should be curated and version-controlled
- ✅ Can evolve based on feedback
- ✅ Are discovered and listed in Agent View
- ❌ Should NOT auto-execute
- ❌ Should NOT auto-create new skills
- ❌ Should NOT mutate Mind without approval

---

## Why Model-Router Is NOT the Whole Agentic OS

**Model-router's actual role:**
- One specialized orchestrator/agent
- Responsible for Mind vault maintenance
- Manages compile, memory, hygiene, drift-error loops
- Reads dry-run reports and proposes edits
- Does NOT execute edits (blocked until approval)

**Model-router is inside the OS, not the OS itself.**

The full OS must track:
- STB publishing agent (video orchestrator)
- Research orchestrator
- Design orchestrator
- Code orchestrator
- Bible research orchestrator
- Capture/inbox processor
- Model-router vault agent
- All their runs, outcomes, learning

Model-router is one of many agents, not the container.

---

## Where the Agentic OS Layer Belongs

**Brain Core owns agent state:**
- Read-only agent registry (GET /agents, GET /agent-runs, GET /agent-skills)
- Event ledger (what agents did)
- Run state (current/historical)
- Learning proposals (discoverable)
- Approval gates (on mutations)

**Brain Console renders Agent View:**
- Active runs
- Agent queue
- Current plan
- Blockers
- Approvals needed
- Learning log

**Mind remains:**
- Durable memory (wiki, sources, personal knowledge)
- Capture inbox (notes to process)
- Fallback dashboard (if Brain Core offline)
- NOT agent runtime state

---

## External Repository Analysis

### 1. OpenHuman (tinyhumansai/openhuman)

**What it is:** Framework for autonomous agents with human-in-the-loop oversight.

**Value for Brain/Mind:**
- ✅ Approval gate pattern
- ✅ Human feedback loop model
- ✅ Multi-agent coordination concepts

**Risks:**
- ❌ Heavy framework—would require major integration
- ❌ Autonomous execution by default (not our model)
- ❌ Agent auto-modification (we require approval)

**Verdict:** **LEARN ONLY**

**Extracted pattern:**
- Human oversight at decision points (approval gates)
- Agent can propose, human approves
- Feedback loop drives learning

**Implementation priority:** Low (we already have approval gates)

---

### 2. Superserve (superserve-ai/superserve)

**What it is:** Infrastructure for serving agents at scale with API boundaries.

**Value for Brain/Mind:**
- ✅ API-first agent state management
- ✅ Read-only first, mutations gated
- ✅ Agent registry/discovery
- ✅ Run tracking

**Risks:**
- ❌ Designed for SaaS deployment (we need local)
- ❌ Heavy on infrastructure concerns
- ❌ Billing/usage tracking (not relevant)

**Verdict:** **LEARN ONLY**

**Extracted pattern:**
- Agent state is an API resource (GET /agents/:id)
- Runs are immutable events (append-only ledger)
- Discovery via registry endpoint

**Implementation priority:** Medium (patterns fit Brain Core design)

---

### 3. Agency Agents (msitarzewski/agency-agents)

**What it is:** Agent framework with role-based orchestration.

**Value for Brain/Mind:**
- ✅ AgentRole concept (teams of agents)
- ✅ Task/run model
- ✅ Role-based permissions

**Risks:**
- ❌ Framework overhead
- ❌ Assumes agents are autonomous (ours are supervised)

**Verdict:** **LEARN ONLY**

**Extracted pattern:**
- AgentRole: who/what can do what
- AgentTask: unit of work assigned to role
- AgentRun: execution instance of task

**Implementation priority:** Medium (roles fit permission model)

---

### 4. Ruflo (ruvnet/ruflo)

**What it is:** LLM workflow orchestration DSL.

**Value for Brain/Mind:**
- ✅ Workflow/plan model
- ✅ Step-by-step execution tracking
- ✅ Error handling patterns

**Risks:**
- ❌ DSL complexity (we prefer simple JSON/TS)
- ❌ Not designed for approval gates

**Verdict:** **LEARN ONLY**

**Extracted pattern:**
- Plan: sequence of steps (linear DAG)
- Step: single action with inputs/outputs
- Execution: run instance with state per step

**Implementation priority:** Low (basic plan model sufficient)

---

### 5. CocoIndex (cocoindex-io/cocoindex)

**What it is:** Code indexing and knowledge graph for agent reasoning.

**Value for Brain/Mind:**
- ✅ Codebase knowledge graph concept
- ✅ Cross-file dependency tracking
- ✅ Query optimization

**Risks:**
- ❌ Heavy infrastructure
- ❌ Not needed for initial agentic OS

**Verdict:** **DEFER**

**Extracted pattern:**
- Agents need codebase context (graphify already does this)
- Knowledge graph enables better reasoning
- Could be Phase 2+ enhancement

**Implementation priority:** Low (defer to Phase 3+)

---

### 6. Google Skills

**What it is:** Google's internal skill/capability system.

**Value for Brain/Mind:**
- ✅ Skill versioning and dependency management
- ✅ Skill discovery patterns
- ✅ Permission/scope model per skill

**Risks:**
- ❌ Limited public documentation
- ❌ Designed for proprietary use

**Verdict:** **LEARN ONLY (patterns)**

**Extracted pattern:**
- Skill has name, version, dependencies, permissions
- Agents discover skills via registry query
- Permissions limit what agents can invoke

**Implementation priority:** Medium (skill registry essential)

---

### 7. OpenAI Skills

**What it is:** OpenAI's plugin/skill model (from ChatGPT plugins era).

**Value for Brain/Mind:**
- ✅ Manifest-based skill definition (JSON schema)
- ✅ Tool calling integration
- ✅ User-facing skill browsing

**Risks:**
- ❌ Deprecated/sunsetting
- ❌ Tightly coupled to ChatGPT

**Verdict:** **LEARN ONLY**

**Extracted pattern:**
- Skill manifest: name, description, params, tools
- Discovery: list all, filter by capability
- Invocation: pass to model as tool

**Implementation priority:** Medium (manifest pattern useful)

---

### 8. Anthropic Skills

**What it is:** Anthropic's skill/tool framework for Claude.

**Value for Brain/Mind:**
- ✅ Native to Claude API (what we use)
- ✅ Tool use patterns
- ✅ Error handling in tool execution

**Risks:**
- ❌ Lower-level than we need (API-focused, not system-level)

**Verdict:** **LEARN ONLY**

**Extracted pattern:**
- Tools are skill building blocks
- Claude uses tools via structured calls
- Results feed back to model for reasoning

**Implementation priority:** Low (Claude Code/Codex handle this)

---

### 9. Superpowers (obra/superpowers)

**What it is:** Collaborative web-based IDE with agent automation.

**Value for Brain/Mind:**
- ✅ Collaborative/approval patterns
- ✅ Change proposals (agent suggests, human approves)
- ✅ Audit trail

**Risks:**
- ❌ Web IDE—not applicable to our architecture
- ❌ Different problem domain (real-time collab)

**Verdict:** **LEARN ONLY (audit/approval patterns)**

**Extracted pattern:**
- Agent proposes change
- Human reviews in familiar UI
- Approval creates immutable record
- Audit trail stays in sync

**Implementation priority:** Medium (audit trail important)

---

### 10. Mercury Agent (cosmicstack-labs/mercury-agent)

**What it is:** Agent framework with memory and reflection capabilities.

**Value for Brain/Mind:**
- ✅ Agent memory model (separate from core logic)
- ✅ Reflection/self-evaluation loop
- ✅ Experience reuse

**Risks:**
- ❌ Autonomous self-modification (we require approval)
- ❌ Heavy framework

**Verdict:** **LEARN ONLY**

**Extracted pattern:**
- Agent maintains separate memory from task state
- Reflection step: "what did I learn?"
- Learning proposals → approval → memory update

**Implementation priority:** Medium (learning loop critical)

---

### 11. Hermes Agent (NousResearch/hermes-agent)

**What it is:** Agent framework with multi-stage reasoning (planning, execution, reflection).

**Value for Brain/Mind:**
- ✅ Plan → Execute → Reflect structure
- ✅ Blockers and dependencies
- ✅ Explicit step tracking

**Risks:**
- ❌ Heavy inference cost (multi-stage reasoning)
- ❌ Assumes autonomous operation

**Verdict:** **LEARN ONLY**

**Extracted pattern:**
- Plan phase: agent proposes steps
- Execution phase: run each step
- Reflection phase: evaluate outcome
- Cycle: learn → next plan

**Implementation priority:** High (framework matches our model)

---

## Recommended Brain-Native Agentic OS Architecture

### Core Entities (TypeScript types)

```typescript
interface AgentRole {
  id: string;
  name: string;
  description: string;
  capabilities: string[]; // skill IDs this agent can invoke
  permissions: {
    canRead: string[]; // resource paths
    canWrite: string[]; // requires approval
    canExecute: string[]; // orchestrators it can run
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
  inputs: Record<string, { type: string; description: string }>;
  outputs: Record<string, { type: string; description: string }>;
  dependencies: string[]; // other skill IDs
  approvalRequired: boolean;
  status: "ready" | "beta" | "deprecated" | "archived";
}

interface AgentPlan {
  id: string;
  agentId: string;
  title: string;
  description: string;
  steps: Array<{
    sequence: number;
    skillId: string;
    inputs: Record<string, unknown>;
    dependencies: number[]; // step indices
    approvalRequired: boolean;
  }>;
  estimatedDuration?: number; // ms
  status: "proposed" | "approved" | "executing" | "completed" | "failed";
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

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
    outputs?: Record<string, unknown>;
    error?: string;
    duration?: number;
    startedAt?: Date;
    completedAt?: Date;
  }>;
  blockers?: string[]; // reasons paused
  approvalsPending?: string[]; // approval request IDs
}

interface AgentEvent {
  id: string;
  timestamp: Date;
  agentId: string;
  runId?: string;
  type: "started" | "step_completed" | "blocked" | "approval_requested" | "approval_granted" | "failed" | "completed";
  message: string;
  metadata: Record<string, unknown>;
}

interface AgentMemoryUpdate {
  id: string;
  agentId: string;
  timestamp: Date;
  type: "learning" | "observation" | "capability" | "constraint";
  description: string;
  source: string; // run ID or manual entry
  approvalStatus: "proposed" | "approved" | "rejected";
  approvedAt?: Date;
  approvedBy?: string;
  targetPath?: string; // path in Mind if approved
}

interface AgentApproval {
  id: string;
  type: "run_approval" | "step_approval" | "memory_update" | "skill_modification";
  targetId: string; // run ID, step ID, memory ID, skill ID
  requestedAt: Date;
  requestedBy: string;
  status: "pending" | "approved" | "rejected";
  decidedAt?: Date;
  decidedBy?: string;
  reason?: string;
}

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

interface AgentMetric {
  agentId: string;
  timestamp: Date;
  runsCompleted: number;
  runsSuccessful: number;
  runsBlocked: number;
  averageStepDuration: number; // ms
  approvalsRequested: number;
  approvalsGranted: number;
  memoryUpdatesProposed: number;
  memoryUpdatesApproved: number;
}
```

---

## Brain Core API Endpoints

**Read-only (Phase 1):**
- `GET /agents` — list all agent roles
- `GET /agents/:id` — detail for one agent
- `GET /agent-skills` — skill registry
- `GET /agent-skills/:id` — skill detail
- `GET /agent-runs` — query run history
- `GET /agent-runs/latest` — recent runs by agent
- `GET /agent-runs/:id` — detail for one run
- `GET /agent-events` — event log
- `GET /agent-events/:runId` — events for a run
- `GET /agent-memory` — learned observations
- `GET /agent-readiness` — system readiness for new runs

**Approval/action (Phase 2+):**
- `POST /agent-runs/:id/approve` — approve a proposed run
- `POST /agent-runs/:id/pause` — pause execution
- `POST /agent-memory/:id/approve` — approve memory update
- `POST /agents/:id/skill/grant` — add skill to agent

---

## Brain Console Agent View

**Sections:**
1. **Active Runs** — what agents are doing now
2. **Agent Queue** — proposed runs awaiting approval
3. **Current Plan** — steps in active run, blockers
4. **Skills Used** — which capabilities were invoked
5. **Approvals Needed** — permissions required
6. **Recent Outcomes** — last 10 completed runs
7. **Learning Proposals** — memory updates proposed
8. **Handoff State** — if agent is waiting for handoff

**Design rule:** Dashboard makes agent behavior legible—what is running, why, what it can touch, what it needs approval for, what it learned, what happens next.

---

## Implementation Priority & Phases

### Phase 1: Read-Only Agent State (4 weeks)
- Brain Core agent registry adapter
- Agent runs ledger (immutable append-only)
- Agent skills registry
- Agent event log
- Brain Console Agent View (read-only)
- Integration: model-router registered as first agent
- Integration: orchestrators (STB, video, research, design, code, Bible research) as registered agents

### Phase 2: Approval Gates (3 weeks)
- Approval request endpoint in Brain Core
- Run approval flow
- Memory update approval flow
- Skill assignment approval flow
- Decision audit trail

### Phase 3: Learning Loop (3 weeks)
- Learning proposal system
- Memory update model
- Reflection/evaluation framework
- Approved learning → Mind wiki compilation

### Phase 4: Handoff & Resumption (2 weeks)
- Agent handoff model (Claude Code session → new agent)
- State preservation across handoffs
- Resumption flow in Brain Console

### Phase 5: Scaling & Optimization (TBD)
- Multi-agent coordination
- Conflict resolution
- Resource scheduling
- Performance metrics

---

## What NOT to Build

- ❌ External framework installation (use Claude/Codex as-is)
- ❌ Autonomous execution (approval required)
- ❌ Automatic skill generation
- ❌ Broad shell runners
- ❌ Agent self-modification
- ❌ Brain → Mind runtime writes without approval
- ❌ External LLM vendor coupling (stay model-agnostic)
- ❌ Complex DSLs (JSON/TS types sufficient)
- ❌ Multi-agent arbitration (not yet needed)
- ❌ Resource quotas or billing (local-only, not needed)

---

## Safety & Permission Model

**Default:** Everything requires approval.

**Read-only** (no approval needed):
- Query agent state
- View runs, events, plans
- List skills
- Browse learning proposals

**Requires approval** (after Phase 2):
- Approve a proposed run
- Update agent memory
- Grant agent a new skill
- Pause/resume execution
- Handoff to new agent

**Never allowed:**
- Autonomous write to Mind
- Direct shell execution
- Agent creation without human request
- Skill auto-installation
- External data source integration without approval

---

## Conclusion

The user should:

1. **NOT install external frameworks**—they're too heavy and coupled to autonomous execution
2. **Build Brain-native agentic OS layer**—thin, approval-gated, readable in Brain Console
3. **Treat model-router as one agent**—not the whole OS
4. **Use Claude Code/Codex as executors**—don't wrap them
5. **Keep Mind durable memory-only**—no agent runtime state
6. **Stage implementations**—read-only first, approvals second, learning third

This approach:
- ✅ Stays lightweight and maintainable
- ✅ Preserves approval gates and human oversight
- ✅ Supports future scaling (multi-agent, handoffs, learning)
- ✅ Keeps Mind clean (durable memory only)
- ✅ Works with any LLM (Claude, Codex, Gemini, local)
- ✅ Integrates existing systems (STB, ProBot, model-router, Brain Console)
