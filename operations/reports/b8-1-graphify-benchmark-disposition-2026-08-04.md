# B8.1 Graphify Benchmark Disposition — 2026-08-04

## Decision

**Graphify remains blocked.** The proposed B8.1 run yields partial evidence only.

## Rationale

1. No bounded P8-specific Graphify executable contract exists on current `main` (`57b2bd3c`).

2. The M7.1 one-shot Mind Graphify baseline (`20260804T000604198Z-06de527423e0`) was a one-time non-authoritative snapshot with future execution authority `none`. It does not authorize P8 benchmark execution, indexing, scheduling, or provider activation.

3. The `operations/specs/b8-1-context-memory-benchmark-plan.md` explicitly states: "Graphify remains blocked because no exact bounded code-only executable contract has been proven and stabilized on current main."

4. `validate-graphify-operational-profiles.test.mjs` enforces that no operational Graphify profile authorizes benchmark-mode execution.

## Consequence

- B8.1 proceeds with subjects `cbm,exact-source` only.
- `partialEvidence` is `true` in the dry-run plan.
- The plan explicitly records Graphify exclusion and reason.
- B8.1 cannot be marked complete without either:
  - A separate explicit Graphify code-only benchmark approval; or
  - A human decision that B8.1 partial evidence is sufficient for P8 progression.

## What this does NOT authorize

- P8 activation
- Graphify indexing, scheduling, or provider startup
- B8.2 execution
- Inference that M7.1 baseline grants ongoing authority
- Any weakening of the Graphify execution gate

## Status

- P8: 0/6 accepted
- B8.1: incomplete (partial evidence only)
- B8.2: unauthorized
- Graphify benchmark: blocked
