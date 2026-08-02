# Workbench MCP Provider Admission Review

**Date:** 2026-07-19  
**Consumer:** Brain  
**Provider:** Workbench Private, read-only review  
**Previously admitted revision:** `7e6892ee804d2b22b879e7ab1f93968fe09405cd`  
**Admitted revision:** `7282557224950b1e249d3ef8a143f6e69942c864`

## Decision

Brain explicitly admits the reviewed Workbench revision after a full comparison of the committed provider delta and the existing Brain artifact manifest. This is not a revision-only repin.

The broader Workbench delta contains persistent resume projection, run-owned budgets, deterministic resume and handoff, prompt packet compilation, executor parity, guarded external delegation, provider capability registration, runtime provenance guardrails, and bounded controlled-migration executor diagnostics. Brain admits none of those as new commands or permissions merely because they exist in the provider repository.

## Brain-admitted surface

The admitted surface remains exactly:

- `getWorkbenchStatus`
- `readWorkbenchContext`
- `runWorkbenchCommand`, restricted to `n8n_workflow_migration`

Migration phases remain exactly:

- `prepare`
- `execute`
- `status`

No unrelated Workbench command kind or nested suboperation was added.

## Authority review

The exact provider delta from the previous revision to the admitted revision was inspected. The review found no broadening of:

- authentication authority;
- confirmation semantics;
- operation-specific digest binding;
- confirmation expiry or single-use enforcement;
- lease semantics;
- mutation dispatch reservation or replay protection;
- rollback authority;
- executable or argv selection;
- shell usage;
- environment access;
- endpoint, header, credential, or provider payload control;
- network submission authority;
- deployment, restart, or client-launch authority.

The controlled-migration changes preserve bounded executor diagnostics while retaining `PRECONDITION_UNAVAILABLE` and `READBACK_UNAVAILABLE` as state-machine reasons. The added evidence fields are bounded classification, reason code, exit code, read purpose, operation ID, and workflow ID. They do not expose stdout, stderr, credentials, environment values, or configuration contents.

## Artifact review

Brain's existing provider admission manifest was used as the complete artifact boundary. No new artifact was silently added.

The canonical validator identified exactly two changed admitted artifacts:

- `packages/cli/src/agent/n8n-workflow-migration-executor.ts`
  - SHA-256: `360d7eeb6e9cfd07ddd4b35372e3ea071c1ab318d5c8e3373bfb8888e692f281`
- `packages/cli/dist/agent/n8n-workflow-migration-executor.js`
  - SHA-256: `713be2bb9d033618b03b96c8923145d94a3deb539a3927e150322a591923a57b`

`packages/shared/src/controlled-workflow-migration-state.ts` changed in the provider repository but is not an artifact in Brain's existing provider admission manifest, so Brain did not add it during this review.

All other previously admitted artifact digests remain unchanged.

## Required validation

The admission is accepted only if both pass against the reviewed provider checkout:

- Brain MCP provider-admission validation;
- Infinite Brain conformance.

## Runtime boundary

This review does not authorize a migration, deployment, restart, fixture invocation, rollback, or credential access. B1.0a must not resume until runtime provenance confirms the live Workbench runtime was built from the admitted revision and the MCP client has refreshed discovery.

## Verdict

`WORKBENCH_PROVIDER_REVISION_7282557224950B1E249D3EF8A143F6E69942C864_ADMITTED_WITH_TWO_REVIEWED_DIGEST_CHANGES_NO_AUTHORITY_BROADENING`
