# Agent Mode K4.1-C1 CI Workflow-Run Event Source Evidence — 2026-09-10

## Status

K4.1-C1 is complete for its bounded observation gate. K4 remains in progress.
K4.1-C2 — Event-Source Closure Audit and K4.2 Readiness Gate — is the exact
next task.

## Contract and provider seam

`CiWorkflowRunEventSourceAdapter` implements the existing shared
`EventSourceAdapter` contract with source type `ci.workflow-run`. The
provider-neutral `CiWorkflowRunObservation` contains bounded repository,
workflow, run/attempt, head revision, normalized status/conclusion, lifecycle
timestamps, and observation time. Provider payloads and unknown metadata are
not retained.

GitHub Actions is the first provider. `GitHubActionsCiObservationReader`
normalizes raw workflow-run records through an injected
`GitHubActionsWorkflowRunPageReader`; it owns no credentials, HTTP client,
webhook, listener, daemon, or network side effect. Agent Mode receives only
the normalized reader result. CI logs, artifacts, and workflow YAML are out of
scope.

## Cursor, bootstrap, and semantics

The existing EventSource watermark stores a version-1 JSON cursor containing
only a bounded provider cursor, bootstrap flag, pending normalized runs, and
at most 500 semantic run/attempt states. The encoded cursor is capped at 64
KiB. Provider pagination is capped at 8 pages and 500 items per observation;
the source catch-up limit bounds emitted scheduler events. `hasMore` is true
only when pending runs or provider pagination continuation remains.

Runs are ordered oldest-first by lifecycle timestamp, then deterministic run
ID and attempt. Bootstrap records historical runs 90 and 91 without emitting
history. A newly observed queued or in-progress run emits one
`ci.workflow.started`; completion emits one `ci.workflow.completed`. Equivalent
repeated observations are quiet. Run ID plus attempt is the durable identity,
so rerun attempts remain distinct. Older status or provider-update observations
cannot regress accepted semantic state.

## Failure and safety behavior

Provider/auth/rate-limit/timeout errors, malformed normalized data, invalid
cursors, pagination failures, repository or workflow binding mismatches, and
unknown workflow errors from the injected provider boundary fail closed. The
prior watermark is preserved, no fake scheduler event is created, and the
existing bounded source retry state is used. Malicious provider metadata is
ignored and cannot introduce executable payload keys, paths, URLs, handlers,
or commands.

The observer exposes bounded safe `ciWorkflowStates`; emitted scheduler rows
retain `source=<configured ci.workflow-run source>` and typed CI event origin.
The scheduler is destination-only. Heartbeat remains a no-op when no useful
work exists; ModelGateway calls, AgentRuntime calls, and worker creation are
zero for this observation-only source.

## Fixtures and conformance

`k4-1-c1-ci-event-source.test.ts` covers GitHub normalization, injected page
pagination, bootstrap, queued/in-progress/completed progression, failure and
rerun conclusions, attempt identity, bounded catch-up, stale observations,
failure preservation, malformed cursors, repository/pagination mismatch,
restart, observer projection, repeated no-op polling, and one shared
conformance probe across Git, lifecycle, host-health, and CI adapters.

## Validation

Focused CI suite: **11 passed, 0 failed**. Typecheck and build passed. The
broader K4/K4.1, persistence, observer, recovery, and infrastructure matrix
passed **100 tests, 0 failed**. The existing no-op heartbeat test passed with
zero model/runtime/worker/network/token calls. The suite used only deterministic
local fixtures and the bundled fallback Git runtime; no live GitHub read or
credential was used.

The post-implementation safety scan found no direct CI `fetch`, HTTP URL,
webhook, listener, daemon, timer, model, runtime, worker, or host-mutation
path. The pre-existing fixed Git reader remains the only shell-backed source
operation and is restricted to read-only Git commands.

## Roadmap state

K4.1-C1 is **COMPLETE**. K4 remains **IN PROGRESS**. Exact next task:
`K4.1-C2 — Event-Source Closure Audit and K4.2 Readiness Gate`.
