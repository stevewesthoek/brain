# Workbench MCP Provider Admission Decision

**Date:** 2026-07-16  
**Decision:** approve replacement admission  
**Scope:** Brain provider registry only; Workbench Private read-only

## Revisions

- Previously admitted Workbench revision: `4f8217059f6f3a681f150ca4145b8a5793f11616`
- Reviewed Workbench revision: `fba8b8edfff254f5b440ec1a5319f155d9b86eea`
- Branch: `main`

Committed changes since the previous admission:

```text
34b9194 fix(workbench): preserve commit confirmation fields
cfc1cd2 fix(workbench): forward guarded commit confirmation
e740f09 feat: add phase 11 telemetry contract
```

## Changed approval-contract artifact

Pinned artifact:

```text
packages/shared/src/workbench-command-contract.ts
```

Reviewed change:

- allows `confirmedByUser` on guarded `git_commit` requests;
- allows `confirmationToken` on guarded `git_commit` requests;
- preserves those validated fields through the command-request parser;
- adds contract verification for confirmed guarded staging and commit requests.

New verified SHA-256:

```text
83403828101e5a1a16b6b92d600eb090a87976da98d43cf3a938726c439c0e1b
```

## Explicit admission determinations

### Brain-admitted tools and suboperations

No Brain-admitted tool or suboperation is added or broadened. The admitted surface remains exactly:

- `getWorkbenchStatus`;
- `readWorkbenchContext`;
- `runWorkbenchCommand.n8n_workflow_migration`.

Brain does not admit `git_commit` through its MCP provider scope.

### Migration approval semantics

The reviewed shared contract retains the strict `n8n_workflow_migration` discriminated phases:

- prepare: fixed paths plus `networkAccess: true`;
- execute: operation ID plus confirmation token;
- status: operation ID.

Brain's registry continues to classify this suboperation as external mutation with two-phase approval. The guarded `git_commit` change does not modify this schema or its admitted scope.

### Authentication and authority

The canonical provider validator reports only:

- provider revision mismatch;
- digest mismatch for `packages/shared/src/workbench-command-contract.ts`.

All other pinned artifacts revalidate. Therefore the pinned authentication, source-locking, command dispatch, grant, operation-store, migration executor, confirmation, lease, rollback, audit, receipt, MCP entrypoint, and scope-projection artifacts remain unchanged.

### Mutation authority

No new mutation authority is introduced for Brain. Workbench remains the authenticated execution authority. Brain remains the admission and installation-policy authority. MCP remains transport and typed capability projection.

### Telemetry changes

The committed telemetry additions affect run-command response telemetry and product documentation. They do not change Brain's MCP tool allowlist, nested migration allowlist, or migration authority.

## Decision rationale

The changed artifact is security-relevant and therefore required this explicit decision. Admission is approved because:

1. the new confirmation fields strengthen guarded commit confirmation forwarding rather than bypassing confirmation;
2. `git_commit` is outside Brain's admitted MCP surface;
3. the admitted `n8n_workflow_migration` two-phase contract remains unchanged;
4. every other pinned provider artifact still matches;
5. no Brain mutation scope or authority is broadened;
6. no generated project registration field depends on provider revision or this non-admitted command schema.

## Approved registry update

Brain may update only:

- provider revision to `fba8b8edfff254f5b440ec1a5319f155d9b86eea`;
- SHA-256 for `packages/shared/src/workbench-command-contract.ts` remains `83403828101e5a1a16b6b92d600eb090a87976da98d43cf3a938726c439c0e1b`;
- review/evidence metadata.

The later delta from `34b91947b935c3237a3381474cd0a81ed0fce0a7` to `fba8b8edfff254f5b440ec1a5319f155d9b86eea` is telemetry-only, changes no pinned provider artifact, and does not alter Brain's admitted MCP surface or migration approval semantics.

No other digest, tool, suboperation, approval mode, environment variable, or registration metadata is approved to change.

## Non-events

No Workbench or Mind file was modified. No credential or private runtime material was read. No n8n, webhook, fixture, deployment, restart, grant, schedule, activation, external write, commit, or push occurred.

## Verdict

```text
APPROVE_PROVIDER_REPLACEMENT_ADMISSION_NO_BRAIN_SCOPE_BROADENING
```
