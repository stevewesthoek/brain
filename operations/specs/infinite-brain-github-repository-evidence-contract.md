# Infinite Brain GitHub Repository Evidence Contract

**Status:** MRU0-P3.33 implementation contract
**Scope:** read-only repository identity and advisory evidence

## Purpose

When a supported Markdown or text item in `mind/inbox/new/` contains a GitHub repository URL, the existing ingestion envelope may attach a provider-neutral `github_repository_evidence` record. The record enters the existing unified review projection and human workflow. It is not a repository installation or adoption mechanism.

## Evidence envelope

The envelope preserves:

- canonical repository URL and stable `owner/name` identity;
- source reference and source hash;
- original ingestion identity and retrieval timestamp;
- freshness, provenance, confidence, uncertainty, and review requirement;
- description, technology, activity, maintenance, licensing, documentation, and dependency fields;
- explicit advisory questions about relevance, overlap, value, maintenance, licensing, benefits, risks, and unknowns;
- read-only safety flags.

The current adapter performs URL identity recognition only. Metadata fields remain empty/unknown unless explicitly supplied by a bounded future adapter or fixture. It does not silently call GitHub or another provider.

## Boundaries

Allowed in future bounded adapters:

- repository identity and metadata inspection;
- maintenance and activity signals;
- documentation and license signals;
- dependency metadata, without installing dependencies.

Never performed by this capability:

- cloning or downloading a repository automatically;
- installing dependencies;
- running repository code or tests;
- modifying a repository;
- automatic overlap/adoption recommendations presented as decisions;
- automatic promotion or canonical Mind/Brain writes.

Duplicate canonical repository identities are rejected rather than silently merged. Invalid URLs and unavailable metadata remain uncertain review evidence.

## Human review output

The review item must answer, as far as evidence permits:

1. What repository is this?
2. Why might it matter?
3. What existing capability might overlap?
4. What benefits and risks are visible?
5. What remains unknown?

The conclusion remains: **human review required**.
