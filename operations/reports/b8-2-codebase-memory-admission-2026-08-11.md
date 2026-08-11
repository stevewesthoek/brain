# B8.2 Codebase Memory MCP admission — 2026-08-11

## Decision

B8.2 is accepted. The canonically benchmarked `codebase-memory-mcp 0.9.0` provider is formally admitted as Brain's project-scoped structural-memory provider. Activation is limited to Brain; no Workbench, ProChat, Mind, or global rollout is authorized here.

## Pinned provider

- admission: `codebase-memory-mcp-brain`
- status: `active-local`
- version: `0.9.0`
- upstream revision: `b637e3330c96cfe452da623db068c241aaa3ec01`
- runtime binary: `/Users/Office/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp`
- binary SHA-256: `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6`
- authentication: `none`
- transport: stdio, project-scoped, shell=false
- Brain cache: `/Users/Office/Library/Caches/brain/codebase-memory-mcp/brain`
- persistence: false by admitted source-safety contract
- auto-index: false
- auto-watch: false; explicitly verified and persisted before B8.3

## Exact live tool inventory

The live `--help` output exposes exactly the 14 admitted tools:

`index_repository`, `search_code`, `query_graph`, `trace_path`, `get_code_snippet`, `get_graph_schema`, `get_architecture`, `search_graph`, `list_projects`, `delete_project`, `index_status`, `detect_changes`, `manage_adr`, `ingest_traces`.

The canonical registry and tests pin the same ordered inventory. Write-capable provider-store operations remain per-call approval-gated by Brain policy; structural results do not authorize repository writes.

## Runtime and scope verification

Live MCP runtime-truth with the exact provider root and revision returned:

- `mcp-runtime-truth-check=pass`
- provider source verified: 1
- provider runtime verified: 1
- Codebase Memory registration: `b8.2-accepted`
- Workbench scope: within admitted scope
- bare credentials: none detected
- Graphify structural state: frozen; scheduler skip enforced

The Brain-local `.codex/config.toml` registration uses the pinned binary, the exact 14-tool list, no credential material, and the Brain-only `CBM_CACHE_DIR`. No global client configuration was changed.

Live provider CLI checks also proved:

- `config list`: `auto_index=false`, `auto_watch=false`
- `list_projects`: zero indexed projects at admission time; no automatic repository rollout occurred
- no repository-local `.codebase-memory` state exists
- repository source state remained unchanged except for the explicit B8.2 governance edits

## Exact-source fallback

B8.1 canonical evidence proved exact-source and fallback accuracy at 1.0. B8.2 does not replace exact source as authority and does not require a structural index to exist before ordinary bounded source reads remain available. With zero live projects indexed at admission time, the system remains safe to degrade to exact-source reads until B8.3 introduces governed inventory/freshness behavior.

## Rollback and uninstall

The admitted revocation procedure remains canonical. Live `codebase-memory-mcp uninstall --dry-run -n` completed successfully and reported `(dry-run — no files were modified)`. It identified the Brain cache and preserved indexes when deletion was declined. Actual uninstall was not executed because B8.2 requires reversible proof, not destructive removal.

Rollback path:

1. remove/disable the Brain project-scoped registration;
2. change admission status from `active-local` to `paused` or `revoked` as appropriate;
3. preserve benchmark/admission evidence;
4. optionally remove provider runtime/cache only under explicit uninstall authority;
5. exact-source reads remain the fallback.

## Validation

- MCP provider/admission/runtime suites: 90/90 pass
- canonical registry validates against `mcp-provider-admission.schema.json`
- exact live provider provenance verification passes with explicit exported-root revision attestation
- runtime-truth passes with no credentials or scope mismatch
- Brain-local cache isolation verified
- live tool inventory matches 14-tool admission
- rollback/uninstall dry-run passes without mutation

## Boundary

B8.2 does not authorize B8.3 freshness/watchers, additional repository indexes, broader client rollout, or Graphify migration. B8.3 must separately define the approved repository inventory, freshness metadata, incremental refresh behavior, exclusions, budgets, and failure receipts.
