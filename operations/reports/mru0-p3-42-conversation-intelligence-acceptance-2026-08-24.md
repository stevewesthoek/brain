# MRU0-P3.42 Conversation Intelligence Operational Capability Acceptance

**Date:** 2026-08-24
**Status:** ACCEPTED — explicit bounded conversation evidence is review-operational

## Audit result

The P3.16 foundation already supported explicit Claude, Codex, and Workbench session metadata references, bounded candidate categories, provenance, privacy classification, and no-promotion invariants. Before P3.42 it was not connected to the daily review runner and did not preserve all required per-candidate context.

Current status:

- **Claude:** explicit metadata references under `~/.claude/projects/`; local root and JSONL records confirmed metadata-only.
- **Codex:** explicit metadata references under `~/.codex/sessions/`; local root and JSONL rollout records confirmed metadata-only.
- **Workbench:** explicit metadata only; local application/runtime roots exist, but no passive ChatGPT-history export is supported or claimed.
- **Review integration:** explicit runtime-local conversation artifacts now enter the existing unified review inbox and daily review workflow.
- **Automatic discovery:** not enabled.

## Implemented bounded capability

Structured candidate extraction now supports decisions, architecture, lessons, unresolved questions, changed files, validation, recurring problems, and improvements. Candidate records preserve session identity, timestamp, repository, freshness, confidence, uncertainty, and provenance. The adapter rejects raw transcript/message fields, secret-like content, invalid metadata, conflicting repository context, and oversized batches/statements.

The explicit `--conversation-evidence-file` input activates the same path:

`conversation source → evidence envelope → unified review inbox → daily review → human decision`

## Validation

- Conversation evidence, daily review, and unified review tests: **20/20 passed**.
- Valid structured session evidence projects into a pending human-review item.
- Missing session metadata remains explicit and does not trigger discovery.
- Invalid provider/path/metadata is rejected.
- Stale candidate freshness is preserved.
- Conflicting repository context is rejected.
- Transcript-shaped input and secret-like values are rejected.
- Runtime-local input/output containment is enforced.
- No automatic promotion or canonical Mind/Brain write occurs.

The broader Mind Steward regression remains environment-limited by the pre-existing missing local `tsx` binary; that limitation is separate from the focused conversation capability tests.

## Safety and limitations

No broad historical ingestion was performed. No raw transcript was read or persisted by this activation. Claude and Codex have local session evidence available, but format-specific historical parsing remains unsupported. Workbench does not expose a passive hosted conversation-history source. Candidate extraction is structured/report-only and does not independently determine durable meaning.

## Final answer

Infinite Brain can now safely learn candidate knowledge from explicitly selected AI collaboration evidence, but not from all session history automatically. The next justified step is operational use of selected artifacts and review outcomes; broad historical ingestion, transcript databases, semantic provider extraction, and automatic memory creation remain unjustified and unauthorized.

