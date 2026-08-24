# MRU0-P3.43 Conversation Intelligence Friction Report

**Date:** 2026-08-24

## Observed friction

1. **Candidate preparation is manual.** The operator must select a session and supply structured candidate statements. This preserves safety but limits measured extraction value.
2. **Session formats are not normalized.** Claude and Codex expose local JSONL stores, but their records are provider-specific and have not been admitted for semantic parsing.
3. **Workbench evidence is reference-only.** A Workbench session-store file was not present in the inspected local config locations, and the admitted Workbench surface does not export hosted ChatGPT history.
4. **Review items are envelope-level.** Multiple candidates from one session arrive as one review item, so human decisions currently apply to the evidence artifact rather than an individual candidate.
5. **Freshness is source-level by default.** Candidate freshness can be preserved, but the operator must provide it; no independent freshness evaluator runs over selected session content.
6. **Value measurement is bounded.** This run proves workflow mechanics and context preservation, but not autonomous extractor accuracy, noise rate, or time saved against manual reconstruction.

## Useful absence of noise

No transcript dump, irrelevant message stream, secret-like value, automatic promotion, authority escalation, or canonical write appeared. The absence is a safety success, but it also means broader historical coverage remains intentionally unmeasured.

## Historical capability limits

- Claude local evidence: `~/.claude/projects/`, JSON/JSONL records available; explicit metadata reference is safe, broad parsing is not admitted.
- Codex local evidence: `~/.codex/sessions/`, JSON/JSONL rollout records available; no database surgery or broad scan is admitted.
- Workbench: application/runtime state exists, but no supported passive ChatGPT-history export is available; explicit metadata or an approved export is required.

