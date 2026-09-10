# Agent Mode K4.0 Scheduler and No-Op Heartbeat Evidence

Date: 2026-09-10  
Scope: K4.0 only  
Status: **COMPLETE**; K4 remains in progress and K4.1 is not started

## Decision

K4.0 adds the smallest durable event/scheduler substrate to the existing Agent
Mode SQLite WAL StateStore. It does not add event-source adapters, dynamic
workers, autonomous model calls, a daemon, a LaunchAgent, external watchers,
provider retries, voice/media work, Brain Console, or Mind work.

## Implemented boundary

- `agent_mode_scheduler_events` and `agent_mode_scheduler_schedules` are
  durable queue state in the authoritative StateStore; no second database or
  append-only event log was introduced.
- Event envelopes and schedules require `payloadVersion: k4.0`, bounded JSON,
  bounded depth/size, immutable content hashes, source/key deduplication, and
  conflict rejection. Executable-shaped payload keys fail closed.
- Queue claims use the existing `leases` table and monotonic fence counter.
  Claim owner, fence, expiry, attempt count, retry state, completion, and dead
  letter state survive close/reopen. Stale claimants cannot settle.
- Retry backoff is deterministic and capped. Max attempts and deadlines produce
  durable dead letters with reason, attempts, timestamp, and queue identity.
- Source watermarks are a monotonic storage seam only; no source watcher or
  polling loop was added.
- `runAgentModeSchedulerTick` performs one bounded pass with injected/current
  time, bounded item/attempt limits, deterministic ordering, and a closed
  handler registry containing only `agent_mode.test.noop`.
- `brain-agent heartbeat --once` and `brain-agent scheduler tick` open the
  existing StateStore, run one tick, print JSON, and exit. Missing state reports
  `NO_ACTION` without creating a database.
- Observer state exposes queue counts/items, claims, retries, dead letters,
  source watermarks, and the latest tick/no-op summary through the existing
  read-only Agent Mode projection.

## Focused verification

Command:

```text
cd projects/brain-core
npm run build
node --test --test-timeout=60000 \
  dist/tests/k4-0-scheduler-heartbeat.test.js \
  dist/tests/sqlite-state-store.test.js \
  dist/tests/agent-mode-contracts.test.js \
  dist/tests/agent-mode-controls.test.js \
  dist/tests/agent-mode-node-transport.test.js \
  dist/tests/agent-mode-observer.test.js \
  dist/tests/agent-mode-process-recovery.test.js \
  dist/tests/k3-5-a-concurrency.test.js \
  dist/tests/k3-5-b-review.test.js \
  dist/tests/k3-5-c-commit.test.js \
  dist/tests/k3-5-d-merge.test.js
```

Result: **67 passed, 0 failed**.

The K4.0 test file covers durable ingestion, duplicate/conflicting identity,
future and due schedules, deterministic ordering, bounded ticks, concurrent
claims, live-claim rejection, expired-claim recovery, fresh fencing, stale
settlement rejection, deterministic retry, max-attempt dead lettering, unknown
handler dead lettering, monotonic watermarks, observer projection, no-op CLI,
crash-before-settlement replay of the internal no-effect fixture, and payload
shape bounds.

No live model, provider, network, worker, shell, repository, token, or cost
operation was used. The no-op test invokes only the fixed local Node CLI against
a disposable temporary StateStore and asserts `NO_ACTION` with zero claimed
items.

## Safety audit

The changed K4.0 scheduler/CLI path contains no `while(true)`, hidden
`setInterval`, server/listener, `shell: true`, unrestricted child execution,
provider/model gateway import, AgentRuntime call, dynamic worker creation, or
payload-driven command dispatch. The only subprocess in the test is a fixed
`node dist/bin/brain-agent.js heartbeat --once` invocation for CLI proof. No
personal path is embedded in K4.0 source; tests use disposable temporary
directories.

## Changed files

- `projects/brain-core/src/agent-mode/sqlite-state-store.ts`
- `projects/brain-core/src/agent-mode/scheduler.ts`
- `projects/brain-core/src/agent-mode/agent-mode-observer.ts`
- `projects/brain-core/src/bin/brain-agent.ts`
- `projects/brain-core/src/tests/k4-0-scheduler-heartbeat.test.ts`
- `operations/specs/agent-mode-runtime-roadmap.md`
- `docs/product/agent-mode-progress.md`
- `operations/runbooks/agent-mode-runtime-surfaces.md`

## Completion decision

Fresh K4.0-R1 acceptance passed. The empty-StateStore heartbeat returned
`NO_ACTION` with `considered: 0`, `claimed: 0`, `completed: 0`,
`deadLettered: 0`, and `noOp: true`; the process exited successfully. No
ModelGateway, AgentRuntime, worker, model-token, cost, repository, or network
operation was used. K4.0 is **COMPLETE**.

## Remaining status

K4 remains **IN PROGRESS**. K4.1 is the next task: durable event-source
adapters, watermarks, debounce, and bounded catch-up. It must not start
automatically.
