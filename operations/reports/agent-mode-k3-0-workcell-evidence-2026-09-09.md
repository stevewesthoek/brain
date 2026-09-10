# Agent Mode K3.0 Workcell Evidence — 2026-09-09

## Decision

**K3.0 status: COMPLETE for the Safe Coding Workcell Foundation.**

This tranche adds durable isolated Git Workcells only. It does not add coding
agents, direct repository writes, merge, approval, deployment, shell, arbitrary
commands, scheduling, routing, model changes, or commits/pushes.

## Architecture

`WorkcellManager` is a deterministic lifecycle seam over the existing
`AgentModeSqliteStateStore`. The StateStore remains the sole authority and now
contains `workcells` and `workcell_receipts` tables in the same SQLite WAL
database. No second database, ledger, or control plane was introduced.

The Git implementation is `GitCliWorkcellAdapter`. It invokes only fixed
`git -C ...` repository/worktree operations through the non-shell child-process
API. The adapter is injectable, so lifecycle and failure behavior can be
tested without making a live checkout the test target.

Workcell identity fields are:

```text
workcellId, taskId, runId, attemptId, repositoryRef, repositoryRoot,
worktreePath, branch, ownerAgent, createdAt, updatedAt, status, baseRef
```

Allowed statuses are exactly:

```text
created, prepared, active, testing, awaiting_review, approved, merged,
discarded, failed
```

K3.0 transitions only `created → prepared`, `created → failed`, and
`prepared → discarded` (with safe idempotent inspection/destruction behavior).
The future statuses are represented for the domain contract but cannot be
promoted by this tranche.

## Safety and isolation

- Repository binding is explicit and must match the canonical Git root.
- Workcells root is explicit and must be outside the primary checkout.
- Workcell paths are generated as `agent-task-<uuid>` below that root.
- Branches are generated as `codex/workcell/<uuid>`; protected branch names and
  invalid refs fail closed.
- A durable owner check prevents another agent from preparing or destroying a
  Workcell.
- Destroy validates the exact repository/branch binding and refuses dirty
  Workcells; it never accepts a caller-supplied arbitrary path.
- The primary checkout cannot be a target because in-checkout roots and the
  checkout itself are rejected before Git preparation.
- No Workcell write command is exposed. `repo.write(workcell)` is a future
  scoped capability name only; `repo.write(main)`, shell, and arbitrary process
  capabilities are not admitted.

## Lifecycle and receipts

`create` reserves the identity durably and records `WorkcellCreatedReceipt`.
`prepare` creates and validates the isolated Git worktree, then records
`WorkcellPreparedReceipt`. `inspect` validates the recorded binding and records
`ValidationReceipt`. `destroy` removes only a matching clean worktree and
records `WorkcellDestroyedReceipt`. Recovery observations also use
`ValidationReceipt`.

Every receipt contains task/run/attempt/workcell/repository/actor lineage,
timestamp, operation hash, and result state. Receipt JSON contains no secret
material. Receipts survive StateStore close/reopen and are also accompanied by
append-only Workcell events where a lifecycle transition occurs.

## Crash recovery and cleanup

Creation is durable before any Git worktree side effect, so interruption before
preparation leaves a controlled `created` record rather than an uncontrolled
workspace. If preparation creates a partial exact target and fails, cleanup is
permitted only when that target was absent before the attempt. A foreign or
pre-existing path is never recursively removed.

Stale Workcells are detected by durable timestamp. Recovery of a stale `created`
record either promotes an exact matching existing Git worktree to `prepared` or
marks the record `failed` without deleting a mismatched path. No blind replay or
automatic merge/approval occurs.

## Validation

Focused K3.0 test file: `projects/brain-core/src/tests/workcell.test.ts`

| Gate | Result |
|---|---:|
| Focused Workcell tests | 14/14 passed |
| Focused StateStore + Workcell compiled tests | 24/24 passed |
| TypeScript typecheck after implementation | passed |
| Full Brain Core suite | 2,060/2,066 passed; 6 unrelated pre-existing failures |
| Model calls / Bedrock spend | 0 |
| Primary checkout used as a Workcell target | 0 |
| Commits or pushes | 0 |

The 14 tests cover creation, unique durable identity, explicit repository
binding, isolated branch/worktree, primary-checkout rejection, invalid refs,
agent ownership, targeted destruction, dirty-destroy refusal, validation
receipts, stale detection/recovery, failed-preparation cleanup, receipt
reopen-persistence, and capability/shell fail-closed behavior.

The full suite failures are limited to existing orchestration executor tests and
one existing Video Orchestrator metadata expectation; no K3.0 test failed and
those areas were not changed by this tranche.

## Files changed for K3.0

- `projects/brain-core/src/agent-mode/sqlite-state-store.ts`
- `projects/brain-core/src/agent-mode/workcell.ts`
- `projects/brain-core/src/bin/brain-agent.ts`
- `projects/brain-core/src/tests/workcell.test.ts`
- `projects/brain-core/src/tests/sqlite-state-store.test.ts`
- `operations/specs/agent-mode-runtime-roadmap.md`
- `docs/product/agent-mode-progress.md`
- `operations/runbooks/agent-mode-runtime-surfaces.md`
- this evidence report

## Remaining K3

K3.1 remains unstarted: controlled Workcell writer leases, deterministic
validation, diff/evidence admission, preimage/snapshot drift checks, and an
explicit human commit/merge approval boundary. K3.1 must preserve the same
StateStore authority and must not broaden into production writes or deployment.

**Exact next task:** K3.1 — implement one active Workcell writer lease with
stale-writer fencing, deterministic validation, and diff/evidence admission.
