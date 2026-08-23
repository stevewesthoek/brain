# MRU0-P3.6 Maintenance Prioritization Intelligence Acceptance

**Status:** complete — report-only advisory prioritization
**Date:** 2026-08-23

## Scope

Existing maintenance findings are transformed into transparent advisory attention signals. Scores remain non-authoritative and do not reorder human priorities or create downstream actions.

## Evidence

- `tools/context-learning/maintenance-prioritization-intelligence.mjs` provides bounded deterministic prioritization.
- `tools/context-learning/maintenance-prioritization-intelligence.test.mjs` covers impact/confidence/freshness factors, provenance, Mind review, unknown authority/freshness, determinism, and bounds.
- `operations/specs/context-learning/maintenance-prioritization-intelligence-policy.md` defines the advisory boundary.

## Safety invariants

- prioritization authority: false
- ranking is advisory: true
- decisions created: 0
- proposals created: 0
- canonical updates: 0
- writes performed: 0
- providers called: 0
- human priorities changed: false

## Acceptance

Focused prioritization tests, full context-learning regressions, contract/broker validation, documentation consistency, syntax checks, and `git diff --check` must pass. No client, Brain, Mind, or configuration files are modified.

## Limitations and rollback

Scores do not establish importance, truth, or urgency for Mind. Human review is required. Stop invoking the analyzer to roll back; it has no persistent state or mutation path.
