# Workbench MCP Provider Admission Reconciliation

**Date:** 2026-07-16  
**Scope:** Brain admission evidence; Workbench Private read-only
**Previous admitted revision:** `fba8b8edfff254f5b440ec1a5319f155d9b86eea`
**Verified revision:** `5c23708a4fdc4c0e1d871620d6e818b82bc59d28`

## Repository proof

Workbench Private was inspected read-only on branch `main`.

Current committed HEAD:

```text
5c23708a4fdc4c0e1d871620d6e818b82bc59d28
```

The committed delta from the previously admitted revision is telemetry-only in
the capability-operation store:

```text
packages/cli/src/agent/capability-operation-store.ts
```

The matching built artifact is also repinned:

```text
packages/cli/dist/agent/capability-operation-store.js
```

No admitted MCP, authentication, migration, grant, audit, confirmation, lease,
rollback, receipt, or scope-projection contract changed. No Workbench file was
modified by this reconciliation.

## Scope and authority verification

The admitted Brain surface remains exactly:

- `getWorkbenchStatus`
- `readWorkbenchContext`
- `runWorkbenchCommand`, restricted to `n8n_workflow_migration`

The provider change does not add a new tool, a new nested command kind, or
broader Brain authority. It only adds lock telemetry around the existing store
lock path.

## Generated registration determination

The project registration remains generated from the provider entrypoint, server
name, environment-variable names, exact tools, exact suboperations, and limits.
Because those fields did not change, only the provider revision and pinned
artifact digests require update.

## Explicit non-events

No credential or private runtime material was read. No n8n, migration, webhook,
fixture, deployment, restart, grant, schedule, activation, rollback, external
write, commit, or push occurred.

## Verdict

```text
SAFE_TO_REPIN_WORKBENCH_PROVIDER_REVISION_DOCS_ONLY_NO_SCOPE_CHANGE
```
