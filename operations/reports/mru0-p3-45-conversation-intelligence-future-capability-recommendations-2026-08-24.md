# MRU0-P3.45 Conversation Intelligence Future Capability Recommendations

**Date:** 2026-08-24
**Decision type:** evidence-backed recommendations only; no expansion implemented

## A. Controlled session discovery

**Recommendation: not justified yet.** Recall of the structured sample was 70.8%, with six of eight sessions missing at least one expected item. Discovery would increase volume before the candidate process reliably captures secondary constraints.

## B. Historical session ingestion

**Recommendation: defer.** The sample found no need to scan history to complete current review decisions. Historical ingestion would add privacy, retention, watermark, and noise costs without evidence that missed items would be recovered safely.

## C. Better extraction methods

**Recommendation: investigate only as a future evaluation, not implement.** Precision was 85.0%, but three unnecessary candidates and seven misses show a potential quality problem. Because candidates were operator-authored, the next step should be a separately designed extraction benchmark with expected checklists and redaction—not an immediate model or provider integration.

## D. Deeper memory integration

**Recommendation: not justified.** The evidence contract and human review workflow preserved provenance and handled noise. No metric shows that automatic memory creation or promotion would improve outcomes. Keep canonical promotion separately approved.

## Next justified step

Continue bounded selected-session evaluation with independent checklists, emphasizing secondary constraints and context sufficiency. Reconsider controlled discovery only after recall improves materially and an automatic path has a privacy/redaction/watermark design with human review gates.

