# B3.3 — Fixed Benchmark Command

**Date:** 2026-07-16  
**Status:** complete

Added the fixed `npm run eval` benchmark command for the Mind Context package.

## Result

- the benchmark runs against the canonical corpus and source registry
- output includes timestamped JSON and Markdown artifacts
- environment metadata is separated from the scores
- repeated runs remain deterministic on the same commit

## Validation

- `npm --prefix projects/mind-context run eval`
- `npm --prefix projects/mind-context test`

## Notes

- The generated benchmark outputs are written under the package-local ignored `out/` directory.
