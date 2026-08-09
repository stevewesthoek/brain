# Workbench MCP Reproducible Admission

**Date:** 2026-08-09
**Admission:** `workbench-for-brain`
**Decision:** `active-local`

## Provider identity

- Repository: `/Users/Office/Repos/prochattools/saas/workbench-private`
- Admitted revision: `87ce34385277ce5bcbfd45266dbe2d925a536933`
- Build-source revision: `7acdb6f88bcd0db37c1b515dfe627a1594ed1a32`
- Package version: `1.3.3-beta`
- Runtime entrypoint: `packages/mcp/dist/server.js`
- Entrypoint SHA-256: `5a29fe32973b5e63b8906d5470beaf6656501db26debcf33d0ed8429125fb91d`
- Runtime provenance manifest SHA-256: `b0673fd8e18801c376c654e8646d8f0fb40497c298f8442f27b1db453fd509d4`
- Runtime aggregate SHA-256: `fe1123c3a0a09a1bb285cca2114863232019af5dd3bb3506f1d1e1ecb24175f0`

## Provenance proof

Workbench's committed `packages/mcp/runtime-provenance.json` binds 54 committed
source inputs to 32 generated JavaScript runtime artifacts under Node
`v20.20.2` and pnpm `10.33.0`. The admitted revision differs from the manifest's
source revision only by the manifest itself.

Brain's provider verifier checks:

- the admitted Git HEAD;
- the committed manifest digest;
- the source-revision ancestry and manifest-only revision delta;
- every source record against both the current file and its Git blob;
- every runtime record against the actual non-symlink file;
- entrypoint and aggregate digests;
- package-version parity.

Synthetic regressions reject runtime tampering and a provenance commit that
changes provider source in addition to the manifest.

## Scope and authentication

Admission remains exactly:

- `getWorkbenchStatus`;
- `readWorkbenchContext`;
- `runWorkbenchCommand`, limited to `n8n_workflow_migration`.

The Brain-project Codex registration uses the provider-owned `brain` profile,
Node `v20.20.2`, project scope, `shell=false`, and a reference to the established
owner-only credential file. No credential value was printed, logged, or
committed. The global Codex config was unchanged.

## Verification

- Workbench MCP package suite: 194/194 passed.
- Workbench MCP authentication verification: passed.
- CLI `runWorkbenchCommand` adapter verification: passed.
- Brain provider admission suite: passed with source and runtime verified.
- Direct MCP proof: initialize succeeded; tool list was the exact three-tool
  admission; `getWorkbenchStatus` returned `connected=true`, source count 18,
  and the exact Workbench source active in single-source mode.
- Brain runtime-truth: passed.
- Infinite Brain conformance: passed with pre-existing Mind evidence warnings
  only.

No migration, n8n, webhook, fixture, deployment, rollback, or provider mutation
was executed during this reconciliation.
