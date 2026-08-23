# MRU0-P3.16 — AI Conversation Evidence Foundation Acceptance

**Date:** 2026-08-23
**Status:** accepted; bounded evidence foundation only

## Active

- Explicit Claude, Codex, and Workbench session metadata references.
- Provider-owned path restrictions for locally stored Claude/Codex sessions.
- Candidate evidence categories for decisions, architecture, lessons, unresolved questions, changed files, validation, recurring problems, and improvements.
- Session identity, repository/workspace context, source revision, confidence, uncertainty, privacy, freshness, and review requirements.
- Brain-local evidence artifact output.

## Limitations

- No automatic session discovery or directory scanning.
- No full transcript storage or default transcript ingestion.
- No provider calls or semantic model extraction.
- Workbench uses explicit metadata only; no local path convention is assumed.
- Candidate signals must be supplied explicitly and remain untrusted evidence until human review.

## Safety validation

Passed tests for:

- session provenance preservation;
- Claude/Codex/Workbench metadata references;
- restricted privacy classification;
- transcript-dumping rejection;
- provider/path boundary rejection;
- bounded candidate statements;
- Brain runtime-local output containment;
- no Mind mutation;
- no Brain canonical mutation;
- no automatic promotion;
- existing ingestion, PDF, review, decision, and envelope regressions;
- documentation consistency;
- `git diff --check`.

## Roadmap

Future work may add an explicitly approved parser for selected exported session formats, with privacy/retention review and review-only outputs. Automatic all-session scanning, transcript databases, provider expansion, video/audio processing, GitHub intelligence, and autonomous memory remain out of scope.
