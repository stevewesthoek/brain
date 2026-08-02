# Workbench MCP provider post-merge readmission

**Date:** 2026-08-02
**Branch:** feature/brain-next
**Admitted revision (before):** `be780050a68d4ec95a7f07a1a180881582c57fc0`
**Admitted revision (after):** `aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e`
**Reviewed by:** Brain runtime (read-only committed tree review)

## Scope

Review of the Workbench provider delta from revision `be780050...` to `aa7bf7ec...`
for Brain admission purposes. This document distinguishes:

- **Brain admission** — Brain's formal review and approval of a provider for local use
- **Local client registration** — IDE/CLI config entries that start the provider
- **Live provider runtime** — a running MCP server process
- **Repository checkout** — the Workbench Private repository at a known revision
- **Dirty working-tree state** — uncommitted file modifications in the checkout

## Review method

Committed Git objects were exported from revision `aa7bf7ec...` using `git archive`
into a temporary directory outside both repositories. All artifact verification was
performed against that exported committed tree, not against the dirty working-tree
contents of the Workbench Private checkout.

The Workbench Private repository contains unrelated dirty state. That state was
not inspected and did not affect this review.

## Commit delta summary

Approximately 100 commits. All commits are in one of these categories:
- `fix(macos)`, `feat(macos)`, `build(macos)`, `docs(macos)` — native macOS host Phase Q/P work
- `feat(benchmark)`, `test(benchmark)`, `docs(benchmark)` — action round-trip corpus baseline
- `feat(telemetry)` — request-scoped action metrics
- `feat(agent)`, `test(native)`, `ops(macos)` — portable operation dispatcher, native acceptance
- `feat(mcp)`, `feat`, `fix`, `chore` — MCP registration, session-aware envelope, performance

The macOS native host work (Phases M–Q) adds a native Swift app and XPC boundary. This
affects the internal transport layer but does not change Brain's admitted MCP tool surface
or the loopback-only network policy.

## Admitted artifact changes

### Changed committed source artifacts (10 of 13)

| Path | Old SHA-256 | New SHA-256 | Change summary |
|------|-------------|-------------|----------------|
| `packages/shared/src/workbench-command-contract.ts` | `a9dcc276...` | `c77a15df...` | Added sessionAwareRunWorkbenchCommandRequestSchema (v2 envelope with sessionId); canonicalizationVersion hardened to literal 1 |
| `docs/openapi.chatgpt.json` | `7db8f6cc...` | `3a852e4f...` | Internal schema updates; same 5 operationIds, same server URL, same auth scheme |
| `apps/web/src/app/api/actions/run-command/route.ts` | `df566edf...` | `c3aae3b4...` | Uses sessionAwareRunWorkbenchCommandRequestSchema; adds requestId telemetry fields |
| `packages/cli/src/agent/capability-grants.ts` | `b07a8797...` | `61b7388a...` | canonicalizationVersion changed from schema ref to z.literal(1); functionally equivalent |
| `packages/cli/src/agent/n8n-workflow-migration-capability.ts` | `240c79e8...` | `ebbe337b...` | canonicalizationVersion v1 hardening; canonicalizeN8nWorkflow() called without version arg |
| `packages/cli/src/agent/n8n-workflow-migration-executor.ts` | `ca747b56...` | `4f77aeec...` | Same canonicalization hardening; protectedDomainMismatches detail field removed from result |
| `packages/cli/src/agent/capability-operation-store.ts` | `06df2d83...` | `1f8084e5...` | canonicalizationVersion literal 1; evidence structure simplified |
| `packages/cli/src/agent/config.ts` | `0e60b0e2...` | `fe895da5...` | Added in-process git metadata cache with 5-minute TTL; performance only |
| `packages/mcp/src/configure-codex.ts` | `b8b452e9...` | `ce901734...` | Refactored to use configure-core.ts constants; added brain profile with explicit admitted tool/command-kind env vars |
| `pnpm-lock.yaml` | `a65281799...` | `94ff9119...` | Dependency lock update for 1.3.3-beta |

### Unchanged committed source artifacts (3 of 13)

| Path | SHA-256 |
|------|---------|
| `apps/web/src/lib/actionAuth.ts` | `9709fa85...` |
| `packages/cli/src/agent/n8n-workflow-migration-command-adapter.ts` | `fad1a9a4...` |
| `packages/bridge/src/storage/request-audit.ts` | `9d1373ab...` |

### Dist artifacts (12 — gitignored at both revisions)

`packages/mcp/dist/{server.js,mcp-server.js,scope.js,contracts.js,client.js}` and
`packages/cli/dist/agent/{server.js,n8n-workflow-migration-command-adapter.js,n8n-workflow-migration-capability.js,n8n-workflow-migration-executor.js,capability-operation-store.js,capability-mutation-dispatch-store.js,config.js}` are gitignored at both revisions. These cannot be verified from committed objects. They retain `sourceState: "working-tree-only"` in the admission.

## Security review

### Authentication and confirmation
- `actionAuth.ts` unchanged → authentication boundary unchanged
- Two-phase confirmation preserved in capability and executor
- No confirmation bypass paths added

### Tool and command surface
- Three admitted tools (`getWorkbenchStatus`, `readWorkbenchContext`, `runWorkbenchCommand`) unchanged
- `n8n_workflow_migration` remains the only admitted command kind
- No new command kinds, no new tool names

### Network authority
- MCP transport loopback-only — unchanged
- MCP client now connects to `127.0.0.1:3154` (native ingress) vs `127.0.0.1:3054` — still loopback-only
- No external network access added

### Mutation authority
- `n8n-workflow-migration-executor.ts` simplifies canonicalization to v1 only; no new mutation paths
- `protectedDomainMismatches` detail removed from result output — the domain check itself is still enforced (fail-closed on mismatch)
- Rollback authority unchanged

### Credential boundary
- `request-audit.ts` unchanged
- No credential values in admitted artifacts
- `WORKBENCH_MCP_CREDENTIAL_FILE` env var pattern preserved

### Shell execution
- No shell execution added

## Admissibility verdict

**ADMISSIBLE.** The delta:
- does not broaden the admitted tool surface
- does not add a command kind
- does not weaken authentication or confirmation
- does not broaden mutation authority
- does not add shell or arbitrary executable authority
- does not change credential or network boundaries in an ambiguous way
- can be reviewed completely from committed objects (source artifacts)

## Post-admission state

- **Admission status:** `active-local` (unchanged)
- **Provider revision:** `aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e`
- **Provider version:** `1.3.3-beta`
- **Source state:** `mixed` (source committed, dist working-tree-only)
- **Client registration:** none — admission is not client registration

A valid admission does not imply the provider is running or any client has connected to it. Client registration requires a separate authorized configuration step.
