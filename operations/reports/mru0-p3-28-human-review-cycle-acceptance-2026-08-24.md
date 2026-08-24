# MRU0-P3.28 Complete Human Review Operating Cycle

**Status:** ACCEPTED
**Date:** 2026-08-24

## Validated workflow

```text
Mind inbox/new
  -> ingestion envelope
  -> unified review projection
  -> daily review session
  -> evidence inspection
  -> explicit human decision
  -> runtime-local review history
  -> optional promotion candidate
  -> separate approval and receipt gate
```

No step writes Mind canonical knowledge automatically.

## Real-data cycle

The cycle used 11 real Markdown items from the Mind inbox. The daily review entrypoint discovered the batch, exposed source/evidence context, and retained the existing workflow state. Five explicit operator-validation decisions were recorded:

- reviewing: 1;
- accepted: 1;
- rejected: 1;
- deferred: 1;
- archived: 1;
- remaining new: 6.

Every non-new item has a review-history entry with state, reason, timestamp, reviewer, and matching source reference.

## Provenance integrity

All 11 workflow items preserve:

- source reference;
- source hash;
- original ingestion identity;
- timestamp;
- authority owner;
- confidence;
- freshness;
- uncertainty;
- evidence references.

The accepted item produced an in-memory promotion candidate retaining the same provenance and decision reference. No promotion artifact was written.

## Fail-closed checks

The following checks rejected as required:

- terminal decision without a reason;
- duplicate review identity;
- promotion candidate with missing source evidence/hash.

No automatic decision, automatic promotion, Mind write, Brain canonical write, provider call, or new storage authority occurred.

## Operator workflow measurement

For this cycle the operator used:

1. one daily-review command to ingest and assemble the queue;
2. one explicit decision command per decision, five times;
3. one bounded verification read of the resulting workflow and promotion boundary.

The entrypoint answers:

- what requires attention: reviewing, deferred, and new items;
- what entered the system: 11 source-linked envelopes;
- what decisions are waiting: 6 new plus 1 reviewing and 1 deferred;
- what has been reviewed: accepted, rejected, deferred, and archived records with history;
- what could become a promotion candidate: the accepted item, subject to separate approval.

Observed friction:

- decisions are still one command each rather than a single interactive batch form;
- source content itself is referenced, not rendered inline by the CLI;
- the daily entrypoint reports runtime-local state and does not perform canonical promotion.

These are bounded usability findings, not authorization for a new dashboard or autonomous workflow.

## Validation

- P3.27 checkpoint commit: `60a45ba2`;
- complete real-data cycle: PASS;
- provenance completeness across 11 items: PASS;
- lifecycle states and history: PASS;
- fail-closed decision/evidence/duplicate checks: PASS;
- focused and regression suite: 36/36 PASS;
- Brain Core typecheck: PASS;
- documentation consistency: PASS;
- `git diff --check`: PASS.

## Remaining limitations

- Human meaning and importance remain outside automatic classification.
- Promotion requires separate human approval and a receipt.
- The workflow does not move or modify Mind inbox files.
- Six items remain pending and require a future human review decision.
