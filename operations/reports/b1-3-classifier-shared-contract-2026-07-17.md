# B1.3 — Classifier Shared Contract

**Date:** 2026-07-17  
**Scope:** repository-only, fixture-only  
**Status:** complete

## What changed

- Migrated classifier intake resolution to the shared canonical Mind contract.
- Replaced hard-coded active intake paths with contract-backed values.
- Kept the classifier dependency-free from a circular Brain Core import.
- Added safe discovery checks for missing inbox, empty inbox, traversal, and
  symlink cases.

## Validation

- `npm --prefix projects/mind-steward run build`
- `npm --prefix projects/mind-steward run typecheck`
- `npm --prefix projects/mind-steward run test`
- `node --test projects/mind-steward/src/tests/classifier-paths.test.ts`

## Evidence

- `projects/mind-steward/src/classifier.ts`
- `projects/mind-steward/src/contracts.ts`
- `projects/mind-steward/src/tests/classifier-paths.test.ts`

## Notes

The classifier now normalizes paths against the resolved Mind root so fixture
paths remain stable and unsafe entries fail closed.
