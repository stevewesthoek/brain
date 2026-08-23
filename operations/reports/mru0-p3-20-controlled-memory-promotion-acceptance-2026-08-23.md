# MRU0-P3.20 Controlled Memory Promotion — Acceptance

Status: accepted

## Operational result

P3.20 provides deterministic promotion preparation artifacts for accepted P3.19 review items. Each candidate preserves source evidence, review-history reference, accepted decision reference, target authority domain, destination, confidence, freshness, uncertainty, provenance, and rollback reference.

## Human control

Promotion requires explicit human confirmation of target domain, destination, scope, timestamp, reviewer, and reason. No candidate is approved by confidence, frequency, or AI recommendation. `promoted` is recordable only with an externally supplied promotion receipt; this packet performs no canonical write.

## Safety invariants

- `writes_to_mind=false`
- `writes_to_brain_canonical=false`
- `automatic_promotion=false`
- `automatic_decisions=false`
- `provider_calls=false`
- `new_storage_authority=false`
- source evidence is never deleted

## Validation evidence

Focused tests cover accepted-review gating, invalid targets, missing provenance/decision, explicit confirmation requirements, duplicate promotion prevention, rollback retention, rejection, deterministic artifacts, and runtime-local containment. The P3.17–P3.20 and decision-boundary regression suite passes 37/37; documentation consistency and `git diff --check` pass.

## Limitations and next phase

This packet does not create memory, write Mind or Brain, execute transactions, schedule work, or perform autonomous learning. The next milestone requires separate authorization for any bounded transaction adapter that would apply an already-approved promotion.
