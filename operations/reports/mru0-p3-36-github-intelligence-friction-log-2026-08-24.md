# MRU0-P3.36 GitHub Intelligence Friction Log

**Date:** 2026-08-24

## Observed friction

1. **Low-signal disposition is too optimistic.** `octocat/Hello-World` had a minimal description, no primary language, and no topics, yet received `potentially_useful` because a description alone satisfied the current rule.
2. **Uncertainty provenance is noisy after enrichment.** Successful metadata records retain the earlier identity-only uncertainty “remote repository metadata was not fetched.” This is historically true for the first evidence stage but confusing in the enriched result.
3. **README and documentation unknowns limit purpose confidence.** MCP servers and other repositories with sparse API metadata cannot be assessed deeply without content inspection.
4. **Overlap remains terminology-based.** Langfuse’s possible overlap with `evaluation-loader` is useful triage, but the system cannot distinguish shared vocabulary from architectural equivalence.
5. **Maintenance evidence is shallow.** A recent push is useful but does not establish release quality, issue responsiveness, or dependency health.

## What was not observed

- No unsafe behavior or authority drift.
- No duplicate review system or storage need.
- No evidence that cloning or code execution is required for the first review step.
