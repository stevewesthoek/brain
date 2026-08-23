# MRU0-P3.2 Codex Live Consumption Pilot Acceptance

**Status:** complete — bounded live read-only consumption
**Date:** 2026-08-23

## Actual activation boundary

The current Codex environment consumed the provider-neutral Brain entry through the bounded pilot harness. Only entry discovery, bootstrap pointers, continuity binding, freshness visibility, authority visibility, and aggregate measurement were exercised. No Codex configuration or runtime authority was changed.

## Evidence

- `tools/context-learning/codex-live-consumption-pilot.mjs` implements the bounded live consumption path.
- `tools/context-learning/codex-live-consumption-pilot.test.mjs` covers live bounded consumption, source/session mismatch failure, exclusion metrics, and disable rollback.
- `operations/specs/context-learning/codex-live-consumption-pilot-policy.md` defines the pilot boundary and evidence model.

## Safety invariants

- activation state: `LIVE_BOUNDED_READ_ONLY`
- full repository loaded: false
- transcripts loaded: false
- secrets loaded: false
- automatic resume: false
- writes performed: 0
- providers called: 0
- Codex configuration changed: false
- execution/mutation authority: false

## Acceptance

Focused live-pilot tests, full context-learning regressions, contract/broker validation, documentation consistency, syntax checks, and `git diff --check` must pass. The dirty Codex instructions file, Firecrawl log, and BuildFlow identity mapping remain untouched.

## Limitations and rollback

This is not automatic session resume, session merge, transcript ingestion, or autonomous operation. Disable with `enabled=false` and restore the prior Codex session path. Any stale/conflicting state fails closed.
