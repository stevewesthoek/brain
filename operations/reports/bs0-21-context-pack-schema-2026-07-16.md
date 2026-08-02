# BS0.21 — Context pack schema

**Date:** 2026-07-16  
**Status:** implemented; validation passed

## Contract purpose

Define the executable `Context Pack 1.0` envelope for read-only retrieval output. The contract captures authority, freshness, citations, conflicts, unknowns, privacy scope, budget accounting, truncation state, provenance, and runtime state without granting any write or policy authority.

## Version

- Schema version: `1.0`
- Validated against the `mind-context` runtime contract and fixtures for the same version line.

## Schema ownership

- Canonical schema: [`operations/specs/context-pack.schema.json`](/Users/Office/Repos/stevewesthoek/brain/operations/specs/context-pack.schema.json)
- Runtime validator: [`projects/mind-context/src/context-pack.mjs`](/Users/Office/Repos/stevewesthoek/brain/projects/mind-context/src/context-pack.mjs)
- CLI validator: [`tools/validate-context-pack.mjs`](/Users/Office/Repos/stevewesthoek/brain/tools/validate-context-pack.mjs)
- Test coverage: [`tools/validate-context-pack.test.mjs`](/Users/Office/Repos/stevewesthoek/brain/tools/validate-context-pack.test.mjs)

## Typed fields

- Top level: `packId`, `version`, `queryId`, `generatedAt`, `freshness`, `authorizedScopes`, `sources`, `conflicts`, `unknowns`, `exclusions`, `privacyClassification`, `budget`, `truncation`, `provenance`, `state`, `safetyWarnings`, `modelSuppliedAuthority`
- Source entries: `sourceId`, `path`, `authority`, `citation`, `sha256`, `freshness`, `scope`, `untrusted`
- Conflict entries: `field`, `leftSourceId`, `rightSourceId`
- Exclusion entries: `sourceId`, `reason`
- Budget fields: `maxItems`, `maxTokens`, `usedItems`, `usedTokens`
- Truncation fields: `truncated`, `reason`
- Provenance fields: `retriever`, `corpusVersion`, `deterministicOrder`
- State fields: `repository`, `deployed`, `observed`, `verified`

## Fail-closed behavior

- Missing citation data is rejected.
- Invalid authority labels are rejected.
- Scope escapes are rejected when a source falls outside the authorized scopes.
- Negative or out-of-range budget values are rejected.
- Missing provenance is rejected.
- Hidden unknowns are rejected.
- Conflicts must identify two different source IDs.

## Model restrictions

- `modelSuppliedAuthority` is forbidden.
- Policy-like text is still treated as untrusted source data.
- Sources can be marked `untrusted` even when their authority is `canonical`, `supporting`, or `conflicting`.

## Validation summary

- `node tools/validate-context-pack.mjs` passed.
- `node --test tools/validate-context-pack.test.mjs` passed.
- `node --test projects/mind-context/test/retrieval-core.test.mjs` passed.
- `node --check` passed for the new `mind-context` implementation and validator `.mjs` files.
- JSON parse validation passed for `operations/specs/context-pack.schema.json` and `operations/fixtures/context-pack-fixtures-v1.json`.
- A malformed closing brace in `operations/specs/retrieval-evaluation-corpus.schema.json` was repaired before the final validation pass.

## Files created

- `operations/specs/context-pack.schema.json`
- `operations/fixtures/context-pack-fixtures-v1.json`
- `projects/mind-context/src/context-pack.mjs`
- `tools/validate-context-pack.mjs`
- `tools/validate-context-pack.test.mjs`
- `operations/reports/bs0-21-context-pack-schema-2026-07-16.md`

## Remaining dependencies

- Thin retrieval adapters still depend on the deterministic retrieval core and its parity checks.
- The broader Context Gateway adapter layer remains pending outside this schema contract.
- BS0.23 remains the next adapter-only boundary after core parity is confirmed.

## Final verdict

BS0.21 is complete. The context-pack schema is versioned, typed, fail-closed, and validated against the current `mind-context` runtime and fixtures.
