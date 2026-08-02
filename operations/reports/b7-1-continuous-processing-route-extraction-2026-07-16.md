# B7.1 Continuous-Processing Route Extraction

**Date:** 2026-07-16
**Scope:** one bounded route-domain extraction
**Mode:** repository-only

## Result

Extracted the smallest independently testable route family from `projects/brain-core/src/api/routes.ts` into one new domain router without changing public request/response behavior.

## Bounded prefix

- Extracted prefix: `/scheduler/continuous-processing`
- Why bounded:
  - it is one scheduler family with a clear shared response shape
  - it can be exercised with a single focused router test file
  - it reuses existing response and error helpers
  - it does not require cross-domain routing changes

## Changed surface

- `projects/brain-core/src/api/domain-routers/continuous-processing-router.ts`
- `projects/brain-core/src/api/routes.ts`
- `projects/brain-core/src/tests/continuous-processing-router.test.ts`

## Validation

- route tests for the extracted prefix: pass
- measurement tests covering the affected route surface: pass
- Brain Core build/typecheck: pass
- `git diff --check`: pass
- scoped diff inspection: pass

## Outcome

All extracted route IDs, status codes, and payload shapes remained stable for:

- selection
- stability
- concurrency
- failure buffer
- large-file fallback
- large-file fallback plan
- measurement
- disable/recovery

## Blockers

- no safe second prefix was extracted in this batch
- no route renaming
- no API contract change

## Next canonical task

`B7.2 — Remove duplicate path and policy constants`
