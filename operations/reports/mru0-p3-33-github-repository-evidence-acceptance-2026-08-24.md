# MRU0-P3.33 GitHub Repository Evidence Foundation Acceptance

**Status:** ACCEPTED
**Date:** 2026-08-24
**Scope:** read-only GitHub repository identity and advisory evidence through the existing review workflow

## Operational result

Supported Markdown and text items in `mind/inbox/new/` are scanned for GitHub repository URLs during the existing ingestion pass. Each recognized URL produces a bounded provider-neutral repository evidence envelope and enters the existing unified review projection.

The review item exposes:

- canonical URL, owner, name, and stable repository identity;
- source reference, source hash, ingestion identity, and retrieval timestamp;
- provenance, freshness, confidence, uncertainty, and review requirement;
- description, technology, activity, maintenance, licensing, documentation, and dependency fields;
- advisory questions covering relevance, overlap, value, maintenance, licensing, benefits, risks, and unknowns.

## Current metadata boundary

The implementation performs URL identity recognition only. It does not automatically fetch GitHub metadata. Activity, maintenance, licensing, documentation, and dependency fields remain empty/unknown unless explicitly supplied by a bounded future adapter or fixture. This is deliberate uncertainty, not a positive or negative recommendation.

The capability is therefore safe for daily review of repository references while further remote metadata inspection remains separately bounded work.

## Existing workflow integration

```text
Mind inbox/new Markdown or text
  -> ingestion envelope
  -> GitHub repository evidence recognition
  -> unified review projection
  -> bounded evidence preview
  -> briefing and human review workflow
  -> explicit human decision
```

Repository evidence is not a parallel queue or intelligence system. Duplicate canonical repository identities fail closed rather than being silently merged.

## Safety and authority

Preserved invariants:

- `review_required=true`;
- `automatic_clone=false`;
- `dependency_installation=false`;
- `repository_execution=false`;
- `automatic_adoption=false`;
- `automatic_decision=false`;
- no Mind writes;
- no Brain canonical writes;
- no provider calls.

No repository is cloned, modified, installed, executed, adopted, or promoted. Human review remains responsible for relevance, overlap, benefits, risks, maintenance, licensing, and any future investigation.

## Validation

- GitHub URL/evidence contract tests: PASS;
- ingestion, repository recognition, unified review, preview, workflow, briefing, daily loop, calibration, and readiness regressions: **44/44 PASS**;
- Brain Core TypeScript typecheck: **PASS**;
- provenance preservation and read-only containment: **PASS**;
- invalid URL, unavailable metadata, stale/unknown evidence, and duplicate identity coverage: **PASS**;
- `git diff --check`: **PASS**;
- documentation consistency suite: retains two known unrelated B8 fixture failures concerning candidate-installation contradiction evidence.

## Documentation

- `operations/specs/infinite-brain-github-repository-evidence-contract.md`
- `operations/runbooks/mind-steward-github-repository-evidence.md`

## Future expansion points

Any future metadata adapter must have separate authorization and acceptance for bounded read-only retrieval, freshness, rate limits, privacy, licensing, failure behavior, and provenance. It must not clone, install, execute, or adopt repository code.

## Acceptance decision

MRU0-P3.33 is **accepted** as a GitHub repository evidence foundation. Repository references can enter the existing Inbox → Evidence → Review workflow without expanding execution authority or creating a new intelligence system.
