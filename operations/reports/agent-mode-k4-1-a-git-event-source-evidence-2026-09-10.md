# Agent Mode K4.1-A Git Event Source Evidence

Date: 2026-09-10  
Scope: K4.1-A only  
Status: **COMPLETE**; K4 remains in progress and K4.1-B is not started

## Decision

K4.1-A adds a generic durable `EventSourceAdapter` seam and exactly one
concrete source: the read-only local Git repository revision source
`git.repository.revision`. It converts bounded repository ancestry advances
into K4.0 typed scheduler events. It does not add CI, host, filesystem,
webhook, browser, voice, Mind, worker, model, daemon, or network behavior.

## EventSourceAdapter contract

`EventSourceAdapter<TEvent>` has stable `sourceId`, `sourceType`, and a finite
`observe(context)` method. Observations contain source identity, previous and
observed watermarks, a bounded event batch, `hasMore`, observed time, and a
structured status. The contract is source-neutral and can support later CI,
host-health, task, or webhook adapters without changing scheduler contracts.

Durable source configuration is stored in the existing Agent Mode SQLite WAL
StateStore. It contains source identity/type, canonical repository resource
reference, fixed adapter type, bounded debounce/cooldown/catch-up settings,
enabled state, and an optional explicit fixture bootstrap watermark. The
installation-specific repository root is an injected binding and is never
stored as durable domain identity.

## Git source behavior

`GitRepositoryEventSourceAdapter` uses only fixed-argv, non-shell, read-only
Git operations: inspect repository/HEAD/ref, verify ancestry, bounded
oldest-first `rev-list`, and bounded immutable commit metadata. It does not
fetch, pull, push, checkout, reset, merge, write refs, or read diffs/content.

The default bootstrap policy records current HEAD and emits zero historical
events. An explicit fixture watermark permits deterministic catch-up tests.
Future commits produce `repository.commit.observed` events containing only
bounded safe metadata: repository reference, commit/parent identity, ref,
author, subject, commit time, observation sequence, and debounce-group ID.
Commit text remains inert data and is never mapped to commands, handlers,
models, capabilities, or paths.

When multiple commits are unseen, the source emits oldest-first and limits each
observation to `catchUpLimit`; `hasMore` remains true and the durable watermark
advances only to the last emitted commit. The next poll resumes from there.

## Watermark, debounce, cooldown, and failure semantics

The source uses the existing K4.0 source-watermark seam. Successful durable
ingestion and watermark advancement occur in one StateStore transaction;
conflicts roll back the advancement. Repeated source polls use source plus
repository plus commit identity and K4.0 deduplication, so one logical commit
maps to one scheduler event.

Individual commit events remain durable. Commits observed in the same injected
debounce bucket share a deterministic debounce-group identity for later action
grouping. A configured cooldown persists a deterministic not-before time and
prevents immediate repolling without a timer or daemon.

If the stored watermark is not an ancestor of current HEAD, the source returns
structured `diverged` state, preserves the prior watermark, emits no normal
events, and does not reset or replay history. Repository/read/metadata errors
record bounded `failed` source state and deterministic finite retry eligibility;
one failed source does not prevent other bounded sources from being observed.

## Operator surface and observability

```text
brain-agent sources poll --once \
  --source-id SOURCE --repository-ref REPOSITORY --repository-root PATH \
  [--debounce-ms N] [--cooldown-ms N] [--catch-up-limit N]
```

The command performs one bounded source pass and exits. It does not support a
watch, forever mode, background process, or daemon. The existing K4.0
`heartbeat --once` remains a no-op scheduler heartbeat when no scheduler work
is due; K4.1-A source polling is an explicit bounded operator operation.

The read-only Agent Mode observer exposes source ID/type, repository reference,
enabled/status, watermark, last observation/success/error, cooldown and next
eligibility, catch-up state, failure attempts, and last emitted count. No
absolute path, secret, or credential is projected.

## Focused validation

Command:

```text
cd projects/brain-core
npm run build
node --test --test-timeout=60000 \
  dist/tests/k4-1-a-git-event-source.test.js \
  dist/tests/k4-0-scheduler-heartbeat.test.js \
  dist/tests/sqlite-state-store.test.js
```

Result: **34 passed, 0 failed** for the focused K4.1-A, K4.0, and StateStore
set. The K4.1-A file contains 11 tests covering the 30 requested matrix
properties across bootstrap, durable commit events, duplicate polls, ordered
bounded catch-up, explicit fixture watermark, deterministic debounce/cooldown,
divergence, independent source failure, malicious metadata, restart/observer,
no-op polling, CLI behavior, and read-only Git constraints.

The final broader K0–K3.8 regression set passed **78/78** when rerun with the
K4.1-A tests included. Typecheck, build, syntax, diff, and forbidden-pattern
safety scans also passed. No model or external network call was made.

## Remaining K4 status

K4.1-A is **COMPLETE**. K4 remains **IN PROGRESS**. The exact next task is
**K4.1-B — internal task/lifecycle and host-health event sources with shared
source-adapter conformance**. Do not start it automatically. Dynamic workers
remain later.
