# MRU0-P3.13 — Human Review Projection Acceptance

**Date:** 2026-08-23
**Scope:** active Mind inbox ingestion review usability
**Status:** accepted; review projection only

## Result

The existing ingestion artifact now includes a deterministic per-item human review projection. Each successful envelope and each failure is visible with its source, identity, understanding fields, governance fields, uncertainty, and required workflow decision state.

Review states are explicitly limited to:

```text
needs_review | accepted | rejected | deferred | archived
```

These are review workflow states only. They do not represent memory promotion and do not apply decisions.

## Improved review information

For each item, `latest.md` now presents:

- source file;
- ingestion ID;
- timestamp;
- source hash;
- detected type;
- extracted metadata;
- content summary status;
- confidence;
- uncertainty;
- Mind impact;
- Brain impact;
- privacy classification;
- freshness;
- review requirement;
- allowed review decisions;
- promotion authority boundary.

Failures receive the same `needs_review` state and show the source file, issue code, and failure details. The detailed JSON envelope remains available in `latest.json`.

## Active boundary preserved

- Mind files remain in `inbox/new/`.
- Brain writes only to the existing runtime-local ingestion output.
- No new inbox, database, queue, memory store, or authority was added.
- No PDF, DOCX, XLSX, image, audio, video, GitHub, YouTube, or conversation ingestion was added.
- No watcher, provider call, automatic decision, or automatic promotion was added.
- Mind retains meaning, priorities, and final memory decisions.

## Validation evidence

Passed:

- 13 focused ingestion, envelope, and review-projection tests;
- deterministic projection rendering;
- per-item decision visibility;
- provenance and source-hash preservation;
- privacy, freshness, uncertainty, and review-required preservation;
- failure projection;
- no Mind writes;
- no automatic promotion;
- Brain documentation consistency validation;
- `git diff --check`.

The preceding live P3.12 validation observed 11 captures, 11 successful envelopes, zero failures, zero duplicate revisions, and zero missing metadata. P3.13 changes only the review projection of those results.

## Classification

### ACTIVE

- Per-item Markdown review projection.
- Structured workflow decision visibility.
- Failure review visibility.
- Existing human approval boundary.

### IMPROVED

- Summary-only Markdown became actionable per-item review output.
- `needs_review` is explicit rather than implied by a count.
- Decision options are visible without implying promotion.

### ROADMAP

- Read-only review queue/projection across additional existing report sources.
- Duplicate disposition workflow after owner review.
- PDF normalization only after a separate safe-capability assessment.
- Other input classes remain future work.

## Acceptance decision

MRU0-P3.13 is accepted as a bounded human-review usability improvement. The next ingestion capability must be separately authorized and must preserve this projection and its human-governed decision boundary.
