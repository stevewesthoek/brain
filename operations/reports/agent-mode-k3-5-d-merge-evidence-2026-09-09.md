# Agent Mode K3.5-D Merge Authorization Evidence — 2026-09-09

## Status

**K3.5-D complete for its bounded gate.** This tranche implements only the
durable merge authorization and target-branch safety boundary. K4, dynamic
workers, scheduling, autonomous loops, push, deployment, and live model calls
were not used.

## Merge approval boundary

Merge approval is separate from Workcell commit approval. Each approval binds
one exact candidate to:

- approval and merge operation IDs;
- repository identity, source Workcell, source branch, and source commit SHA;
- the reviewed diff hash and validation ID/evidence hash;
- target branch and expected target HEAD SHA;
- approving actor, creation time, and expiry/one-use status.

Creation rejects missing or incomplete committed-candidate evidence, mismatched
commit/review/validation bindings, model or worker approvers, unsafe target
refs, and a source branch used as its own target.

## Target safety and bounded effect

Immediately before acquiring authority, Brain verifies the target HEAD equals
the approval preimage. It acquires a StateStore target-ref lease scoped to the
repository/ref pair with a monotonic fence, rechecks the target HEAD after
acquisition, and only then invokes the fixed Git adapter. The adapter performs
only a bounded `merge --no-ff --no-edit` against the approved source branch;
there is no shell, arbitrary Git input, rebase, force operation, push, or model
selected merge strategy.

Different Workcells do not share a global lock. Only operations targeting the
same repository/ref contend for target authority; the loser rejects or becomes
stale without mutating the target.

## Durable operations and receipts

Merge operations persist the source commit, target-before and target-after
SHAs, source/target identity, review ID, validation ID, target fence token,
actor, status, reason, and receipt hash. The StateStore records:

- `MergeRequestedReceipt`
- `MergeCompletedReceipt`
- `MergeRejectedReceipt`
- `MergeReconciledReceipt`

Target drift marks the approval `stale`; it is not refreshed automatically.
Approval consumption is one-use. A same-candidate completed operation replays
idempotently, while a different approval or candidate under the same operation
ID rejects.

## Crash recovery

- A failure before the Git effect leaves the operation `prepared`, the target
  unchanged, and the active target authority available for a bounded retry.
- A failure after Git target mutation but before the completion receipt leaves
  the operation prepared and approval pending. Reconciliation requires the
  original target authority, verifies the source commit is included, records
  the observed target head, consumes the approval, and does not replay Git.
- Adapter conflicts are aborted by the fixed adapter, persisted as rejected
  operations/receipts, and release target authority.

## Deterministic fixture gate

`projects/brain-core/src/tests/k3-5-d-merge.test.ts` uses only disposable Git
repositories and deterministic MiniMax-shaped fixture gateways (no live
provider calls). It proves:

1. valid exact merge, receipt persistence, restart, and observer reconstruction;
2. missing/invalid approval and wrong source commit rejection;
3. target-head drift becomes stale approval without an extra merge;
4. target-ref fencing rejects concurrent target mutation;
5. independent source Workcells remain intact;
6. pre-merge crash leaves no target mutation;
7. post-merge crash reconciles without duplicate mutation;
8. duplicate merge replay is idempotent; and
9. Workcell-only commits cannot bypass the merge approval boundary.

## Verification

| Gate | Result |
|---|---|
| Brain Core typecheck | **passed** |
| Brain Core build | **passed** |
| K3.5-A/B/C and existing merge compatibility tests | **13 passed, 0 failed** |
| K3.5-D focused tests | **4 passed, 0 failed** |
| Combined K3.5 promotion tests | **17 passed, 0 failed** |
| `git diff --check` | **passed** |
| Restricted Git/shell scan | **passed** |
| Live MiniMax/GLM/Opus/Codex calls | **none** |
| Brain, Mind, or user repository mutation | **none** |

Commands:

```text
npm run typecheck
npm run build
node --test dist/tests/k3-5-a-concurrency.test.js dist/tests/k3-5-b-review.test.js dist/tests/k3-5-c-commit.test.js dist/tests/k3-5-concurrency-review-merge.test.js dist/tests/k3-5-d-merge.test.js
git diff --check
```

## K3 exit gate

K3 exit gate: **COMPLETE**. K3.5-A/B prove two concurrent isolated workers
and failed-validation non-promotion. K3.5-B/C/D prove the explicit review,
commit, merge, target-ref fencing, durability, stale-candidate, and restart/
reconciliation boundaries. K4 remains planned and must not start automatically.
