# MCP Centralization Standard

This directory is the canonical, centralized home for MCP server documentation and templates.

## Goals
- Keep MCP setup consistent across tools and repos.
- Keep secrets and runtime tokens out of git.
- Keep client behavior unchanged by using managed config-file symlinks.

## Canonical locations
- Server docs/templates: `operations/system-configs/mcp/<server>/`
- Codex MCP registry: `operations/system-configs/codex/config.toml`
- Antigravity MCP runtime config (centralized, git-ignored):
  `operations/system-configs/antigravity/User/mcp.json`
- Antigravity MCP tracked template (safe):
  `operations/system-configs/antigravity/mcp.template.json`

## Required server folder shape
For each server under `operations/system-configs/mcp/<server>/`:
- `README.md`
- `codex-config.template.toml` (if Codex server is supported)
- Client templates as needed (for example `mcp-http-config.template.json`)

Templates must never contain real tokens, API keys, or cookies.

## Installation policy (all new MCP servers)
1. Verify official setup docs and auth model.
2. Register server in `operations/system-configs/codex/config.toml`.
3. Add/update `operations/system-configs/mcp/<server>/README.md` + templates.
4. Store runtime secrets only in ignored runtime files (never in templates/docs).
5. If client config must hold tokens (for example Antigravity HTTP headers), keep it in a centralized ignored file and symlink from the original client path.
6. Verify with client-specific checks (`codex mcp list`, client restart, tool test).

## Symlink pattern
- Codex:
  - `~/.codex` is a real local runtime directory
  - `~/.codex/config.toml` is a physical mode-`0600` generated copy of the
    portable Brain baseline, with the current account home rendered locally
  - Repo root `.codex -> ~/.codex` (local-only, ignored in each repo)
- Antigravity:
  - `~/Library/Application Support/Antigravity/User/mcp.json`
    -> `/path/to/brain/operations/system-configs/antigravity/User/mcp.json`
  - Antigravity runtime JSON uses top-level `servers` (not `mcpServers`)

## Secret handling
- Prefer OAuth/ADC or proxy mode over static API keys.
- If key/token mode is required, put values only in runtime config that is git-ignored.
- Never commit:
  - `Authorization: Bearer ...`
  - `X-Goog-Api-Key`
  - cookies/session/auth files
