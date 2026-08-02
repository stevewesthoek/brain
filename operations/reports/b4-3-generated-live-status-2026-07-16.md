# B4.3 — Generated Live Status

**Date:** 2026-07-16  
**Status:** complete

Generated the live capability-status page from the capability manifest.

## Result

- the live status page now renders from the inventory under generated markers
- generated content is idempotent under repeated writes
- manual edits inside the generated block are detected by the `--check` path
- human notes remain outside the generated block

## Validation

- `node --test tools/generate-infinite-brain-capability-status.test.mjs`

## Notes

- The generated table is the canonical live status view until B4.4 replaces the remaining hand-maintained duplicate view.
