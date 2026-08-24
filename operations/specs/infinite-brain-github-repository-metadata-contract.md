# Infinite Brain GitHub Repository Metadata Contract

**Status:** MRU0-P3.34 bounded metadata enrichment
**Scope:** explicit, read-only public GitHub metadata enrichment

## Purpose

The existing GitHub repository evidence adapter can optionally enrich a repository identity with public API metadata. Enrichment is an opt-in review projection; it does not change repository authority, create recommendations, or adopt code.

## Metadata contract

Each field is represented with:

- `value` (or `null`/empty when unknown);
- source URL;
- retrieval timestamp;
- freshness state;
- confidence;
- uncertainty;
- provenance reference.

The bounded adapter may report repository description, stars, forks, watchers, update time, latest release, push and issue signals, pull-request activity as unknown, primary language, an explicitly approximate ecosystem signal, topics, license, and unknown README/documentation signals. Unknown values remain unknown; they are never inferred as positive or negative evidence.

## Failure behavior

Private, deleted, unavailable, timed-out, and rate-limited repositories produce an unavailable metadata status with field-level unknowns and a visible uncertainty reason. Existing identity evidence remains reviewable.

## Safety boundary

The adapter uses only unauthenticated public metadata requests when explicitly enabled. It does not load credentials, clone or download repositories, install dependencies, execute code, modify repositories, make adoption recommendations, write Mind, or write Brain canonical state. Human review remains required.

Normal daily review is offline. Operators must explicitly request metadata enrichment.
