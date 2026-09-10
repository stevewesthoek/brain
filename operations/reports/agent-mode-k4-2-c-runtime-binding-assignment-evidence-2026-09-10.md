# Agent Mode K4.2-C Runtime Binding and Child Assignment Evidence

**Date:** 2026-09-10
**Status:** COMPLETE for the K4.2-C durable assignment gate
**Scope:** Runtime Binding and Durable Child Task/Run Assignment

## Result

K4.2-C is complete in the existing SQLite StateStore. A bounded typed
`AgentModeChildAssignmentRequest` binds one K4.2-B reserved child to one
canonical Task, Run, and Attempt plus a known runtime/profile pair. The gate
does not dispatch work, select a model, call AgentRuntime or ModelGateway,
start a process, wire the scheduler, create Workcell state, mutate Git, use
the network, or add UI/daemon behavior.

## Atomic authority and lineage

`assignChildAgent` is the single assignment operation and runs inside the
StateStore `BEGIN IMMEDIATE` transaction. Before any canonical write it
rechecks the child reservation and expiry, immutable root binding, parent
lineage, cancellation state, global/root kill switches, deadline, policy and
role-template identity, capability and repository/resource scopes, child
step/cost allocation, and runtime/profile admission. Authority read failures
fail closed as unavailable; there is no permissive fallback.

The committed set contains exactly one child assignment row, one canonical
Task, one Run, one Attempt, one child budget scope/reservation suballocation,
one bounded receipt, and one bounded lifecycle event. The assignment links
the child to `taskId`, `runId`, and `attemptId` and persists the assignment
intent, source event, root, runtime/profile, policy/template, capability/scope,
allocation, deadline, and status. Task/Run/Attempt remain truthful and
pre-dispatch: `admitted`, `created`, and `admitted`, respectively. No runtime
identity or PID is fabricated.

The root aggregate reservation from K4.2-B is reused; assignment does not
reserve root child slots, root steps, or root cost a second time. The existing
budget ledger records the child allocation as a suballocation. Assigned-child
retirement or expiry atomically settles that reservation to zero, cancels the
canonical entities, invalidates the assignment, and releases the K4.2-B root
aggregate allocation.

## Determinism, restart, and concurrency

`assignmentIntentKey` is deterministic over immutable logical assignment
material and excludes `assignmentId` and `requestedAt`. The same request
returns the original receipt and prepared data without duplicating any
canonical row or reservation. Conflicting material fails closed. Unique
child, task, run, attempt, and reservation constraints plus the transaction
protect races between duplicate callers and competing assignments. Reopen
reconstructs the assignment and a lost-response retry returns the same result.

Cancellation and kill-switch changes deny new assignments. A deadline cannot
outlive the child or root authority. Expiry reconciliation handles reserved
children before assignment; an already assigned child becomes non-dispatchable
and its canonical entities are cancelled on retirement/expiry. The prepared
dispatch object is a bounded immutable data projection, not execution
authority; K4.2-D must freshly recheck authority before dispatch, propagate
cancellation, and settle the child.

## Runtime/profile boundary

The finite registry admits the existing mock runtime/profile seam and the
restricted DeepSeek harness profile by explicit identifiers. Runtime identity,
runtime profile, role template, policy, and model identity remain separate.
The Attempt uses deferred route/model references because K4.2-C does not select
a model. The restricted profile remains read-only and no harness or mock
runtime is launched. Observer output exposes bounded linkage and
runtime/profile identifiers only; prompts, raw payloads, credentials, and
secrets are not copied.

## Verification

Focused K4.2-C matrix:

```text
tsx --test projects/brain-core/src/tests/agent-mode-child-assignment.test.ts
58 tests, 58 passed, 0 failed
```

The focused TypeScript no-emit check passed. The build and expanded affected
regression set (K4.2-A/B, K4.0/K4.1, observer, contracts, controls, mock
runtime, process recovery, runtime identity, and node transport) passed:

```text
npm run build
node --test <expanded K4 regression set>
268 tests, 268 passed, 0 failed
```

The matrix covers canonical entity creation and pre-dispatch status,
lineage/root isolation, runtime/profile admission, role/runtime/model
separation, capability and scope ceilings, step/cost allocation, no double
root reservation, cancellation/kill/expiry, authority failures, rollback,
restart, lost-response retry, bounded observer linkage, duplicate lifecycle
events, concurrent races, mock/restricted profile compatibility, assigned-child
retirement, and absence of Workcell/process state or runtime invocation.

## Explicit boundary

K4.2-A, K4.2-B, and K4.2-C are complete for their bounded gates. K4.2 and K4
remain in progress. The exact next task is **K4.2-D — Bounded AgentRuntime
Dispatch, Cancellation Propagation and Child Settlement**. Do not start it
automatically.
