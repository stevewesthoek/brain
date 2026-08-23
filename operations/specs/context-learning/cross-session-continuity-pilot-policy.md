# Infinite Brain Cross-Session Continuity Pilot Policy

**Status:** MRU0-P3.3 bounded read-only continuity pilot
**Runtime boundary:** projection only; no session takeover, merge, close, write, transcript ingestion, or provider call

## Continuity flow

`source session/handoff → continuity validation → repository/revision binding → bounded continuation package → target environment`

Source sessions may be represented by validated fixtures. The pilot stores no conversations and does not replace `.ai/current.md`, `.ai/handoffs/`, or the session-continuity inventory.

## Continuation package

The package contains only objective, completed/pending work, blockers, decisions, changed-file references, validation evidence, continuation point, next action, freshness, source/target environments, and confirmation requirement. It is bounded and reference-based.

## Fail-closed cases

Missing source/target/session identity, stale or superseded source, source conflict, repository/worktree/branch mismatch, revision mismatch, or incomplete validation evidence blocks projection. No newest-text or latest-environment heuristic resolves conflicts.

## Authority and rollback

Brain remains the continuity authority; source and target environments remain replaceable adapters. Disable the projection to roll back; no session state is changed. Sessions are never automatically resumed, merged, or closed.
