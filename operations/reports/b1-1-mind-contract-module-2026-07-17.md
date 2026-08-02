# B1.1 — Mind Contract Module

**Date:** 2026-07-17  
**Scope:** repository-only, fixture-only  
**Status:** complete

## What changed

- Added one canonical immutable Mind contract in the shared boundary spec.
- Exposed the contract through Brain Core and Mind Steward wrappers without
  duplicating path policy.
- Preserved backward-compatible re-exports from `mind-paths.ts`.

## Validation

- `node --test operations/specs/infinite-brain-boundary-contracts.test.mjs`
- `node --test projects/brain-core/src/tests/mind-contract.test.ts`
- `npm --prefix projects/brain-core run build`
- `npm --prefix projects/brain-core run typecheck`

## Evidence

- `operations/specs/infinite-brain-boundary-contracts.js`
- `operations/specs/infinite-brain-boundary-contracts.d.ts`
- `operations/specs/infinite-brain-boundary-contracts.test.mjs`
- `projects/brain-core/src/contracts/mind-contract.ts`
- `projects/brain-core/src/mind-paths.ts`

## Notes

Current success and failure intake paths, authority labels, review surfaces,
and historical-only paths now come from one shared contract.
