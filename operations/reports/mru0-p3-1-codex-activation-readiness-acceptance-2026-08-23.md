# MRU0-P3.1 Codex Activation Readiness Acceptance

**Status:** complete — readiness prepared, Codex not activated
**Date:** 2026-08-23

## Activation boundary

The first real-client path is prepared for Codex only. It performs provider-neutral entry discovery, bounded bootstrap consumption, Codex conformance, session/revision checks, continuation-context generation, freshness visibility, and rollback definition. It does not activate Codex runtime configuration or automatically resume a session.

## Evidence

- `tools/context-learning/codex-activation-readiness.mjs` prepares read-only Codex readiness and continuation context.
- `tools/context-learning/codex-activation-readiness.test.mjs` covers readiness, revision mismatch, session conflict, missing session, bounded pointers, and safety invariants.
- `operations/specs/context-learning/codex-activation-readiness-policy.md` defines the Codex boundary and rollback.

## Safety invariants

- activation state: `READY_NOT_ACTIVATED` for a valid session
- Codex configuration changed: false
- automatic resume: false
- transcript ingestion: none
- writes performed: 0
- providers called: 0
- execution/mutation authority: false

## Acceptance

Focused Codex readiness tests, full context-learning regressions, contract/broker validation, documentation consistency, syntax checks, and `git diff --check` must pass. `operations/system-configs/codex/AGENTS.md` remains untouched.

## Limitations and next boundary

This is not live Codex activation and does not prove an external Codex session consumed the entry. A separate owner-authorized packet is required for any real activation, with explicit runtime evidence and rollback ownership.
