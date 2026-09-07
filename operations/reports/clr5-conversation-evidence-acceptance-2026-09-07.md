# CLR5 Conversation Evidence Acceptance — 2026-09-07

## Decision

`COMPLETE — REPORT_ONLY`

CLR5 is implemented as a bounded, provider-neutral conversation evidence
adapter and report path. It does not discover private session roots
automatically, call an external semantic provider, write canonical Mind
content, or mutate IKHP canonical infrastructure state.

## Scope and adapters

The existing explicit metadata/session-reference boundary is retained for
Claude Code, Codex, and Workbench. The adapter contract is implemented by
`tools/scripts/mind-steward-conversation-evidence.mjs`:

- `discover_since(watermark)` — bounded record windowing;
- `normalize(record)` — deterministic event ID, content hash, actor/claim,
  freshness, and routing metadata;
- `verify_source(record)` — rejects transcript/message-shaped input;
- `privacy_classify(record)` — bounded privacy classification;
- `checkpoint(events)` — resumable watermark and event IDs;
- `health()` — provider-neutral capability/health metadata.

No provider-specific schema or hosted-history scraper was added.

## Evidence and safety behavior

Each event preserves source system, session, optional message/window,
observation time, adapter, retrieval time, and evidence hash. User,
assistant/model, and tool claims remain distinguishable. Candidate statements
are capped at 1,000 characters and batches/events at 100 records.

Credential-like values are redacted to `[REDACTED_SECRET]` before report or
runtime persistence; raw private keys, tokens, passwords, cookies, and hidden
inputs are not retained. Raw conversations remain source-owned and are not
copied into Git.

Repeated event IDs are collapsed deterministically. Contradictions are
reported by claim key and polarity. Old/unknown evidence remains visible with
timestamps and stale markers; it cannot override current runtime evidence.

## IKHP and canonical-write boundary

Infrastructure-classified evidence receives
`routing_target: ikhp:evidence-candidate`. This is a non-canonical review
route only. The report invariant explicitly records:

```text
writes_to_mind = false
writes_to_brain_canonical = false
ikhp_canonical_mutation = false
new_authority_store = false
```

The existing unified review inbox and daily review workflow remain the
operator surface. Any future promotion must use the existing human-approved
bounded transaction path; CLR5 does not apply candidates.

## Validation

- Focused conversation, benchmark, review-inbox, workflow, and daily-review
  tests: **35/35 passed**.
- Context-learning contract validator: passed.
- Conversation evidence schema validator: passed on a synthetic contradiction
  fixture with assistant and tool observations.
- `git diff --check`: passed.
- Changed-file secret scan: no secret-like values detected.
- No live session roots were scanned and no real conversation content was
  ingested.

## Remaining boundary

CLR5 is report-only. CLR6 learning candidates/relational strengthening and
CLR7 reviewed promotion remain separate roadmap milestones and are not
implemented here.
