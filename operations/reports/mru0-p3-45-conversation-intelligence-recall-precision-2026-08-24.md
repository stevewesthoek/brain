# MRU0-P3.45 Conversation Intelligence Recall and Precision Measurements

**Date:** 2026-08-24
**Sample:** 8 sessions; 24 independently expected items; 20 structured candidates

## Metrics

| Metric | Calculation | Result |
|---|---|---:|
| Recall | 17 captured / 24 expected | **70.8%** |
| Precision | 17 useful / 20 candidates | **85.0%** |
| Missed important items | 24 expected − 17 captured | **7** |
| Unnecessary candidates | operator-identified extras | **3** |
| Sessions with at least one missed item | 6 / 8 | **75.0%** |
| Sessions with an unnecessary candidate | 3 / 8 | **37.5%** |
| Missing provenance | workflow output | **0 / 8** |
| Unclear-context items | stale/partial-context review flags | **4 / 8** |

## Interpretation

Recall is not yet strong enough to justify automatic discovery: seven expected items were missed, including safety boundaries, validation gates, recovery behavior, and an integration-specific check. Precision is encouraging but not sufficient for unattended ingestion: three candidates were unnecessary or overbroad.

The strongest reliable signal is envelope and provenance preservation. The weakest signal is secondary-context capture. The metrics therefore support further bounded evaluation and better checklist instrumentation, not model extraction or historical scanning.

## Measurement limitation

The current capability accepts structured candidates; it does not autonomously derive them from raw transcripts. These are operator-authored structured-candidate recall/precision measurements against independent checklists. They are useful for evaluating the evidence contract and candidate discipline, but they are not a benchmark of an automatic semantic extractor.

