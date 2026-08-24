# MRU0-P3.45 Conversation Intelligence Expanded Evaluation Acceptance

**Date:** 2026-08-24
**Status:** ACCEPTED — larger recall/precision evidence collected; discovery remains deferred

## Acceptance evidence

- Eight selected real session artifacts evaluated: three Claude, three Codex, and two Workbench references.
- Independent expected-candidate checklists created before candidate comparison.
- 24 expected knowledge items, 17 captured, 7 missed, and 3 unnecessary candidates measured.
- Recall: **70.8%**; precision: **85.0%**.
- Provenance missing: **0/8**; unclear-context flags: **4/8**.
- No hidden scanning, transcript storage, provider calls, automatic promotion, canonical writes, or authority changes.

## Validation

- Conversation intelligence tests: **36/36 passed**.
- Documentation validation: passed.
- `git diff --check`: passed.
- Mind Steward regression remains environment-limited by missing local `tsc`/`tsx`; no new code was introduced in this evaluation-only checkpoint.
- Unrelated dirty files preserved.

## Final answer

Conversation intelligence is valuable as a bounded, human-reviewed evidence container, but the current 70.8% checklist recall is not reliable enough to justify controlled automatic discovery or historical ingestion. The 85.0% precision result is encouraging but includes three unnecessary candidates and was measured on operator-authored structured candidates rather than autonomous transcript extraction. The next justified step is a dedicated, privacy-reviewed extraction benchmark—not broader ingestion.

