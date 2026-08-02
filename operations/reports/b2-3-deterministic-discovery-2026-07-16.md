# B2.3 — Deterministic discovery

**Date:** 2026-07-16  
**Status:** complete

Implemented the shared discovery core under `projects/mind-context/src/core/discover.mjs` with deterministic Markdown-only traversal and fail-closed filtering.

## Result

- explicit allowed root and scopes
- Markdown-only inclusion
- deterministic lexical path ordering
- exact repository-relative normalized paths
- safe missing-root behavior
- path traversal rejection
- symlink escape rejection
- binary file rejection
- secret-bearing path rejection
- default exclusion of history, archive, generated, runtime, logs, node_modules, build, dist, coverage, `.git`, `.obsidian`, and `.env*`
- typed metadata for source ID, path, title, headings, frontmatter, links, freshness, authority, and privacy

## Validation

- `npm --prefix projects/mind-context test`
- `npm --prefix projects/mind-context run smoke`

## Notes

- Synthetic fixtures only.
- No production Mind content was read.
- Symlink escape is rejected explicitly rather than silently followed.
