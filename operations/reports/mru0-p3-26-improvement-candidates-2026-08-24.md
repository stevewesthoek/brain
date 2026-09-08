# MRU0-P3.26 Improvement Candidates

Candidates are ordered by evidence from the first real usage pass. They are not implementation authorization.

## Immediate fixes

1. Reconcile provenance propagation between the real ingestion envelope, unified review workflow, and calibration contract. Evidence: all 11 workflow items generated `missing_provenance` signals despite source hashes and references existing at ingestion.
2. Document one bounded operator sequence for running the existing ingestion, review, briefing, daily-loop, and calibration commands. Evidence: the first pass required separate commands and produced a pending queue without a single review-session entry point.
3. Add usage guidance for the human decision boundary, including how reasons and source references are recorded. Evidence: all 11 real items remained `new`; no terminal decision evidence exists yet.

## Future capabilities

- GitHub intelligence, only after a separate authorization and evidence review;
- richer media ingestion, only where real source demand is demonstrated;
- video understanding, not evidenced by this pass;
- conversation-mining improvements, not evidenced by this pass;
- dashboard shortcuts for review operations, after repeated manual-friction evidence.

## Experimental ideas

None authorized. The current evidence does not justify speculative intelligence or autonomous-maintenance work.

## Safety boundary

No candidate authorizes automatic decisions, Mind writes, Brain canonical writes, promotion, scheduling, provider calls, new storage, or autonomous actions.
