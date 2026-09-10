# Agent Mode K3.5-B Review and Approval Evidence — 2026-09-09

## Status

**K3.5-B COMPLETE. K3 remains IN PROGRESS.** This gate implements and proves
only the durable review and approval boundary. Commit, merge, target-ref
mutation, push, and K4 are not part of this acceptance.

## Review model

`AgentModeReviewRequest` is a single exact candidate binding: review ID, task,
run, attempt, worker identity, Workcell, repository, branch, base revision,
current revision, diff ID/hash, validation ID/evidence hash, requesting actor,
timestamps, and lifecycle status. A request can be approved only while its
candidate and passed validation evidence remain current.

The existing SQLite WAL StateStore remains the sole authority. It persists
review requests, one decision per review, exact evidence bindings, and
`ReviewRequestedReceipt`, `ReviewApprovedReceipt`, and
`ReviewRejectedReceipt` records. Existing databases migrate the added worker
identity column without creating a second store.

`WorkcellPromotionManager` is restricted to explicit Brain-controlled
decisions for this gate. Coding models cannot create requests or decisions,
and a worker cannot approve its own Workcell. Approval is never automatic.
Duplicate decisions replay the original durable decision; conflicting
decisions are rejected.

## Stale-candidate behavior

Approval is bound to the exact diff and validation evidence, not merely to a
Workcell, worker, or task. `refreshReview` rechecks the latest diff,
validation ID/result/evidence hash, and the current Workcell candidate. A
mutation, changed diff, changed validation evidence, failed validation, or
unverifiable Workcell marks the request `stale`. No automatic refresh or silent
reapproval occurs, and stale requests cannot become commit candidates.

## Deterministic verification

From `projects/brain-core`:

- `npm run typecheck` passed.
- `npm run build` passed.
- `node --test dist/tests/k3-5-b-review.test.js dist/tests/k3-5-concurrency-review-merge.test.js` passed **7/7**.
- The complete scoped K0/K3 deterministic gate, including K3.5-A and K3.5-B,
  passed **146/146**.
- The fixture uses no live model calls, shell capability, or real user repository.
- `git diff --check` passed.

The focused tests prove all requested cases:

1. a validated Workcell creates a request;
2. unvalidated evidence cannot create a request;
3. failed validation cannot be approved;
4. approval binds to the exact diff and validation evidence;
5. Workcell mutation marks approval stale;
6. validation drift marks approval stale;
7. self-approval and model approval are rejected;
8. duplicate approval is idempotent;
9. conflicting approval is rejected;
10. close/reopen preserves requests, decisions, and receipts;
11. the observer exposes approved and stale review state safely; and
12. two concurrent Workcells retain independent review bindings.

## Remaining K3.5 work

The remaining promotion gate is separate: Workcell commit, target-ref fencing,
merge authorization, and promotion restart/reconciliation evidence. K3.5-B
does not implement or authorize those effects.
