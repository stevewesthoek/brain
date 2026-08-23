# MRU0-P3.4 Multi-Client Activation Pilot Acceptance

**Status:** complete — bounded read-only consumption enabled for three client profiles
**Date:** 2026-08-23

## Activation state

Claude Code, Codex, and Workbench each consumed the same provider-neutral Universal Brain Entry projection through bounded read-only harnesses. No client configuration or external runtime was modified.

## Evidence

- `tools/context-learning/multi-client-activation-pilot.mjs` runs one shared-entry pilot with independent per-client gates and measurements.
- `tools/context-learning/multi-client-activation-pilot.test.mjs` covers shared contract compatibility, all-client conformance, per-client fail-closed behavior, and disable rollback.
- `operations/specs/context-learning/multi-client-activation-pilot-policy.md` defines the shared path, continuity boundary, and safety model.

## Safety invariants

- Claude activation: `LIVE_BOUNDED_READ_ONLY`
- Codex activation: `LIVE_BOUNDED_READ_ONLY`
- Workbench activation: `LIVE_BOUNDED_READ_ONLY`
- shared entry: true
- execution authority: false
- mutation authority: false
- automatic resume/takeover: false
- writes performed: 0
- providers called: 0
- configuration changed: false

## Acceptance

Focused multi-client tests, full context-learning regressions, contract/broker validation, documentation consistency, syntax checks, and `git diff --check` must pass. Protected client configuration and unrelated dirty files remain untouched.

## Remaining unauthorized capabilities

Autonomous actions, remediation, scheduling, provider mutation, credential changes, automatic session takeover/merge, transcript ingestion, and automatic knowledge updates remain unauthorized.

## Rollback

Run the pilot with `enabled=false` and restore each client's prior context path. No client configuration or canonical Brain/Mind state is changed.
