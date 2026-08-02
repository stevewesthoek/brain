# B3.2 — Metric Calculator

**Date:** 2026-07-16  
**Status:** complete

Implemented the evaluation metric calculator for the Mind Context benchmark corpus.

## Result

- per-case metrics calculate precision, recall, forbidden violations, privacy violations, authority match, freshness match, token estimate, and latency
- summary aggregation is deterministic
- fixture results match the expected corpus behavior

## Validation

- `npm --prefix projects/mind-context test`

## Notes

- The calculator is packaged with the evaluation loader and benchmark runner so the metrics can be executed from one command path.
