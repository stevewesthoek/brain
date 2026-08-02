# B2.2 — Context-pack schema

**Date:** 2026-07-16  
**Status:** complete

Aligned the package validator with the canonical `operations/specs/context-pack.schema.json` contract and kept a single validator path for all surfaces.

## Result

- Canonical schema: `operations/specs/context-pack.schema.json`
- Canonical validator: `projects/mind-context/src/context-pack.mjs`
- Package compatibility wrapper: `projects/mind-context/src/core/context-pack.mjs`
- Validator surfaces: package tests, smoke test, and tool wrappers

## Validation

- `node --check projects/mind-context/src/index.mjs projects/mind-context/src/core/*.mjs projects/mind-context/src/cli/*.mjs projects/mind-context/src/adapters/*.mjs projects/mind-context/test/*.mjs`
- `npm --prefix projects/mind-context test`
- `npm --prefix projects/mind-context run smoke`
- `node tools/validate-context-pack.mjs`
- `node --test tools/validate-context-pack.test.mjs`

## Negative coverage

- missing citation
- invalid authority
- unauthorized scope
- missing hash
- invalid freshness
- missing provenance
- negative or excessive budget
- conflict without both source sides
- model-supplied authority
- hidden unknown state

## Notes

- The package and tools both call the same validator logic.
- Schema validation remains fail-closed on unsafe or incomplete pack metadata.
