# Workbench MCP Provider Admission Reconciliation

**Date:** 2026-07-17  
**Scope:** Brain admission evidence; Workbench Private read-only
**Previous admitted revision:** `5c23708a4fdc4c0e1d871620d6e818b82bc59d28`
**Verified revision:** `7e6892ee804d2b22b879e7ab1f93968fe09405cd`

## Repository proof

Workbench Private was inspected read-only on branch `main`.

Current committed HEAD:

```text
7e6892ee804d2b22b879e7ab1f93968fe09405cd
```

The committed delta from the previously admitted revision is the
Codex-compatible MCP discovery projection change in `packages/mcp/src/contracts.ts`
and its paired tests, plus a docs-only follow-up commit. The local working tree
also contains unrelated graphify ignore/cache edits, but those are not part of
the admitted Brain MCP surface.

No admitted MCP, authentication, migration, grant, audit, confirmation, lease,
rollback, receipt, or scope-projection contract broadened. Runtime requests
still pass through the existing strict parser, and the admitted mutation scope
remains exactly `n8n_workflow_migration`. No Workbench file was modified by
this reconciliation.

## Scope and authority verification

The admitted Brain surface remains exactly:

- `getWorkbenchStatus`
- `readWorkbenchContext`
- `runWorkbenchCommand`, restricted to `n8n_workflow_migration`

The provider change does not add a new tool, a new nested command kind, or
broader Brain authority. It does not alter approval flow, grant semantics, or
rollback behavior.

## Generated registration determination

The project registration remains generated from the provider entrypoint, server
name, environment-variable names, exact tools, exact suboperations, and limits.
Because those fields did not change, only the provider revision, the changed
`packages/mcp/dist/contracts.js` digest, and the dated evidence needed update.

## Explicit non-events

No credential or private runtime material was read. No n8n, migration, webhook,
fixture, deployment, restart, grant, schedule, activation, rollback, external
write, commit, or push occurred.

## Verdict

```text
SAFE_TO_REPIN_WORKBENCH_PROVIDER_REVISION_WITH_UPDATED_CONTRACT_DIGEST_NO_SCOPE_CHANGE
```
