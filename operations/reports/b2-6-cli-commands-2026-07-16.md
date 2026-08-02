# B2.6 — CLI Commands

**Date:** 2026-07-16  
**Status:** complete

Implemented the read-only `resolve`, `explain`, and `health` commands for the Mind Context CLI package.

## Result

- `resolve` returns a normalized context pack in JSON or Markdown
- `explain` surfaces ranking, exclusions, budget, truncation, conflicts, and unknowns
- `health` reports the package as read-only and fixture-only
- command parsing enforces explicit root, scope, and query inputs
- invalid inputs return stable structured exit codes

## Validation

- `npm --prefix projects/mind-context test`
- `npm --prefix projects/mind-context run smoke`

## Notes

- The CLI delegates to the same core planner and renderer used by the package tests.
- No write path was added.
