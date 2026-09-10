# Agent Mode K3.3 Validation Evidence

**Date:** 2026-09-09
**Scope:** controlled Workcell validation framework only
**Decision:** COMPLETE for the K3.3 gate

## Capability and registry

The typed capability is `validation.run(workcell)`, defined alongside the
existing Workcell capability boundary. `WorkcellValidationManager` exposes the
controlled `run` and `reconcile` operations. It requires a durable Workcell,
exact repository/worktree authorization, owner/attempt, active lease, current
fence, and an existing K3.1 diff evidence record.

`WorkcellValidatorRegistry` is the sole profile registry. It currently
allowlists exactly one profile: `git.diff.integrity`. A profile contains only
an identifier, repository type, fixed allowed operation, timeout policy,
evidence bound, and evidence format. It contains no command string, shell
option, executable path, package script, or arbitrary model input.

## Allowed execution model

The built-in validator calls the existing `GitCliWorkcellAdapter` only through
its fixed non-shell `git` operations and only with the durable Workcell path and
base ref. It compares the observed base/current revisions, changed files, and
diff hash with the latest K3.1 diff evidence. It emits bounded deterministic
JSON evidence in `git-diff-integrity/v1` and a SHA-256 evidence hash.

The profile timeout is 15 seconds and evidence is capped at 32 KiB. No shell,
arbitrary command, package execution, LLM, coding agent, Codex, deployment,
merge, push, scheduler, or model-routing change was added.

## Durable lifecycle and receipts

The existing SQLite WAL StateStore is schema version 6 and remains the only
database. It persists `workcell_validations` and
`workcell_validation_receipts`, including lifecycle, profile, Workcell
lineage, diff binding, lease/fence, operation hash, result, evidence hash/JSON,
timestamps, and receipts. Receipt types are:

- `ValidationStartedReceipt`
- `ValidationCompletedReceipt`
- `ValidationRejectedReceipt`

Known validators produce passed/failed completed evidence. Unknown profiles,
missing diff evidence, invalid capability or binding, missing/expired/stale
lease, stale/destroyed Workcells, timeouts, interruptions, and diff drift fail
closed with rejected/interrupted evidence. Completed and rejected requests are
idempotent. A started validation recovered after a worker crash is marked
interrupted and cannot be promoted as success. Close/reopen preserves the
validation row, evidence, and receipt.

## Verification

Focused command:

```text
npm run typecheck
npm run build
node --test dist/tests/sqlite-state-store.test.js dist/tests/workcell.test.js dist/tests/workcell-writer.test.js dist/tests/workcell-file-mutation.test.js dist/tests/workcell-validation.test.js
```

Result: **77 passed, 0 failed** across the K0/K3.0/K3.1/K3.2/K3.3 focused
gate. The K3.3 validation fixture file contains **13 passed, 0 failed**
tests covering known validator success, diff drift, unknown profile, main and
wrong Workcell binding, invalid capability, missing diff, timeout, expired
lease, worker interruption/reconciliation, duplicate execution, completion
receipt replay, destroyed Workcell, StateStore restart, and static absence of
an arbitrary command surface.

No real user repository or primary checkout was used as a mutation/validation
fixture target; tests create temporary Git repositories and isolated
Workcells. No commits, pushes, deployments, or model calls occurred.

## Remaining K3 boundary

K3.3 stops after durable validation evidence. A successful validation is not a
review decision, approval, commit, merge, push, or deployment. Remaining K3
work is any future explicitly approved review/commit/merge boundary and broader
worker orchestration. K4 is the next roadmap phase. No autonomous coding agent
was started.
