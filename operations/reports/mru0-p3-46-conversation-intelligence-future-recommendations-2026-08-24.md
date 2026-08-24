# MRU0-P3.46 Conversation Intelligence Future Capability Recommendations

**Date:** 2026-08-24
**Decision type:** evidence-based recommendation only; no capability expansion

## A. Improve extraction quality first

**Recommendation: yes, as a future separately authorized benchmark implementation.** The P3.45 recall result of 70.8%, seven missed items, three unnecessary candidates, and four unclear-context flags shows that quality and context should be improved before increasing source volume. The next quality work should target secondary constraints, rejected-option rationale, validation evidence, and privacy classification.

## B. Controlled session discovery

**Recommendation: no.** Discovery would multiply input volume while recall and privacy classification remain insufficiently proven. It must remain disabled until the benchmark passes safety and quality gates.

## C. Historical session ingestion

**Recommendation: no.** The benchmark provides no evidence that broad history is necessary or that it would improve decisions safely. Historical ingestion remains deferred.

## D. Deeper memory integration

**Recommendation: no.** The current human review and separately approved promotion boundaries are sufficient. No benchmark result justifies automatic memory creation or promotion.

## Suggested future gates

Before considering controlled discovery, a future authorized implementation should demonstrate: complete restricted-item exclusion, zero provenance loss, materially improved recall over the P3.45 70.8% baseline, bounded noise, sufficient context on positive cases, and explicit human review for every candidate. These are recommendations, not activation authorization.

## Final decision

Freeze current source-discovery scope and improve evaluation/extraction quality first. Infinite Brain is not ready to expand from selected evidence toward controlled discovery or historical ingestion.

