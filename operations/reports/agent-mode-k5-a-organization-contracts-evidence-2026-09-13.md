# Agent Mode K5-A Organization Contracts Evidence — 2026-09-13

## Decision

**K5-A — Durable Multi-Agent Organization Contracts and Delegation DAG
Foundation: COMPLETE.** Phase K5 remains **IN PROGRESS**. No K5 organization
worker was executed and K5-B was not started.

## Starting-state reconciliation

- Confirmed HEAD: `30949b45 docs(agent-mode): close k4 live autonomy gate`.
- The preceding live-worker commits are `fc938849` and `a81ee10c`.
- K4.3-A, K4.3-B, and K4 are marked complete in the roadmap, closure report,
  product progress, and runtime-surfaces runbook.
- Phase K5 is the next planned roadmap phase and its exit gate remains the
  several-worker ownership/cost/evidence/dependency/final-result gate.
- No current K0.3/BrainNode implementation task was found. `brain-node.ts` was
  not changed.
- No unexpected staged changes were present. The pre-existing protected paths
  remained untouched: `tools/firecrawl/logs/firecrawl.log`,
  `operations/specs/mindcontrol-product-roadmap.md`, and
  `operations/specs/nevermind-release-pipeline-roadmap.md`.

## Implementation

`projects/brain-core/src/agent-mode/organization.ts` defines the closed,
versioned Brain-owned organization-role registry, the bounded
`OrganizationPlan`, delegated work items, `requires_success` edges, result /
evidence contracts, deterministic SHA-256 identities, DAG validation, the
K5-A three-item fixture, and pure readiness evaluation. The six roles are
Jarvis / CEO, Engineering, Research, Operations, Memory / Archivist, and
Independent Auditor.

The role manifest has no model, provider, runtime, executable, shell,
credential, repository, capability, or policy authority. K5 types do not reuse
K4 AgentRoleTemplate, AgentRuntime, ModelGateway, or BrainNode authority.

The existing `AgentModeSqliteStateStore` now owns three additive tables:

- `agent_mode_organization_plans`;
- `agent_mode_organization_work_items`;
- `agent_mode_organization_dependencies`.

Plan, work items, and edges are inserted in one existing `BEGIN IMMEDIATE`
transaction. Same canonical material returns the existing graph; conflicting
material for the same deterministic plan identity returns an explicit conflict.
The schema includes nullable future child-agent/task binding columns but no
execution ledger or second Task/Run/Attempt/result system.

The observer exposes bounded plan and work-item ownership, role, counts,
readiness, and nullable future child/task IDs. It does not expose task spec
content, prompts, hidden reasoning, raw provider payloads, credentials, or free
form agent communication.

## Deterministic fixture and readiness

The fixture contains three delegated items: Research and Engineering are
indegree-zero and initially `ready`; Independent Auditor requires successful
Research and Engineering and is initially `blocked`. Supplied valid successful
result facts with bounded result/evidence references make the Auditor `ready`.
Failed/cancelled predecessors produce `dependency_failed`. Cancelled or killed
root authority and an expired plan block readiness. Invalid/incomplete result
evidence cannot unlock a dependent.

Hard bounds are 16 work items, 32 edges, 128-character work-item keys,
256-character task-spec references, 16 evidence refs, 30-day plans, and finite
positive bounded work-item step/token/cost/TTL declarations.

## Side-effect and authority counts

Creating the three-item plan changed no K4 execution authority:

| Effect | Count |
|---|---:|
| root used/reserved budget | 0 / 0 |
| child agents | 0 |
| child slots consumed | 0 |
| Tasks / Runs / Attempts created by organization | 0 / 0 / 0 |
| AgentRuntime / Harness calls | 0 / 0 |
| ModelGateway / Bedrock / MiniMax calls | 0 / 0 / 0 |
| BrainNode / Workcells / network effects | 0 / 0 / 0 |
| repository mutations through Agent Mode | 0 |

Organization intent remains non-executable. A requested Engineering work item
is not an Engineering child; only a later K5-B composition through K4
SpawnRequest, SpawnPolicy, reservation, assignment, runtime, and structured
result paths can create one.

## Validation

- K5-A focused tests: **10/10 passed**.
- Focused K4/StateStore regression set: **284/284 passed**. This covered
  StateStore, spawn/reservation, child assignment, K4 scheduler/orchestration,
  observer, controls, process recovery, runtime dispatch, model policy, and
  contract tests.
- Brain Core typecheck: **PASS**.
- Brain Core build: **PASS**.
- `git diff --check`: **PASS**.
- Full Brain Core suite: the current `npm test` attempt reached the known
  long-running `agent-orchestrator.test.js` timing path and was stopped after
  171 seconds without a complete aggregate. The prior K4 closure baseline is
  **2491/2494 passed**, with exactly three existing unrelated
  `agent-orchestrator.test.js` timing assertion failures; no K4-focused test
  failed and those failures remain out of scope.
- No network, provider, model, Harness, AgentRuntime, BrainNode, Workcell, or
  repository execution was used for K5-A.

## Restart and concurrency

StateStore close/reopen reconstructed the exact plan ID, root/supervisor
ownership, six-registry role references, three work-item IDs, dependency DAG,
result contracts, and deterministic readiness. Two controllers creating the
same plan converged on one plan, three work-item rows, and two dependency rows;
conflicting same-identity material failed closed without a partial graph.

## Exact next task

**K5-B — Deterministic Supervisor Delegation Orchestrator with Mock Workers.**
It must compose `OrganizationPlan` and readiness through the existing K4
control plane and remain a separate explicitly bounded slice.
