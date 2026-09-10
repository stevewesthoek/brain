# Agent Mode K4.1-A Landing Evidence — 2026-09-10

## Status

Landing complete for the reviewed K4.0 durable scheduler/heartbeat foundation and
K4.1-A Git repository event source. No K4.1-B implementation was included.

## Pre-landing reconciliation

The pre-landing worktree contained exactly 12 expected paths: 6 modified tracked
files and 6 untracked K4.0/K4.1-A files. No unrelated paths were present. The
candidate set was classified as implementation/tests plus the K4 roadmap,
runbook, progress, and evidence documents.

## Fresh validation

Run from `projects/brain-core` with the bundled fallback Git fixture path because
the system Git shim is blocked by the local macOS Xcode license prompt:

```text
npm run typecheck
npm run build
node --test --test-timeout=60000 dist/tests/k4-1-a-git-event-source.test.js dist/tests/k4-0-scheduler-heartbeat.test.js dist/tests/sqlite-state-store.test.js dist/tests/agent-mode-contracts.test.js dist/tests/agent-mode-controls.test.js dist/tests/agent-mode-node-transport.test.js dist/tests/agent-mode-observer.test.js dist/tests/agent-mode-process-recovery.test.js dist/tests/k3-5-a-concurrency.test.js dist/tests/k3-5-b-review.test.js dist/tests/k3-5-c-commit.test.js dist/tests/k3-5-d-merge.test.js
```

Result: 78 passed, 0 failed. Typecheck and build passed. The initial run without
the bundled Git fixture path failed only because the macOS Xcode license shim
intercepted fixture `git` calls; the corrected run passed completely.

## Safety and secret checks

Secret-pattern scan and unsafe-runtime scan passed for the candidate files. No
credentials, private keys, unsafe loops/watchers, shell invocation, server
listener, model/runtime path, or network path were introduced. The Git source
uses a fixed-argument, read-only subprocess boundary.

## Landing commits

- `ca062711` — `feat(agent-mode): land durable scheduler and git event source`
- `679514fa` — `docs(agent-mode): record K4 event foundation`
- `e256ea89` — `docs(agent-mode): finalize K4.1-A landing evidence`

## Post-landing verification

Post-landing smoke passed after the documentation commit:

```text
npm run typecheck
npm run build
node --test --test-timeout=60000 dist/tests/k4-0-scheduler-heartbeat.test.js dist/tests/k4-1-a-git-event-source.test.js
```

Result: 24 passed, 0 failed. The worktree was clean after the documentation
commit; `git diff --check` was clean for the final working-tree diff. The final
evidence update is the only remaining scoped change.

## Readiness

K4.0 is COMPLETE. K4.1-A is COMPLETE. K4 remains IN PROGRESS. K4.1-B is NOT
STARTED. The exact next task is:

`K4.1-B1 — Internal Task/Lifecycle Event Source and Shared EventSourceAdapter Conformance`
