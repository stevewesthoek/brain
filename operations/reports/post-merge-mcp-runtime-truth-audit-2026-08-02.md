# Post-merge MCP runtime-truth audit

**Date:** 2026-08-02
**Branch:** feature/brain-next
**Author:** Brain runtime
**Scope:** Read-only audit of MCP registration, admission, and provider state following stabilization merge

## Codebase Memory MCP

### Binary and installation
- **Binary:** installed at `~/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp`
- **Stable symlink:** `~/.local/bin/codebase-memory-mcp`
- **SHA-256 (darwin-arm64):** `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6` — matches admission
- **Version:** 0.9.0

### Cache state
- **Isolated caches present:** brain, workbench-private, prochat (each with `_config.db`)
- **Freshness:** unknown — caches are isolated and non-authoritative; freshness requires `index_status` tool call per repo
- **Repository mutation:** none — no `.codebase-memory/` directories found in source repositories

### Admission state
- **Admission ID:** `codebase-memory-mcp-brain`
- **Status:** candidate
- **Activation authorization:** none — no approved default activation exists
- **Canonical B8.2 acceptance:** not complete

### Client registration
- **Claude Code (`~/.claude.json` mcpServers):** no `codebase-memory-mcp` entry found
- **Codex (`~/.codex/config.toml`):** no `[mcp_servers.codebase-memory-mcp]` entry found
- **Conclusion:** not registered in any client

### Tool allowlist enforcement
- **Server-side:** absent — `CBM_ALLOWED_TOOLS` and `CBM_ALLOWED_SUBOPERATIONS` are Brain-layer documentation only; they are not read by the binary
- **Client-side:** not applicable — no registration exists

### Canonical task status
- B8.1 (benchmark plan): not complete
- B8.2 (canonical acceptance): not complete
- B8.3–B8.6: not started

**Conclusion:** Codebase Memory is installed and has isolated caches. It is not registered in any client and is not the default context memory. Existing caches are not freshness proof.

---

## Workbench MCP

### Admission state (post-update)
- **Admission ID:** `workbench-for-brain`
- **Status:** `active-local`
- **Admitted revision (before this task):** `be780050a68d4ec95a7f07a1a180881582c57fc0`
- **Admitted revision (after this task):** `aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e`
- **Admitted version:** `1.3.3-beta`
- **Source state:** `mixed` (source artifacts committed; dist artifacts gitignored at both revisions)

### Provider validation
- **Validation method:** exported committed tree at `aa7bf7ec...` via `git archive`
- **Source artifacts verified:** 13 committed source paths — 10 changed, 3 unchanged
- **Dist artifacts:** 12 gitignored dist files — hashes cannot be verified from committed objects; retain working-tree-only status
- **Validator result against committed tree:** source hashes match updated admission

### Admitted tool scope
- **Admitted tools:** `getWorkbenchStatus`, `readWorkbenchContext`, `runWorkbenchCommand`
- **Admitted command kinds:** `n8n_workflow_migration` only
- **Scope enforcement:** server-side via `WORKBENCH_MCP_ALLOWED_TOOLS` and `WORKBENCH_MCP_ALLOWED_COMMAND_KINDS` environment variables parsed by `scope.ts`

### Client registration
- **Claude Code (`~/.claude.json` root `mcpServers`):** no `workbench` entry found
- **Codex (`~/.codex/config.toml`):** no `[mcp_servers.workbench]` entry found
- **Conclusion:** not registered in any client

### Admission vs. registration distinction
The admission is `active-local`. No client registration exists. Admission does not imply live operation. A valid admission means Brain has reviewed and approved the provider for local registration; it does not mean the server is running or any client has connected to it.

### Runtime provenance
Provider source verified from exported committed tree only. Working-tree dist files were not re-verified. Live server process was not inspected (no client registration to start it from).

---

## Legacy guarded bridge (b1_0a_guarded_save_to_mind)

### Documented state
The Brain README at `operations/system-configs/mcp/b1-0a-guarded-save-to-mind/README.md` states: **"disabled compatibility source."** The Codex block was expected to have `enabled = false`.

### Observed Codex state
**Present and enabled.** `~/.codex/config.toml` contains `[mcp_servers.b1_0a_guarded_save_to_mind]` with the `enabled` flag not set to false (defaults to enabled in Codex TOML). This contradicts the documented disabled state.

### Exact remediation required
In `~/.codex/config.toml`, add or update `enabled = false` under `[mcp_servers.b1_0a_guarded_save_to_mind]`. This is user-level configuration and was not modified in this task.

### Status of this task
User-level configuration was not changed. The discrepancy is documented here. Remediation requires a separate authorized configuration update.

---

## Graphify

### Structural indexing
- **State:** frozen
- **Nightly job:** skipped — scheduler emits `skipping job=graphify-nightly reason=bs0-15-pending-containment`
- **Last known activation:** none in current stabilization cycle

### Semantic synthesis
- **State:** inactive
- **Historical `graphify-out` artifacts:** present but stale and non-authoritative

### Governance
- **File:** `operations/specs/graphify-transition-governance.json`
- **Deletion state:** `prohibited-before-retention-gate` (three uncleared conditions remain)

### B8.5 status
Not complete. Graphify frozen state is not B8.5 completion. B8.5 requires bounded Graphify profiles for approved Brain architecture and Mind knowledge synthesis scopes, with event-driven freshness and retention policy — none of which has been implemented.

---

## Summary table

| Component | Installed | Registered | Default | Watcher | Admission |
|-----------|-----------|------------|---------|---------|-----------|
| Codebase Memory MCP | yes | no | no | disabled | candidate |
| Workbench MCP | yes (at source path) | no | no | n/a | active-local |
| Legacy bridge (b1_0a) | yes | yes (Codex) | n/a | n/a | retired |
| Graphify | installed | n/a | frozen | n/a | n/a |
