# Workbench MCP Provider Admission Evidence

**Date:** 2026-07-15  
**Verdict:** `RUNTIME_READY_FOR_B1_0A` — bridge admitted; B1.0a not executed  
**Scope:** Brain admission and read-only local verification only

## Boundary decision

Workbench owns its authenticated MCP adapter, action boundary, grants,
operation/dispatch state, n8n execution, reconciliation, rollback, audit, and
receipts. Brain owns provider admission, exact tool/suboperation scope,
artifact pins, generated project registration, drift response, and revocation.
No Workbench policy or business logic is copied into Brain.

The admitted B1.0a surface is exactly:

- `getWorkbenchStatus`;
- `readWorkbenchContext`;
- `runWorkbenchCommand` only when `commandKind` is
  `n8n_workflow_migration`.

Workbench file mutation, commit, push, arbitrary commands, and unrelated nested
command kinds are not admitted. The legacy B1.0a-specific MCP source is retained
but its global registration is disabled.

## Current evidence

- Workbench version: `1.3.1-beta` at committed release revision
  `d4e049ef05627ebffde17f2d44ae6bcaa939d01e`, with the exact admitted
  boundary files pinned by SHA-256 in the admission registry. The prior
  `eb2f30017815c6c1c52d2a273471a3be1f3dc455` working-tree pin drifted after
  the bounded MCP hardening and release commits and was deliberately
  revalidated before the Brain admission was repinned.
- Authenticated MCP status returned `ok: true` from the detached local runtime.
- Direct source listing confirmed Brain is an enabled, active, ready Workbench
  source. The previous intermittent status timeout was traced to unnecessary Git
  hydration in the lite source endpoint and corrected in Workbench source. Five
  post-restart loopback checks completed in approximately 1–2 ms.
- A direct Shared-source import defect had caused TypeScript to emit new CLI
  modules under a nested path while the launcher continued using stale
  top-level `dist`. The migration modules now consume `@workbench/shared`, the
  supported build refreshes the real runtime entrypoint, and a structural check
  prevents recurrence.
- The Workbench MCP provider now enforces installation-admitted tools and nested
  command kinds at runtime.
- A malformed or duplicate controlled grant disables the entire migration
  capability; valid neighbors are not used.
- The MCP-derived credential is direct-agent-only and is rejected rather than
  forwarded in relay mode.
- Corrupt request-audit state fails closed and is not overwritten.
- Current provider checks pass without live migration: MCP package tests
  (31/31), Workbench MCP auth, CLI command adapter, controlled migration
  capability, migration executor, and capability operation store.

## Explicit non-events

No migration prepare, execute, or status request was made. No n8n request,
webhook, fixture, deployment, schedule change, credential inspection, rollback,
commit, push, tag, publication, or public-repository mutation was performed.

## Next gate

B1.0a may enter its already-defined guarded live sequence only after a separate
explicit operator authorization. That sequence must retain Workbench's
two-phase confirmation, at-most-once dispatch, mandatory readback,
success/failure fixture bounds, rollback evidence, and Brain path/topology
contracts.
