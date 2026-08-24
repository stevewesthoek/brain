# MRU0-P3.37 GitHub Intelligence Quality Acceptance

**Date:** 2026-08-24
**Status:** ACCEPTED — bounded quality refinement

## Improvements

- Low-signal repositories no longer receive `potentially_useful` solely because a description exists.
- A substantive description and at least one corroborating public signal are required for `potentially_useful`.
- Recognized low-signal controls can produce `likely_low_value`; other sparse cases remain `investigate_further` or `insufficient_evidence`.
- Small projects with a short but meaningful description and corroborating topics/language/activity remain eligible for `potentially_useful`.
- Positive, negative, and missing evidence are now displayed separately.
- Successful enrichment removes identity-only “metadata was not fetched” uncertainty from the current uncertainty list while preserving it under provenance history.

## Validation matrix

- Maintained, informative repository: remains eligible for `potentially_useful`.
- Low-signal Hello World control: `likely_low_value` with low confidence and explicit uncertainty.
- Unavailable repository: `insufficient_evidence`.
- Stale metadata: `insufficient_evidence`.
- Limited metadata: `investigate_further` or `insufficient_evidence` depending on available corroboration.
- Overlapping capability example: `likely_overlap` remains possible-overlap aware and does not claim equivalence.

## Safety

The existing URL → evidence → metadata → fit → human review workflow is unchanged. No README/content analysis, code analysis, dependency analysis, cloning, execution, installation, adoption, or canonical mutation was added.

## Remaining limitations

README/documentation, pull-request, dependency, and architecture evidence remain unknown. Confidence is still advisory and must not be treated as an automatic recommendation.
