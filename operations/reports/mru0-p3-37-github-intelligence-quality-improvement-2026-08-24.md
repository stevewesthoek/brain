# MRU0-P3.37 GitHub Intelligence Quality Improvement Report

**Date:** 2026-08-24

## Evidence used

P3.36 found that `octocat/Hello-World` was labeled `potentially_useful` despite sparse metadata, and that successful enrichment retained stale identity-only uncertainty. Langfuse’s possible overlap also showed that term matches need explicit qualification.

## Changes made

- Added evidence-quality gates for usefulness dispositions.
- Added explicit positive, negative, and missing evidence collections.
- Preserved small projects with corroborating public signals.
- Corrected enrichment uncertainty presentation without discarding provenance history.
- Added regression coverage for low-signal, small-project, stale, unavailable, overlap, and missing-comparison cases.

## Result

Assessments are more trustworthy: weak evidence is no longer promoted by a description-only rule, and operators can see why a conclusion is limited. Human review remains authoritative.

## Next justified improvement

No deeper repository inspection is justified yet as a default. If future operational usage still shows purpose uncertainty after this gate, consider a separately authorized bounded README/documentation signal adapter before architecture, dependency, or code analysis.
