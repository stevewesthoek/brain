# MRU0-P2.8 Universal Entry Client Conformance Acceptance

**Status:** accepted read-only validation layer
**Date:** 2026-08-23

## Scope

This packet validates the existing provider-neutral Universal Brain Entry consumption output for Claude, Codex, Workbench, and future-agent profiles. It validates compatibility; it does not activate clients or create client adapters.

## Evidence

- `tools/context-learning/universal-entry-conformance.mjs` provides deterministic conformance and failure validators.
- `tools/context-learning/universal-entry-conformance.test.mjs` covers all four profiles, bounded/provider-neutral consumption, stale/conflict fail-closed behavior, no authority escalation, and missing-input rejection.
- `operations/specs/context-learning/universal-entry-client-conformance-policy.md` defines the canonical client-neutral requirements and boundaries.

## Safety invariants

- configuration changed: false
- activation performed: false
- providers called: 0
- writes performed: 0
- execution and mutation authority: false

## Acceptance

Focused conformance tests, full context-learning regressions, contract and broker validation, documentation consistency, syntax checks, and `git diff --check` must pass. Protected client/configuration and unrelated dirty files remain untouched.

## Next boundary

The next packet may plan client-specific conformance fixtures or activation gates. It must not activate clients or alter their authority without separate authorization.
