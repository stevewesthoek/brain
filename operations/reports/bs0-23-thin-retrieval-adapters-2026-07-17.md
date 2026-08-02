# BS0.23 — Thin Retrieval Adapters

**Date:** 2026-07-17  
**Scope:** repository-only, fixture-only, read-only adapter parity  
**Status:** complete

## What changed

- Kept the retrieval adapter surface thin and read-only.
- Reused the existing `projects/mind-context` deterministic core and fail-closed
  availability gate.
- Preserved the single manifest/status core across the CLI and fixture-facing
  adapter path.

## Validation

- `npm --prefix projects/mind-context test`
- `npm --prefix projects/mind-context run eval`
- `npm --prefix projects/brain-core run build`
- `npm --prefix projects/brain-core run typecheck`
- capability manifest/state/inventory validation
- provider-admission validation
- `npm run infinite-brain:conformance`

## Evidence

- `projects/mind-context/src/core/gateway-commands.mjs`
- `projects/mind-context/test/adapter-parity.test.mjs`
- `projects/mind-context/test/cli.test.mjs`
- `operations/specs/infinite-brain-runtime-implementation-plan.md`

## Notes

No policy, ranking, budget, scope, or rendering logic was duplicated.
Unavailable-core behavior fails closed with `core_unavailable`.
