# Infinite Brain Conversation Intelligence Privacy and Extraction Benchmark

**Status:** MRU0-P3.46 benchmark and specification
**Scope:** evaluation only; no automatic discovery or historical ingestion

## Taxonomy

Capture when the item is explicit, technically consequential, source-linked, and useful beyond the immediate turn:

- architecture or implementation decisions;
- important tradeoffs and rejected options with rationale;
- lessons learned and validated solutions;
- changed system behavior;
- unresolved questions and future actions;
- recurring problems with evidence of recurrence.

Usually exclude temporary debugging chatter, progress acknowledgements, speculative thoughts without a decision, duplicated guidance, irrelevant conversation, and private/personal content unrelated to the technical review.

## Privacy boundary

Allowed evidence is limited to technical decisions, repository/workspace context, implementation outcomes, and validation evidence. Restricted evidence includes secrets, tokens, credentials, private personal information, unrelated conversation, and raw transcript content. Restricted material must be excluded before persistence; redaction is not a license to retain the surrounding secret-bearing payload.

Every retained candidate must preserve source session identity, timestamp, repository context, provenance, confidence, uncertainty, and freshness. Every item remains review-only and human-authoritative.

## Benchmark protocol

1. Select session references explicitly; do not scan roots or read all transcripts.
2. Sanitize case summaries and create an independent expected-candidate checklist before inspecting candidate output.
3. Compare expected capture, actual useful candidates, missed items, unnecessary candidates, and restricted-item handling.
4. Record context sufficiency, ambiguity, provenance, and human usefulness separately.
5. Do not use benchmark results to auto-promote, mutate canonical state, or authorize a new adapter.

The fixture is [infinite-brain-conversation-intelligence-benchmark.json](./infinite-brain-conversation-intelligence-benchmark.json). It contains no raw transcript or live secret.

