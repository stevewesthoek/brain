# MRU0-P3.31 Bounded Review Evidence Preview Acceptance

**Status:** ACCEPTED
**Date:** 2026-08-24
**Scope:** bounded, deterministic, read-only evidence context for existing review items

## Operational result

Existing Mind Steward review items can now carry an `evidence_preview` record. The daily review workflow reads only an allowlisted source beneath the configured Mind root, verifies the recorded SHA-256 source hash, and exposes a bounded character preview when the source is available.

The existing workflow remains the only review path. The Brain Console projection overview reports preview availability/unavailability alongside the existing human review counts; it adds no decision or mutation controls.

## Preview contract

Each preview preserves:

- source identity and reference;
- source hash;
- original ingestion identity;
- evidence references and authority owner;
- freshness;
- confidence and uncertainty;
- current review state;
- bounded content preview and truncation state;
- explicit unavailable reason where preview cannot be safely produced.

The default preview bound is 1,600 characters. Source content is not written to a new store or canonical source. The preview is runtime-local operator context attached to the existing workflow projection.

## Failure behavior

Validated fail-closed states include:

- source unavailable;
- source not allowlisted;
- unreadable or non-file source;
- invalid provenance;
- source hash mismatch;
- stale source;
- duplicate review identity;
- empty workflow state.

Unavailable evidence retains provenance and reports a reason instead of inventing content or conclusions. Stale evidence may remain visible but is explicitly marked stale.

## Safety and authority

The implementation preserves:

- no source mutation;
- `writes_to_mind=false`;
- `writes_to_brain_canonical=false`;
- `automatic_decisions=false`;
- `automatic_promotion=false`;
- `provider_calls=false`;
- `new_storage_authority=false`.

The preview does not infer meaning, importance, relevance, destination, or review outcome. Human review remains authoritative.

## Files

- `tools/scripts/mind-steward-evidence-preview.mjs`
- `tools/scripts/mind-steward-evidence-preview.test.mjs`
- `tools/scripts/mind-steward-daily-review.mjs`
- `operations/runbooks/mind-steward-daily-review.md`
- `operations/specs/infinite-brain-evidence-preview-contract.md`
- `projects/brain-console/components/infinite-brain-projection-overview.tsx`
- this acceptance report

## Validation

- Mind Steward focused regression suite, including preview, ingestion, review, briefing, daily loop, calibration, readiness, and workflow tests: **30/30 PASS**;
- Brain Core TypeScript typecheck: **PASS**;
- Brain Console TypeScript typecheck: **PASS**;
- Brain Console production build: **PASS**;
- `git diff --check`: **PASS**;
- documentation consistency suite: retains two pre-existing unrelated B8 fixture failures concerning candidate-installation contradiction evidence; no P3.31 failure was reported.

## Acceptance decision

MRU0-P3.31 is **accepted**. Review items now provide useful bounded evidence context while retaining provenance, fail-closed behavior, human authority, and the existing storage and workflow boundaries.
