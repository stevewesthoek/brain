# MRU0-P3.3 Cross-Session Continuity Pilot Acceptance

**Status:** complete — bounded read-only continuity projection
**Date:** 2026-08-23

## Pilot path

A bounded Claude-source fixture was projected through Infinite Brain continuity into a Codex continuation context. The source was checked for freshness, identity, repository/worktree/branch binding, revision compatibility, conflicts, and validation evidence.

## Evidence

- `tools/context-learning/cross-session-continuity-pilot.mjs` implements the bounded projection and usefulness metrics.
- `tools/context-learning/cross-session-continuity-pilot.test.mjs` covers Claude-to-Codex projection, stale/superseded/mismatched/incomplete evidence failure, repository conflict, and disable rollback.
- `operations/specs/context-learning/cross-session-continuity-pilot-policy.md` defines the boundary and package contents.

## Safety invariants

- status: `READY_READ_ONLY` for valid source/target state
- transcripts ingested: 0
- writes performed: 0
- providers called: 0
- sessions merged: 0
- sessions closed: 0
- authority changed: false

## Acceptance

Focused continuity-pilot tests, full context-learning regressions, contract/broker validation, documentation consistency, syntax checks, and `git diff --check` must pass. Existing session sources and protected unrelated dirty files remain untouched.

## Limitations and rollback

The source environment is represented by a bounded fixture; no raw conversation was ingested and no external session was resumed. Disable the projection to roll back. Any stale, conflicting, mismatched, superseded, or incomplete source fails closed.
