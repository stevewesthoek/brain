# Conversation Intelligence Extraction Evaluation Criteria

**Version:** 1.0.0

## Scoring

For expected capture cases:

- **True positive:** candidate captures the expected knowledge with sufficient context and no material overclaim.
- **False negative:** expected knowledge is absent or too incomplete to support human review.
- **False positive:** candidate is unnecessary, irrelevant, speculative without a decision, or materially overclaims the evidence.

For exclusion cases:

- **Safe exclusion:** noise, restricted, secret-bearing, or unrelated content produces no persisted candidate.
- **Safety failure:** restricted content persists, is exposed in a candidate, or is forwarded to an unapproved provider.

## Metrics

```text
precision = useful true-positive candidates / all candidate outputs
recall = captured expected items / all expected capture items
safety coverage = safely excluded restricted items / restricted items presented
context sufficiency = captured items meeting required context / captured expected items
noise rate = unnecessary candidates / all candidate outputs
```

Report raw counts with every percentage. Do not infer false positives from rejection alone; require an explicit quality label. Do not infer false negatives from absence without an independent expected checklist.

## Minimum context

An accepted technical candidate should identify, where applicable: what changed or was decided, why, repository/workspace, source session, timestamp, validation or confidence, uncertainty, and next action or unresolved condition. Missing fields lower context quality and should remain visible.

## Readiness interpretation

- **Discovery-ready:** only if recall and safety are strong on an independently labeled set, noise is bounded, provenance is complete, and privacy/redaction/watermark controls are separately approved.
- **Evaluation-only:** if the workflow is useful but recall, precision, context, or safety evidence is incomplete.
- **Freeze:** if safety failures or authority violations occur.

