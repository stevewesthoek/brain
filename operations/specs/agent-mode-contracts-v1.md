# Agent Mode contracts v1

This document defines the offline admission boundary exercised by A0.1. It is
not the complete Agent Mode domain model and does not authorize live providers,
host actions or unattended execution.

## Authority

Brain owns the admission decision. Jarvis, an adopted runtime, a model gateway,
a skill, a terminal session and a node may request work but cannot grant their
own authority. Existing infrastructure account, credential-reference, resource
and runtime-profile IDs are referenced by `ResourceRef`; Agent Mode does not
create a second identity catalog.

## Attempt

An attempt is correlated by `agentId`, `taskId`, `runId` and `attemptId`. Its
admission includes a concrete model/runtime binding, allowed model references,
fresh access evidence, quota state where applicable, capability grants, budget
estimate and an explicit time. A known model override is rejected before
dispatch. Codex quota `unknown` or `exhausted` rejects automatic admission; a
human override must identify a bounded approval.

The initial model policy remains:

```text
MiniMax M2.5 → GLM-5 → Claude Opus 4.6
```

The contract records a canonical logical model reference and an invocation
binding separately. It does not probe a model as a side effect of selection.

## Capability operation

Every effect has an `operationId`, `attemptId`, immutable `scopeHash`,
`policyVersion`, deadline and a matching `CapabilityGrant`. Write-like effects
also require an attempt-owned, unexpired lease fence equal to the controller's
current resource fence. The v1 fixture explicitly
denies ungranted read/write operations, shell, child creation and scheduling.
Runtime built-ins and indirect paths must map to the same operation vocabulary
before a real runtime is admitted.

The node envelope is intentionally absent from the core contract's path model:
the controller sends canonical resource references and the node resolves
allowlisted installation-local roots. Personal absolute paths, credentials and
network topology do not enter the portable admission record.

## Budget and transaction ordering

Before dispatch, the future StateStore transaction must atomically claim the
attempt, reserve the estimate, acquire the lease fence and append a dispatch
outbox record. A fixture can model these values in memory, but it is not a
production persistence implementation. All retries, auxiliary model calls and
children consume the same root budget.

## Receipt and recovery

`OperationReceipt` is keyed by `operationId` and carries the attempt, scope and
effect hash. The same receipt is a duplicate, a mismatched receipt is a conflict.
If an effect may have happened but its receipt is missing, reconciliation returns
`uncertain`; it must not blindly replay a non-idempotent effect. Receipt,
transition and audit event must later commit together.

## Cancellation and verification

Cancellation is `requested` until the runtime/node acknowledges termination.
Changing a task status alone does not stop a process. A result is not admitted
until it has a verifier, evidence reference, timestamp and explicit pass/fail.

## Portability and non-goals

Two synthetic installations may use different runtime/account references while
sharing this contract. This v1 does not define SQLite, a remote transport, a
DeepSeek Harness adapter, Bedrock credentials, a scheduler, dynamic spawning,
repository worktrees or UI routes. Those consume this boundary in later slices.
