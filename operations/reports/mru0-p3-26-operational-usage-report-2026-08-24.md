# MRU0-P3.26 Infinite Brain Operational Usage Report

**Date:** 2026-08-24  
**Mode:** observation and refinement only  
**Canonical writes:** none  
**Automatic promotion:** false

## Scope

This report records the first real daily-usage pass over the existing Mind inbox and the Brain operational cockpit. It does not introduce architecture, storage, authority, providers, scheduling, or autonomous maintenance.

## Real input observed

The Mind inbox contained 11 actionable Markdown files in `mind/inbox/new/` (the README was excluded by the ingestion contract). The report-only ingestion pass produced:

- envelopes: 11;
- ingestion failures: 0;
- unified review items: 11;
- important-review items: 11;
- urgent-review items: 0;
- stale items: 0;
- duplicate findings: 0.

No Mind source files were moved, rewritten, promoted, or deleted.

## Review workflow state

All 11 items entered the workflow as `new` and require human review. No human decisions were fabricated during this observation pass:

- accepted: 0;
- rejected: 0;
- deferred: 0;
- archived: 0;
- pending review: 11;
- promotion candidates: 0.

The accepted/rejected/deferred/archived transitions remain covered by the existing workflow tests; real use correctly stops at the human decision boundary when no operator decision has been supplied.

## Daily intelligence and calibration

The daily loop reported 11 pending reviews, 0 conflicts, 0 stale items, and no promotion actions. Readiness reported `ready_with_attention`, with 7/7 capabilities available and the system usable for daily review.

Calibration observed:

- reviewed workflow items: 11;
- missing-provenance signals: 11;
- failed-ingestion signals: 0;
- rejected/noisy items: 0;
- repeated-review items: 0;
- missing-context items: 0.

The missing-provenance signal is evidence that the current generated workflow records do not carry all provenance fields expected by calibration. It is not treated as proof that the source evidence itself is invalid.

## Cockpit health

Brain Core on `localhost:4877` remained at approximately 0% CPU and 81MB RSS during a 10-second observation. Sampled endpoints returned HTTP 200:

- `/health`;
- `/status`;
- `/infinite-brain/status`;
- `/projections/health`;
- `/projections/ingestion`;
- `/projections/review`;
- `/projections/intelligence`;
- `/projections/calibration`;
- `/projections/learning`;
- `/projections/evolution`;
- `/projections/promotion`.

Brain Console production startup on `localhost:4881` returned HTTP 200 for `/`, `/infrastructure`, `/monitoring`, and `/settings`.

## What was useful

- Existing inbox material was detected deterministically.
- Every source retained a source reference and hash at ingestion.
- Review priority was explicit and evidence-based.
- Human decision requirements were visible.
- The promotion boundary remained clear: no accepted item was automatically promoted.
- Empty and pending states were represented without synthetic decisions.

## What was missing or awkward

- The real inbox pass produced a large pending queue without a human decision session or operator shortcut.
- Calibration reported missing provenance for all 11 generated workflow items; this needs bounded contract reconciliation before it can be considered a reliable operational signal.
- The operator still runs separate commands for ingestion, unified review, briefing, workflow, daily loop, and calibration.
- No real accepted/rejected/deferred/archived decisions were made in this pass because no human decisions were authorized or supplied.

## Safety result

The observed workflow preserved `writes_to_mind=false`, `writes_to_brain_canonical=false`, `automatic_promotion=false`, `provider_calls=false`, and `new_storage_authority=false`. No feature expansion is recommended from this single usage pass.

## Next evidence window

The next usage pass should include explicit human review decisions on a bounded subset of these real items, with reasons recorded, followed by comparison of provenance/calibration output before any implementation work is authorized.
