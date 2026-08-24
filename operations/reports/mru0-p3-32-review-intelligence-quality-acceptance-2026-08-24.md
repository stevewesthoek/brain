# MRU0-P3.32 Review Intelligence Quality Acceptance

**Status:** ACCEPTED
**Date:** 2026-08-24
**Scope:** advisory review quality, signal interpretation, and measurement only

## Evidence reviewed

P3.32 used the real usage and review-cycle evidence from:

- P3.26 operational usage, friction, and improvement candidates;
- P3.27 workflow optimization;
- P3.28 human review cycle validation;
- P3.31 bounded evidence preview.

The real cycle contained 11 source-linked items, with five explicit operator-validation decisions: one reviewing, one accepted, one rejected, one deferred, and one archived. Six items remained new. P3.31 made bounded source context available while preserving source hashes and provenance.

## Quality improvements

### Advisory attention context

The existing unified briefing now exposes, for every item:

- a plain-language attention summary;
- explicit evidence reasons for its group;
- producer-reported confidence interpretation;
- freshness interpretation;
- uncertainty handling guidance;
- evidence-preview availability or failure reason.

The existing deterministic group order and evidence-signal policy remain unchanged. No human-importance score or autonomous ranking authority was introduced.

### Measurement clarity

Operational calibration now distinguishes:

- accepted, rejected, deferred, repeated, stale, missing-context, duplicate, missing-provenance, and failed-ingestion signals;
- available and unavailable evidence previews;
- false-positive measurement as `not_instrumented`;
- preview usage as `not_instrumented`.

This prevents a human rejection from being mislabeled as a false positive and prevents preview availability from being misrepresented as preview usage.

### Workflow propagation

The advisory review context now follows the existing briefing into the workflow, daily review session, and daily intelligence loop. It remains derived context and does not become canonical state.

## What improved

- Attention reasons are easier to understand without changing selection authority.
- Confidence and freshness are interpreted consistently.
- Uncertainty is explicitly framed as a human review obligation.
- Evidence preview availability is visible alongside quality signals.
- Empty/uninstrumented metrics are reported honestly instead of being inferred.

## Safety and authority

Preserved invariants:

- `writes_to_mind=false`;
- `writes_to_brain_canonical=false`;
- `automatic_decisions=false`;
- `automatic_promotion=false`;
- `provider_calls=false`;
- `new_storage_authority=false`.

No new ingestion source, database, intelligence layer, autonomous ranking, provider call, or canonical write was added. Human decisions remain the only acceptance/rejection/defer/archive authority.

## Validation

- Mind Steward review, preview, workflow, briefing, daily loop, calibration, readiness, ingestion, and projection regressions: **31/31 PASS**;
- Brain Core TypeScript typecheck: **PASS**;
- Brain Console was not modified in this packet; its prior P3.31 typecheck/build evidence remains valid;
- `git diff --check`: **PASS**;
- documentation consistency: the repository suite retains the two known unrelated B8 fixture failures concerning candidate-installation contradiction evidence.

## Remaining limitations

- Preview usage is not instrumented; availability is measured, usage is not claimed.
- False-positive rate is not measurable from rejection alone and remains explicitly uninstrumented.
- Advisory explanations cannot determine human meaning, importance, or destination.
- More real review sessions are required before changing ingestion scope or introducing broader intelligence.

## Acceptance decision

MRU0-P3.32 is **accepted**. Review quality is more measurable and interpretable, while prioritization remains advisory and the human-controlled workflow remains unchanged.
