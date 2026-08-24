# MRU0-P3.44 Conversation Intelligence Usefulness Measurements

**Date:** 2026-08-24
**Sample:** 4 explicitly selected real-work session-evidence items

## Measured outcomes

| Metric | Result | Evidence quality |
|---|---:|---|
| Items entering review | 4/4 | Direct workflow output |
| Items with preserved provenance and source identity | 4/4 | Direct workflow output |
| Items with visible uncertainty/freshness | 4/4 | Direct workflow output |
| Items receiving explicit human state | 4/4 | Direct workflow output |
| Useful or highly useful | 3/4 (75%) | Operator rating |
| Explicitly distracting | 1/4 (25%) | Operator rating |
| Correct extraction | 1/4 (25%) | Operator rating; structured candidates, not autonomous extraction |
| Partial context/quality | 2/4 (50%) | Operator rating |
| Explicit false positive | 1/4 (25%) | Only the candidate explicitly rated unnecessary |
| Observed false negative | 0 identified | Not measurable without an independent session reference set |
| Missing provenance | 0 identified | Direct workflow output |
| Unclear evidence | 2/4 | Stale or incomplete context required defer/archive handling |

## What the evidence supports

- The evidence envelope reduces future investigation cost by preserving where a candidate came from and whether it is stale.
- The review workflow improves recall of unresolved questions and lessons that would otherwise remain inside a client session.
- Human state transitions provide a safe way to discard noise without mutating the source session.

## What the evidence does not support

- It does not establish autonomous extractor precision or recall because candidates were supplied as structured records.
- It does not justify a production noise threshold from four items.
- It does not show that historical scanning or model extraction would improve decisions enough to offset privacy and operational risk.

