# Mind Steward Daily Review

The daily review entrypoint composes the existing report-only ingestion, unified review, briefing, workflow, daily-loop, calibration, and readiness stages. It writes only runtime-local Brain artifacts; it does not write Mind or Brain canonical sources.

## Run a review session

From the Brain repository:

```bash
MIND_STEWARD_MIND_ROOT=/Users/Office/Repos/stevewesthoek/mind \
node tools/scripts/mind-steward-daily-review.mjs
```

The output includes readiness, pending items, source/evidence references, provenance, required actions, and review counts. Detailed artifacts remain under `runtime/local/mind-steward/`.

## Record a human decision

Use the exact `review_id` and source reference from the session output:

```bash
node tools/scripts/mind-steward-daily-review.mjs \
  --decision REVIEW_ID STATE REASON REVIEWER SOURCE_REFERENCE
```

`STATE` must be `accepted`, `rejected`, `deferred`, or `archived`. Terminal decisions require a reason. This updates the runtime-local workflow artifact only. It does not promote memory, write Mind, write Brain canonical state, call providers, or execute actions.

For a bounded operator session with several explicit decisions, prepare a JSON array and apply it in one validated batch:

```json
[
  {
    "reviewId": "REVIEW_ID",
    "state": "deferred",
    "reason": "Needs Mind context",
    "reviewer": "operator",
    "sourceReference": "mind/inbox/new/example.md"
  }
]
```

Then run:

```bash
node tools/scripts/mind-steward-daily-review.mjs --decisions-file /path/to/decisions.json
```

The complete batch is validated before the runtime-local workflow is written. Every decision still requires an explicit reason, reviewer, and matching source reference; no canonical Mind or Brain state is changed.

## Boundary

An accepted review is still only eligible for a separately approved promotion candidate. Promotion remains human-authorized and receipt-gated.
