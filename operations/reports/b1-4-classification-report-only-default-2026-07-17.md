# B1.4 — Classification Report-Only Default

**Date:** 2026-07-17  
**Scope:** repository-only, fixture-only  
**Status:** complete

## What changed

- Made classification default to dry-run/report-only.
- Required explicit `--mode=apply` and left apply disabled pending approval
  integration proof.
- Rejected conflicting dry-run/apply flags.
- Ensured blocked apply paths do not modify fixture hashes.

## Validation

- `npm --prefix projects/mind-steward run build`
- `npm --prefix projects/mind-steward run typecheck`
- `npm --prefix projects/mind-steward run test`
- `node --test projects/mind-steward/src/tests/classifier-paths.test.ts`
- `node --test projects/mind-steward/src/tests/classify-captures-cli.test.ts`

## Evidence

- `projects/mind-steward/src/classifier.ts`
- `projects/mind-steward/src/cli/classify-captures.ts`
- `projects/mind-steward/src/tests/classifier-paths.test.ts`
- `projects/mind-steward/src/tests/classify-captures-cli.test.ts`

## Notes

Apply remains intentionally disabled until approval integration is proven.
