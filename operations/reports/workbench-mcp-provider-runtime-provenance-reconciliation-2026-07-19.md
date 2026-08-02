# Workbench MCP Provider Runtime-Provenance Reconciliation

**Date:** 2026-07-19  
**Consumer:** Brain  
**Previous admitted revision:** `7282557224950b1e249d3ef8a143f6e69942c864`  
**Admitted live revision:** `7782cc0fff64976664296cfc78d102ca0227d2a0`

## Runtime provenance

The restarted Workbench runtime reported:

- package version: `1.3.1-beta`;
- Git revision: `7782cc0fff64976664296cfc78d102ca0227d2a0`;
- build timestamp: `2026-07-19T16:36:53Z`;
- agent, relay, and web: healthy at handoff;
- MCP/tool connection: restored.

The user handoff named package version `3.1-beta`; the live Workbench health response reported `1.3.1-beta`. Git revision and build timestamp matched the reviewed runtime exactly, so the package-version discrepancy is retained as observed provenance rather than normalized silently.

## Exact provider delta

The committed delta from `7282557224950b1e249d3ef8a143f6e69942c864` to `7782cc0fff64976664296cfc78d102ca0227d2a0` changed only:

- local lifecycle provenance injection;
- detached-service provenance environment propagation;
- package-version fallback behavior;
- health/status provenance projection;
- focused verification and documentation.

The only changed artifact already present in Brain's provider-admission manifest was:

- `packages/cli/dist/agent/server.js`
  - previous SHA-256: `5d321675c8127364fbbdd633c6a03347629dccf780a4ad3abb53b5d59fc69041`
  - admitted SHA-256: `44e1286285c7746fefb782ffa3b5c42f6ca93660c618cdc5b20ca0525dc581b8`

No new artifact was added to Brain's provider manifest.

## Authority review

The corrective delta does not broaden:

- migration command scope;
- migration phases;
- confirmation semantics;
- leases;
- replay protection;
- rollback authority;
- mutation authority;
- executable or argv control;
- shell access;
- environment authority;
- credential access;
- network submission;
- deployment or restart authority.

The admitted surface remains exactly:

- `getWorkbenchStatus`;
- `readWorkbenchContext`;
- `runWorkbenchCommand`, restricted to `n8n_workflow_migration` with two-phase approval.

## Required validation

Admission is valid only while both pass against the reviewed checkout:

- Brain provider-admission validation;
- Infinite Brain conformance.

## B1.0a boundary

This reconciliation does not itself authorize a migration. A fresh B1.0a operation may be prepared only after provider validation and conformance pass. The historical failed operation `cap-op-0cd499585a1046ec20385e0677aaa0ab` remains evidence only and must not be reused.

## Verdict

`WORKBENCH_RUNTIME_REVISION_7782CC0FFF64976664296CFC78D102CA0227D2A0_ADMITTED_ONE_REVIEWED_DIGEST_CHANGE_NO_AUTHORITY_BROADENING`
