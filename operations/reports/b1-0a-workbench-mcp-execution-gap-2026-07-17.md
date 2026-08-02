# B1.0a Workbench MCP Execution Gap

**Date:** 2026-07-17  
**Scope:** repository-only, read-only MCP inspection  
**Status:** incomplete

## Locked source

- `brain`

## Active run

- `null`

## Exposed Workbench MCP tools

- `getWorkbenchStatus(_: { include?: "sources" | "active" | "all" })`
- `readWorkbenchContext(_: { ... sourceId: string; mode: "prepare_task_context" | "read_paths" | "search_and_read" | "list_files" | "search" | "grep_context" | "read_range" | "read_symbol" | "graph_context" | "active_run"; ... })`
- `runWorkbenchCommand(() => any)`

## Exact `runWorkbenchCommand` schema

The exposed input schema is empty.

```text
type runWorkbenchCommand = () => any;
```

No request object fields are exposed for the command runner in this Codex session.
No structured response schema is exposed either; the returned payload is opaque.

## Missing migration lifecycle fields

The exposed `runWorkbenchCommand` schema does not provide fields for:

- `commandKind`
- `n8n_workflow_migration`
- `prepare`
- `execute`
- `status`
- `readback`
- `confirmation`
- `approvalEvidence`
- `rollback`
- `operationId`
- `candidateHash`
- `rollbackHash`
- `workflowIdentity`
- `allowedPaths`
- `expiration`
- `receipt`
- `graphReadback`

## Gap classification

Best-supported classification: **Codex MCP projection gap**.

Reason:

- the exposed Workbench tool surface in this session is a zero-argument
  `runWorkbenchCommand`;
- the repository-side provider admission file already admits the
  `n8n_workflow_migration` suboperation for the Workbench provider;
- therefore the missing live-execution boundary is not represented in the
  session-facing MCP schema, even though the provider admission record remains
  present.

This session does not prove the provider implementation itself lacks the
missing lifecycle fields, but it does prove Codex cannot express them through
the currently exposed Workbench tool schema.

## Minimum required schema change

Expose a structured `runWorkbenchCommand` input schema that can represent a
guarded migration lifecycle for `commandKind: "n8n_workflow_migration"`, at
minimum including:

- a command selector for the migration kind;
- a prepare request and response;
- a confirmation token or approval-evidence field;
- an execute request and response;
- a status/readback request and response;
- a rollback request and response;
- operation identity plus candidate and rollback hashes;
- workflow identity, allowed paths, and expiration metadata.

## No-live-action proof

- `getWorkbenchStatus({ include: "all" })` returned `connected: true` and
  locked source `brain`.
- `readWorkbenchContext({ mode: "active_run", sourceId: "brain" })` returned
  `activeRun: null`.
- `runWorkbenchCommand` was not called.
- No live mutation, deployment, n8n access, or rollback occurred.

## Resume condition

Resume B1.0a only after the Workbench MCP surface exposes a structured
`runWorkbenchCommand` request that can:

1. select `commandKind: "n8n_workflow_migration"`;
2. prepare and return candidate, rollback, workflow, and approval metadata;
3. accept confirmation evidence;
4. execute the approved candidate;
5. return live readback and receipt data; and
6. expose rollback in the same guarded lifecycle.

Until then, B1.0a remains incomplete and blocked at the MCP boundary.
