# MRU0-P3.19 Unified Intelligence Review Workflow — Acceptance

Status: accepted

## Operational result

The review loop now has explicit `new`, `reviewing`, `accepted`, `rejected`, `deferred`, and `archived` workflow states. Each item retains source identity, evidence references, ingestion/review ID, timestamp, source hash, authority owner, freshness, confidence, and uncertainty. Human actions append traceable history rather than replacing evidence.

## Decision boundary

`accepted` is a workflow decision only and remains a promotion candidate subject to the existing bounded decision transaction. Every terminal decision requires a reason, timestamp, reviewer, and matching source reference. Duplicate review identities and invalid states fail closed.

## Safety invariants

- `writes_to_mind=false`
- `writes_to_brain_canonical=false`
- `automatic_promotion=false`
- `automatic_decisions=false`
- `provider_calls=false`
- `new_storage_authority=false`
- no scheduler, client change, autonomous agent, OCR, video processing, or external provider call

## Validation evidence

Focused workflow tests cover deterministic artifacts, lifecycle transitions, reason/source requirements, history preservation, duplicate rejection, evidence preservation, and runtime-local containment. The workflow, briefing, unified-review, ingestion, conversation-evidence, decision-boundary, review-projection, and validation regression suite passes 33/33. Documentation consistency and `git diff --check` pass.

## Limitations and next phase

This packet does not resolve human meaning, importance, authority conflicts, or canonical promotion. It does not provide scheduling or automatic memory updates. The next milestone should be separately authorized review-history reconciliation or bounded operator ergonomics work.
