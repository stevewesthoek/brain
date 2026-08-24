# MRU0-P3.34 GitHub Repository Metadata Acceptance

**Date:** 2026-08-24
**Status:** ACCEPTED — bounded, opt-in, read-only metadata enrichment

## Scope

P3.34 enriches existing GitHub repository identity evidence with optional public metadata. It reuses the existing ingestion envelope, unified review projection, and human decision workflow. It adds no authority, database, recommendation, adoption, execution, or canonical write path.

## Implemented

- Public repository metadata and latest-release fetches are available only through the explicit `--enrich-github-metadata` daily-review option.
- Metadata fields preserve source, retrieval time, freshness, confidence, uncertainty, and provenance.
- Repository description, stars, forks, watchers, update/release signals, issue activity, language, topics, and license are represented when available.
- Pull-request activity, README availability, and documentation signals remain explicitly unknown because they are outside this bounded adapter.
- Private/deleted, unavailable, rate-limited, and failed requests remain visible as unavailable evidence.
- Normal daily review remains offline and identity-only.

## Validation

- GitHub metadata, identity, ingestion, unified review, and daily review tests: PASS (27/27 focused tests).
- Unknown values and failure states: PASS.
- Field-level provenance and stale metadata representation: PASS.
- Enriched repository evidence is preserved in the unified review projection, workflow JSON, and human-readable workflow report: PASS.
- Human review remains required; automatic decisions and adoption remain disabled.
- No provider credentials, cloning, installation, execution, or repository mutation: PASS by contract and tests.

## Limitations

- The adapter uses unauthenticated public API requests and may be rate-limited.
- It does not fetch README or documentation contents.
- It does not fetch a separate pull-request activity endpoint.
- It does not make recommendations or promote repositories.

## Operational result

Reviewers can inspect enriched repository evidence through the existing unified review projection and workflow outputs. Any future presentation refinement must remain read-only and preserve the same human decision boundary.
