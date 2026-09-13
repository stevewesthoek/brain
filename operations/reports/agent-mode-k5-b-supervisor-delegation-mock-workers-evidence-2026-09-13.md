# Agent Mode K5-B Supervisor Delegation Mock-Worker Evidence

Date: 2026-09-13

## Scope and starting state

The repository was reconciled before editing. Starting HEAD was:

```text
ad072ad6 feat(agent-mode): add durable organization plans
```

K5-A was present in the current HEAD, K4 was marked complete, and no newer
K5-B implementation was present. The only pre-existing worktree changes were
the protected Firecrawl log and the two unrelated roadmap files. None were
modified, staged, or committed.

K5-B is the deterministic/mock execution composition layer only. It does not
invoke a live model, launch Harness, create Workcells, execute BrainNode, use
the scheduler/EventSource path, add peer chat, or implement K5-C.

## Implemented contract

`AgentModeOrganizationDelegationOrchestrator` exposes one finite
`advanceOrganizationPlanOnce({ organizationPlanId, maxWorkItems })` pass. It
orders work items canonically by `workItemKey` and caps a pass at four items.
The controller performs this bounded chain:

```text
K5-A OrganizationPlan/readiness
  -> closed delegation rule
  -> K4 SpawnRequest / SpawnPolicy
  -> K4 atomic child reservation
  -> K4 child assignment
  -> K4 D1 runtime dispatcher
  -> MockAgentRuntime
  -> existing K4 receipt/effect/settlement
  -> derived K5 result/evidence fact
```

The six K5-A organization roles remain identity-only. K5-B uses a closed
six-entry delegation registry; only Research, Engineering, and Independent
Auditor are enabled for the fixture, and each maps separately to the K4
read-only role/policy and `MockAgentRuntime`. No rule contains a model,
provider, shell, credential, BrainNode, Workcell, or repository-write authority.
The internal source/event pair is
`brain.organization.delegation` / `organization.work-item.ready`.

Delegation intent, K4 spawn, assignment, and dispatch identities are derived
from stable plan/work-item/rule material. After K4 assignment creates the
authoritative lifecycle, one StateStore binding records the work item to its
child Agent and Task. Repeating the binding is idempotent; conflicting rebinds
fail closed. K5 stores no duplicate Task/Run/Attempt status or result body.

Result facts are derived from the existing K4 runtime receipt/effect and
settled budget reservation. Only a durable, verified successful K4 receipt with
a bounded evidence reference satisfies `requires_success`. Organization cost
is reconstructed from settled K4 reservation facts; the mock fixture settles
at zero cost.

## Fixture and recovery evidence

The K5-A three-item fixture is used unchanged:

- Research: initially ready;
- Engineering: initially ready;
- Independent Auditor: blocked until both predecessors have authoritative
  successful receipts.

The happy path produced exactly three worker child lifecycles: three child
Agents, Tasks, Runs, Attempts, and three MockAgentRuntime invocations. The
supervisor root Task/Run setup is a pre-existing parent lifecycle; the counts
above intentionally count only organization-created worker lifecycles.

Covered deterministic cases include:

- K5-A plan/role authority remains closed and the plan graph is not rewritten;
- Research and Engineering execute first, then Auditor executes only after
  readiness recomputation;
- repeated advancement and StateStore reopen preserve one lifecycle per item;
- a simulated crash after K4 child creation recovers the same child and binds
  it after restart, with no replacement child;
- failed predecessor facts produce dependency failure and no Auditor;
- uncertain D1 outcome is not replayed;
- root cancellation, root kill control, and plan expiry block new work;
- two controllers converge on one child, assignment, dispatch, and binding;
- observer projection exposes bounded plan/item ownership, lifecycle IDs,
  readiness, result/evidence counts, settled cost, and organization totals;
- no Workcell or prompt/peer-chat projection is created.

Existing K4 tests separately cover concurrency, total creation ceilings,
aggregate budget, cancellation, deadline, assignment, dispatch, receipt,
uncertainty, and settlement authority. K5-B calls those APIs and does not
duplicate their policy logic.

## Validation

Focused command:

```text
npx tsx --test src/tests/agent-mode-organization.test.ts \
  src/tests/agent-mode-organization-delegation-orchestrator.test.ts \
  src/tests/agent-mode-spawn-policy.test.ts \
  src/tests/agent-mode-spawn-reservation.test.ts \
  src/tests/agent-mode-child-assignment.test.ts \
  src/tests/agent-mode-runtime-dispatch.test.ts \
  src/tests/agent-mode-observer.test.ts
```

Result: **248 passed, 0 failed**.

Breakdown:

- K5-A organization tests: 10 passed;
- K5-B delegation tests: 9 passed;
- K4 SpawnPolicy, reservation, assignment, D1 dispatch, and observer tests:
  229 passed.

Additional checks:

- Brain Core typecheck: passed;
- Brain Core build: passed;
- `git diff --check`: passed;
- full Brain Core suite: 2512 passed, 1 failed. The failure was the unrelated
  `vo-studio-write.test.js` metadata-title expectation (actual `STB Episode
  052` versus expected `Says the Bible`); no K5-B/K4 test failed and the K5-B
  change does not touch VO Studio code. This remains out of scope.

## Decision

K5-B is complete for the bounded deterministic supervisor delegation and
mock-worker gate. K5 remains **IN PROGRESS**. Exact next bounded slice:

**K5-C — Structured Supervisor Aggregation, Auditor Gate, and Organization
Final Result**.
