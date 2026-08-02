# B2.4 — Deterministic ranking

**Date:** 2026-07-16  
**Status:** complete

Implemented a single lexical ranking core under `projects/mind-context/src/core/rank.mjs` with deterministic ordering and explicit score components.

## Result

- exact term and title matching
- explicit link signal
- canonical-path class bonus
- current status signal
- freshness signal
- authority signal
- stable tie-breaking on path and source ID

## Validation

- `npm --prefix projects/mind-context test`
- `npm --prefix projects/mind-context run smoke`

## Notes

- No model or embedding dependency was introduced.
- Ranking stays purely lexical and repeatable on identical inputs.
