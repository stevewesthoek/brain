# Infinite Brain Conversation Intelligence Contract

**Status:** CLR5 implementation contract — bounded report-only conversation evidence
**Scope:** explicit, bounded session evidence; no transcript database or canonical write

## Purpose

Conversation intelligence turns selected structured knowledge from Claude Code, Codex, or Workbench sessions into evidence for the existing Infinite Brain review workflow. It does not create memory or decide what is durable.

## Supported source boundary

| Provider | Supported input | Current local evidence | Boundary |
|---|---|---|---|
| Claude Code | explicit metadata reference under `~/.claude/projects/` | root exists; JSONL session files are present | metadata-only reads; no directory scan or transcript ingestion |
| Codex CLI/app | explicit metadata reference under `~/.codex/sessions/` | root exists; JSONL rollout files are present | metadata-only reads; no database surgery or broad historical ingestion |
| Workbench | explicit session metadata reference or approved evidence artifact | Workbench application/runtime roots exist; no passive ChatGPT-history export is admitted | no guessed path, hosted-history scraping, or claim of passive access |

## Evidence extraction

Only bounded structured candidate records are accepted. Records may provide explicit `signals` for `decision`, `architecture`, `lesson`, `tradeoff`, `validated_solution`, `changed_behavior`, `changed_file`, `recurring_problem`, `unresolved_question`, or `future_action`; these normalize to the existing review categories. A signal may be a scalar or bounded list, and optional producer-supplied context is attached to the candidate. This improves coverage of secondary outcomes without parsing transcripts or inferring unstated knowledge. Categories are decisions, architecture choices, lessons, unresolved questions, changed files, validation evidence, recurring problems, and improvements. Each candidate preserves:

- source session ID and provider;
- deterministic event ID, source message/window, and content hash;
- actor and claim type (`user_statement`, `assistant_statement`, `tool_observation`, or related evidence class);
- observed timestamp and repository context;
- source reference and content hash;
- freshness, confidence, provenance, and uncertainty.

The adapter contract is `discover_since`, `normalize`, `verify_source`,
`privacy_classify`, `checkpoint`, and `health`. Reads are bounded to 100
records and candidate statements to 1,000 characters. Repeated event IDs are
collapsed in the report ledger; unrelated claims are not merged.

Raw transcript fields, message arrays, full transcript reads, secret-like values, invalid metadata, and conflicting repository context are rejected. Candidate text is capped at 1,000 characters and batches at 100 records. No semantic provider call is required by this adapter.

Candidate privacy classifications are limited to `public`, `technical`, and `internal`; personal/restricted records are rejected before evidence creation. Credential-like text is redacted to `[REDACTED_SECRET]` at the adapter/report boundary and is never emitted to runtime reports or logs. The envelope remains restricted and review-required, and producer context is evidence rather than authority.

## Workflow

```text
explicit session evidence artifact
  → conversation evidence envelope
  → existing unified review inbox
  → daily review / human decision
  → separately approved bounded promotion
```

The daily review CLI accepts one explicit runtime-local artifact with `--conversation-evidence-file`. It does not discover sessions automatically. Every item requires human review; automatic promotion and canonical Mind/Brain writes remain false.

## Storage and privacy

Raw client-owned sessions remain in their owning local runtime. Brain stores only a restricted runtime-local evidence artifact and source reference by default. Artifacts are not committed to Git. Secret-bearing values are rejected before persistence. Infrastructure claims remain non-canonical evidence and must defer to IKHP/provider authority.

Infrastructure-classified evidence is retained as a review candidate with
`routing_target: ikhp:evidence-candidate`; it never mutates the IKHP catalog,
health snapshot, credential records, or any other canonical infrastructure
state. Contradictions are reported by claim key and polarity, while stale
events remain visible with their original timestamps and cannot override newer
runtime evidence. Source deletion remains source-owned; the bounded ledger and
reports are rebuildable runtime-local projections.
