# Agent Mode K4.2-E1 — Scheduler-to-Worker Orchestration Evidence

**Date:** 2026-09-11
**Status:** COMPLETE for the bounded K4.2-E1 scheduler-to-worker gate

## Scope

This tranche adds one bounded asynchronous advancement boundary over the
existing Agent Mode scheduler, spawn policy, child reservation, assignment,
and D1 runtime-dispatch contracts. It does not replace or duplicate those
authorities.

The new closed action registry contains one read-only fixture rule:

- rule: `agent-mode.action.e1-read-only-fixture.v1`
- source: `source:e1-fixture`
- event: `repository.commit.observed`
- policy: `agent-spawn.read-only.v1`
- role: `agent-role.read-only-worker.v1`
- runtime: `runtime:mock-agent`
- profile: `agent-runtime-profile.mock.v1`
- task: `task-spec:agent-mode-read-only-fixture`

The default rule is disabled. The registry is validated as finite, closed,
versioned, Mock-runtime-only, read-only, non-recursive, and independent from
spawn permission. Event payloads cannot select policy, role, runtime, model,
capabilities, scope, or task.

## Deterministic lifecycle evidence

The orchestrator:

1. orders and bounds eligible scheduler events;
2. claims one event through the existing SQLite scheduler lease/fence;
3. reads source type from durable source configuration;
4. requires the event's explicit authoritative root binding;
5. derives action-application, spawn, child, assignment, operation, and
   dispatch identities from immutable event/rule material;
6. invokes the existing K4.2-A admission evaluator;
7. invokes the existing K4.2-B atomic reservation;
8. invokes the existing K4.2-C assignment;
9. invokes the existing K4.2-D1 dispatcher; and
10. settles the scheduler event with bounded result and causation linkage.

No direct child/task/run/attempt insertion, budget mutation, lease handling,
runtime launch, or replacement-worker path exists in the orchestrator.

The positive path creates one worker child and one canonical Task/Run/Attempt,
then reaches one D1 operation/outbox, one MockAgentRuntime invocation, one
bounded runtime receipt, and one terminal settlement. Root active-child and
budget allocations are released by the existing D1 settlement boundary.

## Recovery and control evidence

The focused matrix covers:

- disabled/default/unknown action rules and policy-versus-intent separation;
- missing root binding and malicious event metadata;
- ten redeliveries converging on one lifecycle and one runtime invocation;
- concurrent scheduler claim fencing and five events competing for four root
  in-flight child slots;
- crashes before policy, before child commit, after child creation, after
  assignment, and after worker settlement;
- runtime uncertainty without blind replay or replacement creation;
- known runtime failure, pre-dispatch cancellation, and in-flight cancellation;
- kill-switch pause/resume and expired-root-deadline denial;
- monotonic total-creation ceiling and aggregate-budget denial;
- bounded deterministic batch advancement and quiet no-op heartbeat behavior;
- recursive-spawn prevention through the static read-only rule and no child
  action output; and
- observer reconstruction of action, causation, child, assignment, operation,
  dispatch, phase, terminal outcome, and reason fields without prompts, raw
  payloads, hidden reasoning, credentials, or secrets.

Temporary contention/control/authority denials remain retryable through the
existing scheduler backoff. Terminal quota and deadline denials complete the
event without replacement churn. D1 uncertain state remains scheduler-retryable
for reconciliation but cannot invoke the runtime again.

## Effect-count proof

For the accepted positive fixture path:

```text
MockAgentRuntime invocations: 1
Harness processes:             0
ModelGateway invocations:      0
BrainNode calls:               0
Workcell records/processes:     0
network calls:                 0
replacement workers:           0
recursive child actions:       0
```

The fixture is read-only and uses no provider/model route. Scheduler
redelivery and observer reads are durable local StateStore operations.

## Validation

Focused E1:

```text
node --test --import tsx src/tests/agent-mode-dynamic-worker-orchestrator.test.ts
23 tests, 23 passed, 0 failed
```

Affected Agent Mode regression:

```text
node --test --import tsx src/tests/agent-mode-*.test.ts
339 tests, 339 passed, 0 failed
```

Package-wide Brain Core validation:

```text
npm run typecheck
PASS
npm run build
PASS
npm test
2467 tests, 2467 passed, 0 failed
```

`git diff --check` passes. The unrelated tracked
`tools/firecrawl/logs/firecrawl.log` change was left untouched and unstaged.

## Explicit non-goals

E1 does not enable the default action registry, invoke Harness, ModelGateway,
Bedrock, MiniMax, GLM, Opus, Codex, BrainNode, Workcell, Git writes, external
network, shell/process execution, recursive spawning, autonomous free-chat,
or a daemon/timer. It does not modify Mind, AWS, SSH, Tailscale, FluidVoice,
MLX Whisper, or Video Orchestrator state.

K4.2-E1 is complete for its bounded gate. K4.2 and K4 remain **IN PROGRESS**.
The exact next bounded task is **K4.2-E2 — Restricted-Harness
Scheduler-to-Worker Acceptance and K4.2 Closure Gate**.
