# Infinite Brain Conversation Intelligence Contract

**Status:** MRU0-P3.42 bounded conversation evidence activation
**Scope:** explicit, report-only session evidence; no transcript database

## Purpose

Conversation intelligence turns selected structured knowledge from Claude Code, Codex, or Workbench sessions into evidence for the existing Infinite Brain review workflow. It does not create memory or decide what is durable.

## Supported source boundary

| Provider | Supported input | Current local evidence | Boundary |
|---|---|---|---|
| Claude Code | explicit metadata reference under `~/.claude/projects/` | root exists; JSONL session files are present | metadata-only reads; no directory scan or transcript ingestion |
| Codex CLI/app | explicit metadata reference under `~/.codex/sessions/` | root exists; JSONL rollout files are present | metadata-only reads; no database surgery or broad historical ingestion |
| Workbench | explicit session metadata reference or approved evidence artifact | Workbench application/runtime roots exist; no passive ChatGPT-history export is admitted | no guessed path, hosted-history scraping, or claim of passive access |

## Evidence extraction

Only bounded structured candidate records are accepted. Categories are decisions, architecture choices, lessons, unresolved questions, changed files, validation evidence, recurring problems, and improvements. Each candidate preserves:

- source session ID and provider;
- observed timestamp and repository context;
- source reference and content hash;
- freshness, confidence, provenance, and uncertainty.

Raw transcript fields, message arrays, full transcript reads, secret-like values, invalid metadata, and conflicting repository context are rejected. Candidate text is capped at 1,000 characters and batches at 100 records. No semantic provider call is required by this adapter.

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

