# Mind Steward Unified Review Workflow

MRU0-P3.19 adds an explicit, human-operated workflow over the P3.17 unified review inbox and P3.18 intelligence briefing. It records workflow state and decision history without changing canonical Mind or Brain knowledge.

## Activation

Build a briefing with `buildUnifiedIntelligenceBriefing(projection)`, then call `buildReviewWorkflow({ briefing, previous })` from `tools/scripts/mind-steward-unified-review-workflow.mjs`. The optional `previous` array carries prior workflow artifacts so state and history continue across briefings.

Apply an explicit human action with `applyReviewAction(workflow, { reviewId, state, reason, decidedAt, reviewer, sourceReference })`. The allowed lifecycle states are `new`, `reviewing`, `accepted`, `rejected`, `deferred`, and `archived`. Terminal decisions (`accepted`, `rejected`, `deferred`, `archived`) require a reason, timestamp, reviewer, and matching source reference. `reviewing` records active review without deciding canonical meaning.

For local inspection, `writeReviewWorkflow` writes only:

- `runtime/local/mind-steward/unified-review/workflow-latest.json`
- `runtime/local/mind-steward/unified-review/workflow-latest.md`

These are runtime-local workflow artifacts, not a database or authority source. Evidence and prior decisions are retained; they are never deleted by this layer.

## Boundary

Workflow states describe review progress only. An `accepted` item remains subject to the existing decision-boundary transaction flow and is not automatic promotion. No action writes Mind, writes Brain canonical state, calls providers, changes clients, schedules work, or executes anything.

## Human loop

1. Generate the current briefing from the unified review inbox.
2. Build a workflow view, passing prior workflow artifacts when resuming.
3. Select an item and record `reviewing` or an explicit terminal decision.
4. Supply the source reference and a concise reason for every terminal decision.
5. Inspect the retained history and unresolved/deferred items before the next review session.
