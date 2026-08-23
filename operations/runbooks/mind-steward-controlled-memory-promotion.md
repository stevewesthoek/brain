# Mind Steward Controlled Memory Promotion

MRU0-P3.20 prepares reviewed evidence for a human-approved promotion boundary. It does not write Mind or Brain canonical state and does not create a memory store.

## Promotion lifecycle

`not_eligible` → `promotion_candidate` → `awaiting_confirmation` → `approved_for_promotion` → `promoted`

Any candidate may become `rejected` before promotion. A review must be accepted and have an accepted decision-history entry before a candidate can be prepared. Supported destinations are `Mind`, `Brain`, and `evidence/archive only`.

## Human activation

1. Build the P3.19 review workflow from the current P3.18 briefing.
2. Call `createPromotionCandidate` with the accepted review, target authority domain, proposed destination, and rollback reference.
3. Call `requestPromotionConfirmation` with the request timestamp, reviewer, and reason.
4. A human explicitly calls `approvePromotion` with the target domain, destination, scope, timestamp, reviewer, and reason.
5. Only an externally completed, separately authorized transaction may call `recordPromotionReceipt`; it must provide a receipt and rollback reference. This artifact layer itself performs no promotion.
6. Use `writePromotionArtifact` only for runtime-local inspection under `runtime/local/mind-steward/promotions/`.

Confidence, frequency, or an AI recommendation cannot approve promotion. Evidence remains retained at every stage, and rejected candidates do not delete their source or review history.

## Authority and safety

Mind remains authoritative for meaning, priorities, and personal/business context. Brain remains authoritative for operational knowledge and execution truth. This workflow is neither authority. It records explicit preparation and confirmation artifacts only; it has no provider calls, scheduling, automatic learning, canonical writes, or rollback execution.
