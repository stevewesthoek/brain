# B3.4 — Semantic Ranker Gate

**Date:** 2026-07-16  
**Status:** complete

Implemented the fail-closed semantic-ranker comparison gate and its smoke evidence path.

## Result

- the gate compares baseline and candidate benchmark runs against the same corpus and schema
- nondeterminism, missing cases, authority drift, privacy regressions, forbidden-source regressions, citation regressions, conflict suppression, unknown suppression, and budget failures all fail closed
- a deterministic smoke benchmark passes the gate and proves the comparison path is executable
- the current live `npm --prefix projects/mind-context run eval:gate` pair remains fail-closed on the present benchmark artifacts, which is acceptable for the gate implementation but not used as the capability evidence command

## Validation

- `node tools/run-semantic-ranker-gate-smoke.mjs`
- `node --test projects/mind-context/test/semantic-ranker-gate.test.mjs`

## Notes

- Evidence command for the capability inventory is the smoke wrapper, not the live benchmark pair.
- The live benchmark pair still reports citation-missing reasons on the current corpus, so the gate remains fail-closed on that comparison.
