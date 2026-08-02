# B7.7 — Backup, Restore, and Runtime Recovery Checks

**Date:** 2026-07-17  
**Scope:** repository-only, fixture-only, temp-dir-only  
**Status:** complete

## What changed

- Added a machine-readable recovery inventory at
  `operations/specs/infinite-brain-recovery-inventory.json`.
- Added a JSON schema for the recovery inventory at
  `operations/specs/infinite-brain-recovery-inventory.schema.json`.
- Added a non-destructive recovery verifier at
  `tools/infinite-brain-recovery-check.mjs`.
- Added focused tests at `tools/infinite-brain-recovery-check.test.mjs`.

## Recovery inventory coverage

The inventory classifies 18 recovery-critical entries across:

- canonical Brain contracts
- canonical Mind entrypoints, read-only
- generated capability state and manifest data
- provider-admission evidence
- rollback evidence
- generated/runtime/cache state

The inventory records recovery order plus reproducible-source and backup-evidence
references for each entry. Canonical entries require at least one provenance
reference, and the verifier fails closed if that requirement is violated.

## Safety checks proved

The verifier:

- restores only into a temporary directory
- never writes to Brain, Mind, or Workbench Private
- rejects path traversal
- rejects symlink escape
- rejects live-repository destinations
- reports required and optional missing files
- reports excluded runtime/cache entries without writing them
- reports recovery order
- reports reproducible-source references
- cleans up temporary state
- emits a deterministic report hash

## Validation

Passed on 2026-07-17:

- `node --test tools/infinite-brain-recovery-check.test.mjs`
- `node /Users/Office/Repos/stevewesthoek/brain/tools/infinite-brain-recovery-check.mjs`
- `npm --prefix projects/brain-core run build`
- `npm --prefix projects/brain-core run typecheck`
- `npm --prefix projects/mind-steward run build`
- `npm --prefix projects/mind-steward run typecheck`
- `npm --prefix projects/mind-context test`
- `npm --prefix projects/mind-context run eval`
- capability manifest/state/inventory validation
- provider-admission validation
- performance-budget validation
- documentation consistency validation

## Evidence

- Report hash: `fe624dce6789ce218fd8f86945c4bb0edc6ce4005b139e26c712b3cdac21cbc3`
- Inventory entries: `18`
- Restored files: `14`
- Optional missing files: `0`
- Required missing files: `0`
- Excluded runtime/cache entries: `4`

## Blocker check

No canonical file in the recovery inventory lacked both a documented backup
reference and a reproducible-source reference.

## Next task

`B1.0a — Deploy and verify Save-to-Mind target paths`
