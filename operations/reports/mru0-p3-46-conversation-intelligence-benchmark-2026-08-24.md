# MRU0-P3.46 Conversation Intelligence Privacy and Extraction Benchmark Report

**Date:** 2026-08-24
**Status:** COMPLETE — benchmark fixture and objective criteria established

## Benchmark dataset

The controlled fixture contains eight sanitized, explicitly selected cases:

- six positive capture cases: architecture decision, debugging resolution, implementation milestone, tradeoff, unresolved issue, and rejected idea;
- two exclusion cases: irrelevant noise and sensitive/secret-bearing content.

The fixture contains no raw transcript and no live secret. Each case specifies expected action, category, required context, privacy classification, and benchmark labels.

## Current capability assessment

| Criterion | Current evidence | Assessment |
|---|---|---|
| Technical decisions and lessons can enter review | P3.42–P3.45 selected evidence workflow | PASS for explicit structured candidates |
| Provenance/source identity/timestamp/repository preserved | P3.45: 0/8 provenance failures | PASS |
| Confidence/uncertainty/freshness visible | P3.45: context/freshness flags retained | PASS, but producer-supplied |
| Recall of important knowledge | P3.45: 17/24 = 70.8% | INSUFFICIENT for discovery |
| Precision/noise control | P3.45: 17/20 = 85.0% | PROMISING, not discovery-ready |
| Context sufficiency | P3.45: 4/8 unclear-context flags | INSUFFICIENT |
| Raw transcript exclusion | P3.42–P3.45; transcript-shaped input rejected | PASS for current boundary |
| Secret-like candidate rejection | P3.42 tests reject secret-like patterns | PASS for tested patterns; broader classification unproven |
| Personal/private-content classification | No semantic privacy classifier | UNKNOWN / gap |
| Noise exclusion | One explicit unnecessary candidate class observed | PARTIAL |
| Automatic discovery safety | Not implemented or exercised | NOT AUTHORIZED |

## Benchmark interpretation

The current capability is reliable at preserving evidence boundaries and metadata once a candidate is explicitly structured. It is not yet reliable enough to claim that important knowledge will be captured from session content: the expanded checklist sample missed seven of 24 expected items and identified three unnecessary candidates.

The benchmark therefore measures the next decision objectively without expanding the system. It establishes the expected taxonomy, negative cases, privacy labels, and raw-count metrics needed for any future extractor evaluation.

