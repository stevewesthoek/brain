# MRU0-P3.36 GitHub Intelligence Improvement Candidates

**Date:** 2026-08-24

These are evidence-backed candidates only. No implementation is authorized by this report.

## Candidate 1 — stricter low-signal disposition gate

Require substantive purpose plus at least one corroborating signal (topic, language, license, release, or activity) before `potentially_useful`. Otherwise use `investigate_further` or `insufficient_evidence`. This is supported by the Hello World control result.

## Candidate 2 — separate identity-stage and enrichment-stage uncertainty

Preserve provenance history while removing or annotating stale identity-only uncertainty after successful metadata retrieval. This is supported by the misleading residual uncertainty in all five enriched results.

## Candidate 3 — bounded README/documentation signal adapter

Consider only if operators need better purpose and integration triage after the disposition gate is corrected. It should fetch bounded public content, preserve provenance, and remain human-review-only. No code or dependency inspection is justified yet.

## Candidate 4 — stronger overlap evidence

Consider a bounded comparison against existing capability descriptions and contract terms, with explicit possible-vs-confirmed semantics. The Langfuse result shows value, but current term overlap is not enough for equivalence.

## Recommendation

Prioritize Candidates 1 and 2 before deeper repository inspection. The current capability is valuable enough for first-pass triage, but its low-signal classification and uncertainty presentation should be corrected before adding README, architecture, dependency, or code-structure analysis.
