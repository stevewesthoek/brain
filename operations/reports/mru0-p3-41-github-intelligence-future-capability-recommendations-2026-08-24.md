# MRU0-P3.41 GitHub Intelligence Future Capability Recommendations

**Date:** 2026-08-24
**Decision type:** evidence-based recommendations only; no capability expansion in P3.41

## A. Dependency intelligence

**Recommendation: do not authorize as a default capability.**

The five-candidate run did not show a dependency question blocking a human decision. Dependency risk remains an explicit unknown, but no candidate outcome changed because that information was absent. Reconsider only if a named candidate reaches a human-approved integration review where dependency burden is the stated blocker.

## B. Code structure intelligence

**Recommendation: do not authorize.**

The sample was sufficient for first-pass purpose, overlap, and triage decisions without source access. No evidence shows that source-level understanding is repeatedly required before a candidate can be deferred, rejected, or selected for a separately authorized investigation. Code inspection would materially expand trust and safety scope.

## C. Repository comparison intelligence

**Recommendation: defer.**

The sample contains multiple candidate types, but no recorded human decision required a deterministic side-by-side repository comparison. Existing human review can compare the bounded evidence when needed. A comparison layer should be considered only after repeated review records demonstrate that manual comparison is the recurring bottleneck.

## Near-term operational recommendation

Keep the current capability active for daily first-pass review. Continue recording candidate-level human outcomes and whether architecture evidence changes a decision. If architecture evidence remains empty across a materially larger real sample, review the bounded documentation contract separately; do not infer permission for source, dependency, or execution analysis.

## Final decision

GitHub intelligence is mature enough for daily use as advisory triage. No next deeper capability is currently justified by evidence. Dependency, code-structure, and repository-comparison intelligence remain deferred and require a new, explicit operational case.

