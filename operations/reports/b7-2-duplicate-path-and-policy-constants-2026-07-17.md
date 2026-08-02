# B7.2 Duplicate Path and Policy Constants

**Date:** 2026-07-17  
**Scope:** repository-only, fixture-only
**Status:** complete

## Change summary

Extracted the shared boundary contract into
`operations/specs/infinite-brain-boundary-contracts.js` and used it from Brain
Core, Mind Steward, and supporting validators/scripts so the path and policy
constants now have one canonical source.

## Evidence

- `operations/specs/infinite-brain-boundary-contracts.js`
- `operations/specs/infinite-brain-boundary-contracts.d.ts`
- `projects/brain-core/src/adapters/infinite-brain-exact-scope-approval.ts`
- `projects/brain-core/src/mind-paths.ts`
- `projects/mind-steward/src/preview.ts`
- `projects/mind-steward/src/maintenance-preview.ts`
- `tools/n8n-save-to-mind-artifact-safety.mjs`
- `tools/generate-capability-manifest.mjs`
- package-local declaration files for the shared JS module

## Validation

- `node --test operations/specs/infinite-brain-boundary-contracts.test.mjs` -> pass
- `npm --prefix projects/brain-core run build` -> pass
- `npm --prefix projects/brain-core run typecheck` -> pass
- `npm --prefix projects/mind-steward run build` -> pass
- `npm --prefix projects/mind-steward run typecheck` -> pass
- `git diff --check` -> pass

## Repair

- Fixed the canonical preview target to `system/agent-context/current.md` once
  the first test run exposed a double-slash path bug.

## Verdict

`B7.2 complete; no scope expansion or authority broadening.`
