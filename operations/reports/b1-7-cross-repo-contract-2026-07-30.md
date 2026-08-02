# B1.7 — Cross-Repo Contract Check

**Date:** 2026-07-30  
**Task:** B1.7 — Add a cross-repo contract check  
**Repository:** Brain-owned implementation; read-only Mind metadata verification  
**Branch:** `release/brain-stabilization-v1`  
**HEAD:** `61b9cfe7169ce38759a4f5b2072c1ab6b1968095`

## Authority and scope

- Brain implementation plan: `operations/specs/infinite-brain-runtime-implementation-plan.md`, B1.7, lines 462–468.
- Mind evidence: `/Users/Office/Repos/stevewesthoek/mind/system/reports/b1-7-mind-entrypoint-intake-verification-2026-07-30.md`.
- Checker: `tools/scripts/validate-cross-repo-contract.mjs`.
- Package command: `npm run infinite-brain:cross-repo-contract`.

The checker derives the sibling Mind root from the Brain root, accepts no arbitrary repository roots, performs filesystem and approved metadata reads only, and never writes either repository.

## Contract identifiers compared

- Mind bridge contract ID: `brain-mind-bridge`.
- Mind human bridge policy version: `2.0`.
- Brain contract registry version: `1.0.0`.
- Brain contract-layer schema version: `1.0.0`.

These are distinct authoritative identifiers; the checker does not falsely require the human bridge policy version and Brain machine-schema versions to be numerically equal. The planned Context Gateway schema is not used or claimed as implemented.

## Checks and results

- Required Mind entrypoint files: `system/agent-context/AGENTS.md`, `00-start-here.md`, `00-current-context.md`, and `00-memory-map.md` — **PASS**.
- Canonical intake directories: `inbox/new`, `inbox/raw`, `resources`, `inbox/processed`, and `inbox/failed` — **PASS**.
- Bridge contract ID and policy version — **PASS**.
- Brain registry and contract-layer schema versions — **PASS**.
- Six active Brain instruction files use `mind/system/agent-context/` — **PASS**.
- B1.6 stale predecessor patterns — **PASS**, zero active matches.

## Fixture coverage

The fixture mode is isolated under `tools/fixtures/b1-7-cross-repo-contract/` and does not read the live Mind repository.

- `valid.json` — **PASS**, exit 0.
- `stale-path.json` — **PASSING NEGATIVE**, `STALE_ACTIVE_PATH`, exit 1.
- `missing-entrypoint.json` — **PASSING NEGATIVE**, `MISSING_ENTRYPOINT`, exit 1.
- `intake-mismatch.json` — **PASSING NEGATIVE**, `INTAKE_PATH_MISMATCH`, exit 1.
- `bridge-mismatch.json` — **PASSING NEGATIVE**, `BRIDGE_CONTRACT_MISMATCH`, exit 1.
- `schema-mismatch.json` — **PASSING NEGATIVE**, `SCHEMA_VERSION_MISMATCH`, exit 1.
- `malformed.json` — **PASSING NEGATIVE**, `MALFORMED_METADATA`, exit 1.
- Arbitrary fixture path injection — **PASSING NEGATIVE**, rejected before read.

## Validation

- `npm run infinite-brain:cross-repo-contract` — **PASS**.
- `node --test tools/scripts/validate-cross-repo-contract.test.mjs` — **PASS**, 9/9 tests.
- All fixture JSON parse checks — **PASS**.
- `node tools/validate-brain-document-consistency.mjs` — **PASS**.
- `git diff --check` — **PASS**.

No Mind files were modified. Existing dirty, staged, and untracked work was preserved.

## Explicit exclusions

No Workbench Private, ProChat, CBM runtime, Graphify runtime, Orbit, semantic ingestion, network, scheduler, hook, service, cache, index, or external repository mutation occurred. B1.7 is a read-only contract check and does not implement the Context Gateway or any future schema beyond the identifiers explicitly compared above.
