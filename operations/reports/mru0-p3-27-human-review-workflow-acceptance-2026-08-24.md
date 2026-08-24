# MRU0-P3.27 Human Review Workflow Optimization Acceptance

**Status:** ACCEPTED
**Scope:** provenance repair, bounded review session, operator-step reduction

## Before

The MRU0-P3.26 real-input pass detected 11 Mind inbox items, but the unified review normalizer expected flattened producer fields. Ingestion envelopes stored source identity and evidence under nested contract sections, so the workflow artifacts lost source hash and original ingestion identity. Calibration consequently reported 11 missing-provenance items.

The operator also had to invoke ingestion, review projection, briefing, workflow, daily loop, calibration, and readiness separately.

## Changes

### Provenance propagation

The unified review normalizer now accepts both existing flattened producer records and canonical nested ingestion envelopes. It preserves:

- source reference and hash;
- original ingestion identity;
- timestamps;
- authority owner;
- confidence;
- freshness;
- uncertainty;
- evidence references.

The workflow source snapshot carries the original ingestion identity while retaining compatibility for producers that only provide a review identity.

### Bounded daily review entrypoint

`tools/scripts/mind-steward-daily-review.mjs` composes existing capabilities into one report-only operator flow. It exposes:

- readiness;
- ingestion counts and failures;
- pending review items;
- context and evidence references;
- provenance fields;
- decision options;
- required actions;
- calibration signals.

It also supports explicit human decision recording through `--decision`. Decisions update only the runtime-local workflow artifact and require the existing reason, reviewer, timestamp, and matching source-reference gates.

## Real-input evidence

The repaired pipeline was run against 11 real Mind inbox items:

- envelopes: 11;
- ingestion failures: 0;
- review items: 11;
- missing-provenance signals: 0;
- stale items: 0;
- duplicate findings: 0;
- pending human decisions: 11;
- automatic promotions: 0.

One accepted decision was exercised in memory only. It produced a promotion candidate retaining the original ingestion ID, source hash, evidence references, and decision reference. No promotion artifact was written and no Mind content changed.

## Safety and authority

The packet preserves:

- `writes_to_mind=false`;
- `writes_to_brain_canonical=false`;
- `automatic_decisions=false`;
- `automatic_promotion=false`;
- `provider_calls=false`;
- `new_storage_authority=false`.

No authority boundary, storage system, intelligence system, or provider behavior changed.

## Validation

- Brain Core `npm run typecheck`: PASS;
- Mind Steward ingestion/review/promotion/daily-loop/calibration/readiness suite: 36/36 PASS;
- real-input daily review run: PASS;
- documentation consistency validation: PASS;
- `git diff --check`: PASS.

## Remaining limitations

- Human decisions still require an operator and are not inferred.
- Promotion remains a separate approval and receipt-gated action.
- Runtime-local artifacts are not canonical knowledge.
- Future friction priorities should be based on additional review sessions, not this single repaired pass.
