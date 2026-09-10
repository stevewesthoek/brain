# Agent Mode K4.2-A Spawn Policy Admission Evidence

Date: 2026-09-10
Status: COMPLETE for the K4.2-A policy-only gate
Scope: Brain Core / Agent Mode; no live providers, network, workers, or child creation

## Outcome

K4.2-A adds a deterministic policy boundary from a pre-normalized durable K4.1
scheduler event to `SpawnRequest`, then to `SpawnDecision` (`ALLOW` or
`DENY`). The boundary is implemented in
`projects/brain-core/src/agent-mode/spawn-policy.ts` and consumes no provider
adapter, raw event payload, Git state, prompt, command, credential, model, or
runtime response.

## Implemented contract

- Versioned `AgentSpawnPolicy` and static role-template manifests reject
  duplicate IDs, unknown versions, unknown capabilities, wildcard escalation,
  unsafe scopes, shell-like capabilities, negative/unbounded limits, and
  malformed aggregate/deadline rules.
- The initial role templates are read-only and safe-engineering. Role identity
  is separate from model identity; templates contain no model/provider fields.
- `SpawnRequest` is bounded and typed: request/policy/template identity, source
  event identity/type, explicit root/parent lineage, repository/resource scope,
  requested capabilities, TTL, step/cost budgets, timestamps, deadline, and
  authoritative requested depth. It contains no prompt, raw payload, command,
  shell, credential, or provider response.
- Evaluation precedence is schema/request validity, authority availability,
  global switch, root binding/root switch, cancellation/deadline, policy and
  allowlists, role, parent lineage, capability/scope, TTL/depth,
  concurrency/total creation, and budgets/steps.
- Root-goal binding is mandatory for autonomous admission. An authoritative
  event root must match exactly; no root is fabricated. Parent identity and
  root lineage must match exactly.
- Capability requests must be known, role-admitted, policy-admitted, and
  delegated by the root/parent. Repository and resource scopes are explicit,
  allowlisted, event-matched, and parent-narrowed. Primary-repository writes
  are not admitted; writes remain Workcell-scoped.
- TTL is finite and bounded by template, policy, and root/request deadlines.
  Depth is authoritative and finite. Active-child and total-creation caps are
  evaluated from facts; total creation includes failed, retired, and recreated
  children. These checks are deliberately non-atomic; K4.2-B owns reservation.
- Budget and step requests must fit template, policy, root remaining, and
  aggregate ceilings. Missing or stale authority facts deny.
- `spawnIntentKey` is a SHA-256 key over source event, policy/version,
  role/version, parent/root lineage, and requested scope. Request identity is
  excluded, so retries are stable while logical scope/lineage changes differ.

## Durable control and observer boundary

The existing SQLite StateStore now persists global and root spawn-admission
controls in its existing schema. Controls survive close/reopen, and control reads fail
closed as `AUTHORITY_UNAVAILABLE`. The observer exposes only a bounded list of
persisted control rows; it does not invent or expose an in-memory decision
history.

No child Agent record, child Task/Run/Attempt, AgentRuntime process,
ModelGateway call, slot reservation, event-to-spawn wiring, heartbeat loop,
network call, or provider integration was added.

## Focused test evidence

`projects/brain-core/src/tests/agent-mode-spawn-policy.test.ts`: **63/63 pass**.

The matrix covers allow, stable/conflicting intent keys, policy/template
identity and enablement, source/event allowlists, root and parent binding,
cancellation, global/root kill switches, capability and delegation ceilings,
scope narrowing, Workcell-only write boundary, TTL/deadline/depth,
concurrency/total creation, step/cost budgets, malformed requests, manifest
validation, model/role separation, durable control defaults/persistence/reopen,
and fail-closed control reads. Failure-injection cases for kill-switch,
root/parent lookup, cancellation, and budget authority are denied without an
ALLOW fallback.

Regression checks:

- Brain Core TypeScript typecheck: PASS.
- Agent Mode observer tests: PASS (4/4 in the combined focused run).
- No network, model, runtime, worker, or child-agent creation path exercised.
- Existing K4.1-C2 closure and K4.0 scheduler suites remain required gates and
  are run in the final validation pass.

## State transition

- K4.1: COMPLETE.
- K4.2-A: COMPLETE.
- K4.2: IN PROGRESS.
- K4: IN PROGRESS.
- Exact next task: **K4.2-B — Durable Child Agent Identity, Atomic Spawn-Slot
  Reservation and Root Aggregate Limits**.
