# Infinite Brain Evidence Preview Contract

**Status:** MRU0-P3.31 implementation contract
**Authority:** existing ingestion envelope, unified review workflow, and source-owned evidence

## Purpose

Evidence preview is a bounded, deterministic, read-only view over an existing review item's source reference. It reduces operator navigation without creating a search index, memory store, queue, or authority layer.

## Preview record

Each review item may carry `evidence_preview` with:

- `status`: `available` or `unavailable`;
- `source_identity`: review identity;
- `source_reference`: source-owned reference;
- `source_hash`: expected content hash;
- `ingestion_id`: original ingestion identity;
- `provenance`: evidence references and authority owner;
- `freshness`: `fresh`, `stale`, or inherited/unavailable state;
- `confidence` and `uncertainty`;
- `review_state`;
- bounded `content_preview` when available;
- `truncated` and source size metadata;
- a failure `reason` when unavailable;
- explicit read-only/no-write safety flags.

The current implementation previews allowlisted `mind/` source references resolved beneath the configured Mind root. It verifies the source hash before exposing content and applies a fixed character bound.

## Failure behavior

Preview fails closed with an unavailable record for:

- missing or unallowlisted source;
- unreadable/non-file source;
- invalid provenance;
- hash mismatch;
- invalid preview bounds.

Unavailable evidence is visible as a reason; it is never replaced by an inferred summary.

## Authority and safety

The preview does not decide meaning, importance, relevance, or destination. Human review remains authoritative. The preview:

- does not mutate source files;
- does not write Mind or Brain canonical state;
- does not perform extraction beyond bounded source reading;
- does not call providers;
- does not promote or decide review items;
- does not persist a second copy of source content outside the existing runtime-local workflow projection.

The source reference, hash, and existing evidence records remain the authority. The preview is disposable operator context.
