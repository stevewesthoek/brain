# Agent Mode U0-C1 Guarded Controls Evidence — 2026-09-14

## Scope and starting state

U0-C1 is the bounded Brain-owned lifecycle-control foundation for the first
U0 control slice. It does not add browser mutations, authenticated HTTP
mutations, live models, new autonomous behavior, or a second execution control
plane.

Starting repository HEAD was `ff862cb6 feat(agent-mode): add console drill-down
details`. The protected unrelated worktree state was preserved:
`tools/firecrawl/logs/firecrawl.log` remained modified, and the two unrelated
roadmap files remained untracked and untouched. K4, K5-A, K5-B, K5-C, U0-A,
and U0-B were already complete; no K0-K5 work was reopened and
`brain-node.ts` was not changed.

## Authentication and containment reconciliation

The repository remains in BS0.1 fail-closed containment. `routes.ts` documents
that localhost, browser Origin, and caller-supplied headers are not
authentication. The BS0.5 material currently present is a descriptive contract
registry, not a usable authenticated HTTP service identity. Classification:

```text
BS0.5 usable authenticated service identity: NOT IMPLEMENTED
HTTP lifecycle/review mutation surface: unavailable
Brain Console mutation controls: unavailable
```

The reserved paths `/agent-mode/control/run/:runId` and
`/agent-mode/control/review/:reviewId` are included in the existing
pre-body containment boundary. They return the established
`mutable_capability_contained` response with `requestBodyRead: false`. No
functional HTTP handler was added.

## Control-service contract

`projects/brain-core/src/agent-mode/agent-mode-control-service.ts` adds the
versioned `agent-mode-control-v1` contract. It exposes typed bounded commands
and receipts for:

- `pauseRun`
- `resumeRun`
- `cancelRun`
- `killRun`
- `decideReview`

Commands carry a bounded trusted actor (`cli`, `operator`, or `service`),
bounded target/reason fields, and an injected deterministic timestamp. Model
actors are rejected. Operation IDs can be supplied for redelivery and a
deterministic SHA-256 derivation helper is available for the same bounded
command material.

The service composes the existing StateStore lifecycle methods and
`recordReviewDecision`. It does not insert Agent, Task, Run, or Attempt rows,
reserve budgets, dispatch runtimes, create Workcells, or create a result
ledger. Control receipts and kill signal state are stored as bounded events in
the existing Agent Mode `events` stream, not in a second audit database.

## Lifecycle semantics

Pause, resume, cancel, and kill preserve the prior StateStore semantics. Resume
requires verified ownership of the exact durable runtime identity and returns
`re_admission_required` without creating a replacement lifecycle when that
identity cannot be verified. Cancel retains the controller-absent recovery
acknowledgement path. Kill accepts only the durable run identity; it records
kill state before attempting `SIGTERM`, records the signal outcome, and never
blindly signals again for a stored operation. Concurrent/stale changes are
checked against the durable run before the control is applied.

Review decisions are passed to the existing `recordReviewDecision` path. Its
durable review receipts/events and existing worker/model self-approval
restrictions remain authoritative; the service adds only a bounded control
receipt around that operation.

The CLI commands `brain-agent pause|resume|cancel|kill RUN_ID` now route
through this service. Existing JSON operation/status/recovery output remains
compatible, with optional bounded `--operation-id` and `--reason` flags.

## Tests and side-effect audit

The new focused control suite and affected containment/CLI regression suite
passed:

```text
18/18 tests passed
```

This includes deterministic operation identity, durable receipt idempotency and
conflict handling, restart-safe unverified kill behavior, runtime identity
checks, review-service delegation, malformed-command fail-closed behavior, the
existing CLI lifecycle contract, and both reserved HTTP control paths failing
closed before request-body read.

The existing K3.5 review suite remains the authority for real review-request
lineage, worker self-approval, model self-approval, receipt, and rejection
semantics. The existing K4 lifecycle controls remain green in the focused
regression run. No model, ModelGateway, provider, Harness, BrainNode,
Workcell, network, scheduler, budget, Agent, Task, Run, or Attempt side effect
was introduced by the service tests.

## Files and architecture review

The scoped implementation consists of the control service, CLI composition,
the BS0.1 containment route classification, focused tests, and the U0-C1
documentation updates. A source search found no direct Agent/Task/Run/Attempt
insertions in the service, no provider/model invocation, no Harness or
BrainNode call, no Workcell creation, no arbitrary PID input, no free-form
agent messaging, and no protected unrelated path staged.

The Brain Console remains an observer. No control buttons, browser persistence,
new HTTP client, or Console-owned authority was added. Existing `/agents`
read-only behavior is unchanged.

## Completion decision

```text
U0-C1: COMPLETE — shared Brain-owned guarded control service and CLI seam
U0-C:  IN PROGRESS — authenticated network/Console action gate not enabled
U0:    IN PROGRESS
```

The exact next prerequisite is the authoritative BS0.5 authenticated service
identity contract. Once usable, a later bounded U0-C slice may add authenticated
HTTP and Console mutation actions. Do not replace that prerequisite with
localhost, Origin, or browser-header trust.
