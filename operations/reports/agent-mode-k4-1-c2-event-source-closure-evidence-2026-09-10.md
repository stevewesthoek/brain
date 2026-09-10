# Agent Mode K4.1-C2 EventSource Closure Audit — 2026-09-10

## Decision

K4.1-C2 passes its closure gate. K4.1 is **COMPLETE**. K4 remains
**IN PROGRESS**. K4.2 is **CONDITIONALLY READY FOR POLICY-ONLY WORK**; no
AgentSpawnPolicy, worker, model, runtime, or live dispatch was implemented.

Exact next task:
`K4.2-A — AgentSpawnPolicy Domain, Static Role Templates and Deterministic
Spawn Admission`.

## Four-source observation architecture

The closed observation layer is:

```text
Git repository state       ─┐
Agent Mode lifecycle       ─┼─> shared EventSourceAdapter
Infrastructure health     ─┤       │
CI workflow-run evidence   ─┘       v
                              typed durable scheduler event
                                      v
                              K4.0 bounded scheduler
```

The four registered source types are `git.repository.revision`,
`brain.task.lifecycle`, `infrastructure.host-health`, and `ci.workflow-run`.
Every adapter exposes stable `sourceId`, `sourceType`, and one finite
`observe(context)` operation. The generic context carries source identity,
previous watermark, deterministic observation time, catch-up limit, debounce
window, and optional scan limit. The generic result carries previous/observed
watermarks, typed events, truthful `hasMore`, observation time, and one of
`bootstrapped`, `advanced`, `unchanged`, or `diverged`. Retry/backoff and
failure status are owned by the existing EventSource StateStore record, not by
the adapter contract. Cursor content remains adapter-specific by design.

## Cursor and bootstrap audit

| Source | Durable authority | Bootstrap policy | Later progress |
|---|---|---|---|
| Git | immutable commit SHA and ancestry | current HEAD, zero history events | oldest-first bounded ancestry catch-up; divergence fails closed |
| Lifecycle | append-only `events.sequence` | current highest sequence, zero history events | ascending bounded scan; irrelevant rows still advance the cursor |
| Host health | versioned bounded per-resource/provider/binding semantic state | current health baseline, zero transition events | status/freshness/condition transitions only |
| CI | versioned provider cursor, pending normalized runs, bounded run+attempt state | current workflow-run state, zero history events | oldest-first bounded pagination and semantic transitions |

All four cursors survive StateStore close/reopen. Successful scheduler-event
ingestion and source-watermark advancement share one transaction. A failed
observation or failed ingest leaves the prior cursor unchanged.

## Bounds, fairness, and no-op behavior

Per-source bounds remain intentionally different:

- Git scans at most `catchUpLimit + 1` commits and emits at most the configured
  catch-up limit (maximum 100).
- Lifecycle scans at most `catchUpLimit * 4`, capped at 500, and emits at most
  the configured limit.
- Host health scans at most its 500-state/binding bound and emits at most the
  configured limit.
- CI reads at most 500 items across at most 8 provider pages, stores at most
  500 semantic states and pending items, caps the cursor at 64 KiB, and emits
  at most the configured limit.

The combined source poll registers/processes at most 16 sources, applies a
15-second timeout to each injected observation, and defensively rejects any
adapter batch larger than that source's catch-up limit. Its source-pass event
ceiling is therefore 1,600 events. K4.0 scheduler ticks independently claim at
most 64 queue items. The default full pass orders sources by stable source ID;
within the registered bound, a backlogged or failing source cannot prevent
other eligible sources from being observed. A caller-requested smaller
`maxSources` is an explicit partial pass, not the production fairness mode.

All-sources-quiet polling followed by a scheduler tick produces `NO_ACTION`.
One or multiple active source events reach durable scheduler state, remain
bounded, and still create no workers or models. There is no timer-driven
polling loop.

## Failure isolation and feedback-loop closure

Git repository failure/divergence, malformed lifecycle rows, unavailable or
invalid health evidence, and CI provider/auth/rate-limit/timeout/malformed,
pagination, workflow, or repository failures remain source-local. The poll
loop records bounded failure/retry state and proceeds to other sources. No
source falsely advances its watermark, deletes scheduler rows, invokes a
model, or creates a worker.

Inputs are structurally separate from scheduler destinations:

- Git reads fixed-argv read-only Git repository inspection and ancestry.
- Lifecycle reads only canonical Agent Mode `events` rows, never scheduler
  rows or source bookkeeping.
- Host health reads the normalized infrastructure observation plane and
  admitted catalog/provider bindings.
- CI reads normalized workflow-run observations behind an injected provider
  reader; GitHub Actions raw records are normalized at that boundary.

Therefore the path is source evidence → adapter → scheduler row, never
scheduler row → same source → scheduler row.

## Event identity, payloads, and security

Scheduler rows use stable source/event identity and the existing immutable
source-plus-deduplication-key/content-hash boundary. Repeated observations do
not duplicate; conflicting immutable content returns conflict. Timestamps are
not the sole identity. Causation/correlation fields remain nullable and are
used only when natural: commit parent/debounce group, lifecycle attempt/run or
task, host binding/resource, and CI run-attempt/workflow. No artificial
`rootGoalId` is inferred.

Payloads are bounded by the existing `k4.0` JSON validator (32 KiB, bounded
depth, executable-shaped keys rejected). No source persists Git diffs/files,
model prompts/reasoning, raw health payloads, metrics arrays, CI logs,
artifacts, workflow YAML, credentials, keys, or environment dumps. Provider,
commit, workflow-name, condition-code, and task metadata remain inert data;
unknown fields are discarded and cannot select a handler, model, tool, shell,
path, capability, or agent identity. The only subprocess is the pre-existing
fixed non-shell read-only Git CLI boundary.

## Configuration and observer closure

Event source registration accepts only the four known adapter types, requires
`sourceType === adapterType`, and caps registrations at 16. Unknown handler
configuration fails closed. Disabled sources are not polled, do not advance,
retain their watermark, and resume from it when re-enabled. Immutable identity
drift returns conflict; a new source ID receives independent bootstrap state.

The read-only observer exposes source type/status, repository binding,
watermark, last successful observation, last error, catch-up state, emitted
count, bounded host-health states, bounded CI workflow states, and scheduler
event origin. It redacts paths, URLs, credentials, and private payload fields.

## K4.2 frozen input contract and readiness

K4.2 AgentSpawnPolicy may consume only the durable scheduler envelope:

```text
eventId, eventType, source, occurredAt, receivedAt,
causationId?, correlationId?, deduplicationKey, payloadVersion,
bounded typed payload, nextEligibleAt, deadline?, status, attemptCount,
maxAttempts, and durable delivery/claim identity.
```

It must not require provider credentials, raw provider payloads, Git command
access, infrastructure APIs, CI logs/artifacts/YAML, or mutable EventSource
internals. `correlationId` is a natural correlation only; source events do not
invent a root goal. K4.2-A must bind a root goal explicitly when a spawn
request has one, check durable task/run cancellation state before admission,
and add a deterministic global/root admission-deny (kill-switch) seam before
any worker creation. Existing StateStore task/run cancellation and budget
reservation state can be consulted; root-goal and kill-switch policy are not
silently fabricated by K4.1.

This makes K4.2 ready to begin with policy-only domain work, while live worker
creation remains outside the C2 boundary.

## Validation evidence

The new closure audit suite contains **7 passed, 0 failed** tests covering
four-adapter conformance, combined polling/fairness, timeout and oversized
batch bounds, failure isolation, disabled/re-enable behavior, identity drift,
combined restart/observer reconstruction, scheduler payload conflict, and
registration/configuration boundaries. The prior C1 suite contains **11
passed, 0 failed** tests.

The combined K4/K4.1, StateStore, observer, recovery, and infrastructure
regression matrix passed **107 passed, 0 failed** after the bounded closure
repairs. Brain Core typecheck and build passed. `git diff --check` passed. All
deterministic tests used zero external network, zero model calls, zero runtime
calls, zero workers, zero tokens, and zero model cost. No daemon, listener,
watcher, LaunchAgent, webhook, or live GitHub read was used.

## Completion

K4.1 is **COMPLETE**. K4 remains **IN PROGRESS**. K4.2 is **CONDITIONALLY
READY FOR POLICY-ONLY WORK**. No K4.2 implementation was started.
