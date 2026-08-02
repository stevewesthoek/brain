# B3.1 — Evaluation Loader

**Date:** 2026-07-16  
**Status:** complete

Added the canonical evaluation corpus and source loaders for the Mind Context package.

## Result

- the evaluation corpus loads with schema validation
- duplicate case IDs are rejected
- missing metadata is rejected
- evaluation sources load from the package fixture registry
- source paths are validated as existing markdown files

## Validation

- `npm --prefix projects/mind-context test`
- `node --test tools/validate-retrieval-evaluation-corpus.test.mjs`

## Notes

- The loader uses the package-local canonical validator rather than duplicating schema checks.
