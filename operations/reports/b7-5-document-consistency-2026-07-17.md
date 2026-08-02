# B7.5 Documentation Consistency Check

**Date:** 2026-07-17  
**Scope:** repository-only, fixture-only
**Status:** complete

## Change summary

Added a documentation consistency checker that scans active docs and config
instructions for stale Mind paths, broken canonical links, duplicate status
owners, and unsupported capability wording.

## Evidence

- `tools/validate-brain-document-consistency.mjs`
- `tools/validate-brain-document-consistency.test.mjs`

## Validation

- `node --test tools/validate-brain-document-consistency.test.mjs` -> pass
- Current canonical docs -> pass
- Seeded stale fixture -> fails as expected
- `git diff --check` -> pass

## Scope check

The checker fails closed on stale or broken canonical references while keeping
archived/history references explicit and allowed where appropriate.

## Verdict

`B7.5 complete; current docs pass and stale fixtures fail as expected.`
