# Agent Mode K4.1-B1 Lifecycle Event Source Evidence — 2026-09-10

## Status

K4.1-B1 is complete for its bounded gate. K4 remains in progress. K4.1-B2,
host-health sources, workers, models, daemons, and network polling were not
implemented.

## Internal lifecycle source

`InternalLifecycleEventSourceAdapter` implements the existing
`EventSourceAdapter` contract with stable source type/ID `brain.task.lifecycle`.
It reads only the authoritative append-only `events` table, never scheduler
event rows or source bookkeeping. The eligible set is deliberately narrow:
`attempt_admitted`, `attempt_started`, `attempt_finished`, cancellation request
and acknowledgement, run pause/resume/cancel/kill, `controller_lost`, and
`attempt_readmitted_after_process_loss`, limited to Task/Run/Attempt entities.

Each observation is finite and returns previous/observed watermark, typed
events, `hasMore`, observed time, and status. Bootstrap records the current
highest event sequence and emits no historical events. The existing finite
operator surface supports `brain-agent sources poll --once
--source-type brain.task.lifecycle`.

## Sequence watermark and bounded catch-up

The watermark is the highest successfully ingested append-only event `sequence`.
The adapter uses a bounded scan window and the configured bounded emit limit;
it never uses `occurredAt` for ordering. Events are emitted in ascending
sequence order. Non-eligible rows advance the scan cursor without blocking a
later eligible row, while an un-emitted eligible row keeps `hasMore=true` and
leaves the watermark before that row.

Scheduler-event ingestion and source-watermark advancement share the existing
StateStore transaction. Duplicate source-event identity is handled by the
existing scheduler deduplication boundary. Conflicts, malformed payloads, and
failed ingestion preserve the previous watermark and record bounded failure
state.

## Fixtures and conformance

The focused B1 fixture suite proves bootstrap, new event mapping, deduplication,
bounded catch-up, truthful `hasMore`, filtering, pause/resume ordering,
cancellation/process-loss event ordering, malformed-event failure, failed
ingest preservation, restart recovery, observer reconstruction, finite CLI
polling, and no-op heartbeat behavior. The same source-neutral TypeScript
`EventSourceAdapter` contract remains used by both lifecycle and Git adapters;
the K4.1-A Git suite remains green in the combined regression run.

Scheduler destination rows are structurally separate from the lifecycle source
input, so lifecycle polling cannot consume its own emitted scheduler rows and
cannot form a recursive feedback loop.

## Runtime safety

The no-event CLI heartbeat returned `NO_ACTION`. No ModelGateway calls, no
AgentRuntime calls, and no workers were created. The source and tests contain
no daemon/listener, timer, watcher, shell, arbitrary handler, model, network,
host-health, or second-database path.

## Validation

From `projects/brain-core`:

```text
npm run typecheck
npm run build
node --test --test-timeout=60000 dist/tests/k4-1-b1-lifecycle-event-source.test.js dist/tests/k4-1-a-git-event-source.test.js dist/tests/k4-0-scheduler-heartbeat.test.js dist/tests/sqlite-state-store.test.js dist/tests/agent-mode-contracts.test.js dist/tests/agent-mode-controls.test.js dist/tests/agent-mode-node-transport.test.js dist/tests/agent-mode-observer.test.js dist/tests/agent-mode-process-recovery.test.js dist/tests/k3-5-a-concurrency.test.js dist/tests/k3-5-b-review.test.js dist/tests/k3-5-c-commit.test.js dist/tests/k3-5-d-merge.test.js
```

Result: **88 passed, 0 failed**. Relevant safety/secret scans and
`git diff --check` passed. The explicit internal-source CLI bootstrap returned
zero emitted events at watermark `0`; the empty heartbeat returned `NO_ACTION`.
All normal validation used zero model calls and zero network calls.

## Roadmap state

K4.1-B1 is **COMPLETE**. K4 remains **IN PROGRESS**. Exact next task:

`K4.1-B2 — Host-Health Event Source Using Existing Infrastructure Health Bindings`
