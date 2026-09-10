# Agent Mode K3.5-C Commit Authorization Evidence — 2026-09-09

## Status

**K3.5-C complete for its bounded gate.** This tranche implements and verifies
only durable authorization for committing an already-approved Workcell. Merge,
target-ref fencing, target branch mutation, push, and K4 remain out of scope.

## Authorization boundary

Before Git mutation, Brain requires:

- an existing Workcell bound to the repository root, branch, and worktree;
- the latest stored diff and matching passed validation evidence;
- an explicit Brain-controlled approved review and matching decision;
- an active, unexpired Workcell writer lease with the exact fence token,
  owner, and attempt;
- an unchanged Workcell repository binding, branch, parent revision, and
  candidate diff; and
- the approved Workcell state.

Failures are rejected before the Git effect and are recorded as bounded
`CommitRejectedReceipt` evidence when a Workcell exists. A commit message is
limited to 120 safe characters and the adapter stages only the approved file
scope. The adapter exposes fixed Git operations only; it has no shell, reset,
force, push, arbitrary Git, or target-ref command.

## Durable lifecycle and receipts

The Workcell lifecycle is:

```text
approved → committing → committed
```

The StateStore persists a commit operation and these receipt types:

- `CommitRequestedReceipt`
- `CommitCompletedReceipt`
- `CommitRejectedReceipt`
- `CommitReconciledReceipt`

The operation records its Workcell, branch, parent commit, approved diff hash,
validation evidence hash, review ID, actor, bounded message, resulting commit,
resulting tree revision, status, and receipt hash. Replaying a completed or
reconciled operation returns the durable result without another Git effect.
A different Workcell or candidate under the same operation ID rejects.

## Crash behavior

- A failure before Git leaves a prepared operation, no new commit, and a
  `committing` Workcell that can be retried with current authority.
- A failure after Git but before the completion receipt leaves the prepared
  operation and committed Workcell revision. A later call reconciles that
  revision as `reconciled` without creating a duplicate commit.

## Deterministic fixture gate

The new disposable-fixture file
`projects/brain-core/src/tests/k3-5-c-commit.test.ts` covers:

1. successful exact-candidate commit, receipt persistence, restart, and
   observer visibility;
2. missing/invalid authority, stale fence, candidate drift, and unsafe
   message rejection without target-checkout mutation;
3. successful replay idempotency and same-operation/different-candidate
   rejection;
4. pre-Git crash safety and post-Git crash reconciliation; and
5. two independent Workcells committing without target-checkout mutation.

## Verification

| Gate | Result |
|---|---|
| Brain Core typecheck | **passed** |
| Brain Core build | **passed** |
| K3.5 promotion suite (A, B, C, compatibility) | **13 passed, 0 failed** |
| K3.5-C focused suite | **5 passed, 0 failed** |
| `git diff --check` | **passed** |
| Live models or user repositories | **not used** |

Commands:

```text
npm run typecheck
npm run build
node --test dist/tests/k3-5-b-review.test.js dist/tests/k3-5-c-commit.test.js dist/tests/k3-5-concurrency-review-merge.test.js dist/tests/k3-5-a-concurrency.test.js
git diff --check
```

The bounded K3.5 gate passed with 13/13 tests. The K3.5-C test file passed
independently with 5/5 tests. Existing broader Agent Mode tests remain the
compatibility reference; no live acceptance or external repository mutation
was performed for this gate.

## Remaining work

K3 remains in progress. The next separately authorized work is target-ref
fencing and merge authorization/restart reconciliation. No merge, push, target
branch mutation, or K4 work is authorized by K3.5-C.
