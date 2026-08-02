# B2.5 — Budgeting and rendering

**Date:** 2026-07-16  
**Status:** complete

Implemented deterministic budget selection and normalized JSON/Markdown rendering for context packs.

## Result

- item and token budgeting in `projects/mind-context/src/core/budget.mjs`
- whole-item omission when a budget would be exceeded
- render helpers in `projects/mind-context/src/core/render.mjs`
- normalized JSON output for schema validation
- normalized Markdown output for human-readable packs

## Validation

- `npm --prefix projects/mind-context test`
- `npm --prefix projects/mind-context run smoke`
- JSON rendering validated by `projects/mind-context/src/context-pack.mjs`

## Notes

- Truncation preserves complete sources instead of emitting partial invalid excerpts.
- The renderer consumes the normalized pack structure only.
