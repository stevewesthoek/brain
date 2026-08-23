# Infinite Brain Maintenance Prioritization Intelligence

**Status:** MRU0-P3.6 report-only advisory analysis
**Runtime boundary:** no decisions, proposals, canonical changes, writes, scheduling, or autonomous maintenance

## Purpose

This layer transforms existing maintenance findings into explainable attention signals. It does not create a second ranking authority. An advisory score is an explanation aid, not truth, command, approval, or human priority.

## Factors

Advisory factors are visible and bounded: impact, confidence, freshness urgency, evidence quality, historical usefulness, and attention cost. Unknown authority or freshness produces a zero score and explicit uncertainty rather than a guessed priority.

Mind meaning, importance, priorities, values, and strategy remain Mind authority. A Mind-related finding is marked `mind_review_required=true`; the analyzer does not infer that it is important to Mind or reorder human priorities.

## Provenance and safety

Each result preserves the source finding reference, source references, evidence, authority owner, confidence, freshness, impact, factors, uncertainty, rationale, and `action=report_only`. Results remain derived intelligence artifacts and cannot directly create decisions or proposals.

## Reuse and rollback

The analyzer consumes existing maintenance intelligence and existing authority/freshness semantics. Stop invoking it to roll back; it creates no persistent state and has no write or provider path.
