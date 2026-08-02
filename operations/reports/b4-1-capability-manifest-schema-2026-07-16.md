# B4.1 — Capability Manifest Schema

**Date:** 2026-07-16  
**Status:** complete

Defined the capability-manifest schema for Brain runtime capabilities.

## Result

- capability entries now require ID, owner, description, state, safety mode, contract ID, schema path, entrypoint, evidence command, evidence report, verification date, dependency list, feature flag, rollback/disable command, repository state, deployed state, observed state, verified state, scope boundaries, approval requirement, and evidence references
- the schema uses closed enums for state, safety mode, and approval requirement
- external mutation must remain approval-gated
- safe repository-relative path validation is encoded in the validator rules

## Validation

- `node --test tools/validate-capability-manifest.test.mjs`

## Notes

- The schema is intentionally conservative so live capability truth cannot be upgraded without observable evidence.
