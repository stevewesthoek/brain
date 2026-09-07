# CLR6 Learning Candidates Runbook

CLR6 is a local, provider-neutral, report-only aggregation path over selected
CLR5 evidence. It is safe to replay and does not write Mind, Brain canonical
content, or IKHP state.

## Focused validation

```bash
node --test tools/context-learning/learning-candidate-engine.test.mjs
npm run validate:context-learning-contracts
```

To validate a runtime-local report:

```bash
node tools/validate-learning-candidates.mjs \
  runtime/local/mind-steward/learning-candidate-reports/latest.json
```

The report includes candidate counts, strengthened/conflicted/stale states,
source diversity, relation candidates, infrastructure routing, retractions,
and report-only invariants. Runtime-local artifacts remain disposable and are
not committed.

## Operating boundaries

- Input is bounded normalized evidence, not a transcript or session-root scan.
- Exact replay merges evidence references; similar wording is not fuzzy-merged.
- Contradictions remain visible and require review.
- Co-occurrence is weak and cannot become a strong relation through repetition.
- `ikhp:evidence-candidate` is review routing, not IKHP mutation.
- Canonical comparison is read-only; CLR6 does not call Apply-one or promote.
- Source deletion/retraction updates active support while preserving a receipt.
- Compaction preserves provenance, counts, contradictions, time range, and
  rebuildability.
