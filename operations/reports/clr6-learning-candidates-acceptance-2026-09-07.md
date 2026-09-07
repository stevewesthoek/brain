# CLR6 Learning Candidates Acceptance — 2026-09-07

## Decision

`COMPLETE — REPORT_ONLY`

CLR6 is implemented as a bounded deterministic candidate/relation aggregation
and compaction path over normalized CLR5 evidence. No canonical Mind/Brain
content or IKHP catalog/state was changed.

## Implementation

- `tools/context-learning/learning-candidate-engine.mjs` derives deterministic
  candidate identities, aggregates independent support, preserves
  contradictions and freshness, compares existing canonical knowledge
  read-only, and emits relation observations.
- Explicit relations retain type, evidence, source diversity, provenance, and
  inference level. Co-occurrence remains weak.
- `compactLearningCandidates()` bounds evidence references and emits a
  provenance-preserving compaction receipt.
- Source deletion/retraction is represented without erasing the historical
  evidence reference.
- `operations/specs/infinite-brain-learning-candidate.v1.schema.json` and
  `tools/validate-learning-candidates.mjs` define and validate the report.

## Validation

- CLR6 synthetic suite: **15/15 passed**.
- Covered repeated independent support, duplicate replay, contradictions and
  newer verified contradiction, relation strengthening, weak co-occurrence,
  IKHP evidence routing, canonical support/no-op, canonical contradiction,
  user correction, redacted secret-bearing evidence, bounded compaction,
  source deletion/retraction, provider neutrality, and restart/replay.
- Report invariants assert zero Mind/Brain canonical writes, zero IKHP mutation,
  zero provider calls, no raw transcript storage, no new authority store, and
  no automatic promotion.
- CLR5 regression and context-learning contract validation remain required
  gates before integration.

## Explicit non-goals

CLR6 does not implement semantic-provider classification, canonical promotion,
Apply-one execution, automatic skill/rule/runbook writes, cache activation, or
CLR7 logical learning transactions. Review remains the authority boundary.
